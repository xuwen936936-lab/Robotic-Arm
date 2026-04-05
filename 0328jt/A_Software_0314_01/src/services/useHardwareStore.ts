import { useSyncExternalStore } from 'react'
import {
  HARDWARE_SIGNALS,
  createWebSocketBridge,
  type ConnectionStatus,
  type HardwarePayload,
  type IHardwareBridge,
  type PointData,
} from './Bridge.ts'

type HardwareConnection = 'connected' | 'disconnected' | 'error'
type HardwareSource = 'mock' | 'hardware'
type Listener = () => void
type HardwareSignalListener = (signal: string) => void

export type JogAxis = 'x' | 'y' | 'z' | 'rx'
export type JogDirection = 'positive' | 'negative'
export type JogFrame = 'Base' | 'Tool'

export interface JogMoveCommand {
  axis: JogAxis
  direction: JogDirection
  frame: JogFrame
  distance: number
}

export interface HardwareStoreState {
  connection: HardwareConnection
  source: HardwareSource
  isRunning: boolean
  temperature: number
  coords: PointData
  updatedAt: number
}

const listeners = new Set<Listener>()
const hardwareSignalListeners = new Set<HardwareSignalListener>()

const createPoint = (
  x: number = 200,
  y: number = 100,
  z: number = 200,
  rx: number = 0,
): PointData => ({
  x: x.toFixed(2),
  y: y.toFixed(2),
  z: z.toFixed(2),
  rx: rx.toFixed(2),
})

let state: HardwareStoreState = {
  connection: 'disconnected',
  source: 'mock',
  isRunning: false,
  temperature: 29.8,
  coords: createPoint(),
  updatedAt: Date.now(),
}

let telemetryIntervalId: number | null = null
let runIntervalId: number | null = null
let runTimeoutId: number | null = null
let activeConsumers = 0

let bridge: IHardwareBridge | null = null
let bridgeUnsubscribe: (() => void) | null = null
let isRealHardwareConnected = false

//0319 定义一个全局变量用于存放延迟断开的定时器
let disconnectionTimer: number | null = null;

// 强制设为 true，连通真实硬�??
const REAL_HARDWARE_ENABLED = true;
const REAL_HARDWARE_WS_URL = import.meta.env.VITE_HARDWARE_WS_URL ?? 'ws://localhost:8080'

function emitChange() {
  listeners.forEach((listener) => listener())
}

function setState(patch: Partial<HardwareStoreState>) {
  state = {
    ...state,
    ...patch,
    updatedAt: Date.now(),
  }
  emitChange()
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function createMovingPoint() {
  const currentX = Number(state.coords.x) || 200
  const currentY = Number(state.coords.y) || 100
  const currentZ = Number(state.coords.z) || 200
  const currentRx = Number(state.coords.rx) || 0

  return createPoint(
    currentX + randomBetween(-8, 8),
    currentY + randomBetween(-6, 6),
    currentZ + randomBetween(-5, 5),
    currentRx + randomBetween(-2, 2),
  )
}

function getNextTemperature(isRunning: boolean) {
  const current = state.temperature
  const target = isRunning ? 33.4 : 29.6
  const drift = randomBetween(-0.4, 0.6)
  return Number((current + (target - current) * 0.3 + drift).toFixed(1))
}

function mapConnectionStatus(connection?: ConnectionStatus): HardwareConnection {
  if (connection === 'connected') return 'connected'
  if (connection === 'error') return 'error'
  return 'disconnected'
}

function applyJogMoveToCoords(command: JogMoveCommand): PointData {
  const baseX = Number(state.coords.x) || 0
  const baseY = Number(state.coords.y) || 0
  const baseZ = Number(state.coords.z) || 0
  const baseRx = Number(state.coords.rx) || 0
  const direction = command.direction === 'positive' ? 1 : -1
  const delta = Math.abs(command.distance) * direction

  if (command.axis === 'x') return createPoint(baseX + delta, baseY, baseZ, baseRx)
  if (command.axis === 'y') return createPoint(baseX, baseY + delta, baseZ, baseRx)
  if (command.axis === 'z') return createPoint(baseX, baseY, baseZ + delta, baseRx)
  return createPoint(baseX, baseY, baseZ, baseRx + delta)
}

function startTelemetry() {
  if (typeof window === 'undefined' || telemetryIntervalId !== null) return

  telemetryIntervalId = window.setInterval(() => {
    setState({
      connection: isRealHardwareConnected ? state.connection : 'disconnected',
      source: isRealHardwareConnected ? 'hardware' : 'mock',
      temperature: getNextTemperature(state.isRunning),
    })
  }, 1800)
}

function stopTelemetry() {
  if (telemetryIntervalId === null || typeof window === 'undefined') return
  window.clearInterval(telemetryIntervalId)
  telemetryIntervalId = null
}

function clearRunTimers() {
  if (typeof window === 'undefined') return

  if (runIntervalId !== null) {
    window.clearInterval(runIntervalId)
    runIntervalId = null
  }

  if (runTimeoutId !== null) {
    window.clearTimeout(runTimeoutId)
    runTimeoutId = null
  }
}

function clearBridgeResources() {
  bridgeUnsubscribe?.()
  bridgeUnsubscribe = null
  bridge = null
  isRealHardwareConnected = false
}

function emitHardwareSignal(signal: string) {
  hardwareSignalListeners.forEach((listener) => listener(signal))
}

export function simulateHardwareSignal(signal: string) {
  emitHardwareSignal(signal)
}

function exposeRobotDebugApi() {
  if (typeof window === 'undefined') return
  ;(window as unknown as { __ROBOT_DEBUG__?: { emitSignal: (signal: string) => void } }).__ROBOT_DEBUG__ = {
    emitSignal: simulateHardwareSignal,
  }
}

exposeRobotDebugApi()

function handleBridgePayload(payload: HardwarePayload) {
  if (payload.type === 'position' && payload.position) {
    isRealHardwareConnected = true
    setState({
      source: 'hardware',
      connection: 'connected',
      coords: payload.position,
    })
    return
  }

  if (payload.type === 'status') {
    const mappedConnection = mapConnectionStatus(payload.status?.connection)
    const realConnected = mappedConnection === 'connected'
    isRealHardwareConnected = realConnected
    setState({
      source: realConnected ? 'hardware' : 'mock',
      connection: realConnected ? 'connected' : 'disconnected',
      coords: payload.status?.position ?? state.coords,
    })
    return
  }

  if (payload.type === 'event' && payload.event) {
    emitHardwareSignal(payload.event)
  }
}

async function connectRealHardwareIfEnabled() {
  //0319
  //if (!REAL_HARDWARE_ENABLED || bridge || typeof window === 'undefined') return
  // 如果已经�?? bridge 或者正在连接中，直接返回，不要创建新连�??
  if (bridge || !REAL_HARDWARE_ENABLED) return;

  const candidate = createWebSocketBridge(REAL_HARDWARE_WS_URL)
  const unsubscribe = candidate.onDataReceived(handleBridgePayload)

  try {
    await candidate.connectDevice()
    bridge = candidate
    bridgeUnsubscribe = unsubscribe
    isRealHardwareConnected = false
    setState({
      source: 'mock',
      connection: 'disconnected',
    })
  } catch (_error) {
    unsubscribe()
    clearBridgeResources()
    setState({
      source: 'mock',
      connection: 'disconnected',
    })
  }
}

async function disconnectRealHardware() {
  if (!bridge) {
    clearBridgeResources()
    return
  }

  try {
    await bridge.disconnectDevice()
  } catch (_error) {
    // ignore disconnect error in cleanup path
  } finally {
    clearBridgeResources()
  }
}

// function sendBridgeCommand(command: string, payload?: Record<string, unknown>) {
//   if (!bridge?.sendCommand || !isRealHardwareConnected) return false
//   void bridge.sendCommand(command, payload)
//   return true
// }

// 0327
function sendBridgeCommand(command: string, payload?: Record<string, unknown>) {
  // ɾ�� !isRealHardwareConnected ���?
  if (!bridge?.sendCommand) return false; 
  void bridge.sendCommand(command, payload);
  return true;
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

// export function initializeHardwareStore() {
//   activeConsumers += 1
//   startTelemetry()
//   setState({ connection: 'disconnected', source: 'mock' })
//   void connectRealHardwareIfEnabled()
//   exposeRobotDebugApi()

//   return () => {
//     activeConsumers = Math.max(0, activeConsumers - 1)

//     if (activeConsumers === 0) {
//       clearRunTimers()
//       stopTelemetry()
//       void disconnectRealHardware()
//       setState({
//         connection: 'disconnected',
//         source: 'mock',
//         isRunning: false,
//       })
//     }
//   }
// }

//0319
export function initializeHardwareStore() {
  // 如果当前有正在等待断开的定时器，直接取消它，表示新页面已经接管�??
  if (disconnectionTimer !== null) {
    window.clearTimeout(disconnectionTimer);
    disconnectionTimer = null;
    // 既然连接没断，我们不需要重新增加计数，它已经在那了
    // 但为了逻辑严谨，我们还是增加计�??
  }

  activeConsumers += 1;
  startTelemetry();
  // 只有在没连上的时候才去尝试连�??
  if (!isRealHardwareConnected) {
    void connectRealHardwareIfEnabled();
  }

  return () => {
    activeConsumers = Math.max(0, activeConsumers - 1);

    if (activeConsumers === 0) {
      // --- 关键修改：不再立即断开，而是�?? 2 �?? ---
      disconnectionTimer = window.setTimeout(() => {
        disconnectionTimer = null;
        // 再次确认计数器是否依然为 0（防�?? 2 秒内有新页面进来�??
        if (activeConsumers === 0) {
          console.log("[Store] No consumers left, disconnecting hardware...");
          clearRunTimers();
          stopTelemetry();
          void disconnectRealHardware();
          setState({
            connection: 'disconnected',
            source: 'mock',
            isRunning: false,
          });
        }
      }, 2000); // 2 秒缓冲区，足�?? React 完成页面切换
    }
  };
}

//export function startMockRun(durationMs: number = 6000) {
export function startMockRun(durationMs: number = 6000, obstacleMode: boolean = false) { //0401
  if (typeof window === 'undefined') return

  startTelemetry()
  clearRunTimers()

  //const sentToRealHardware = sendBridgeCommand('AUTO_RUN', { durationMs })
  // 0401--- 核心修改：如果是碰撞模式，发送 O 指令；否则发送正常的 V 指令 ---
  const cmd = obstacleMode ? 'AUTO_RUN_OBSTACLE' : 'AUTO_RUN'
  const sentToRealHardware = sendBridgeCommand(cmd, { durationMs })

  setState({
    connection: sentToRealHardware ? 'connected' : 'disconnected',
    source: sentToRealHardware ? 'hardware' : 'mock',
    isRunning: true,
    temperature: getNextTemperature(true),
    coords: sentToRealHardware ? state.coords : createMovingPoint(),
  })

  if (!sentToRealHardware) {
    runIntervalId = window.setInterval(() => {
      setState({
        coords: createMovingPoint(),
        temperature: getNextTemperature(true),
      })
    }, 450)
  }

  runTimeoutId = window.setTimeout(() => {
    clearRunTimers()
    setState({
      isRunning: false,
      temperature: getNextTemperature(false),
      coords: sentToRealHardware ? state.coords : createMovingPoint(),
    })
  }, durationMs)
}

//0328
// ==========================================
// 新增：Assembly 页面专属软硬连接逻辑
// ==========================================

// 1. 进入示教模式（发 U�?
export const enterTeachMode = () => {
  // �? Bridge.ts �? server.js 中，'UNLOCK' 会被翻译�? 'U' 发给机械�?
  sendBridgeCommand('UNLOCK') 

}

// 2. 原子化记录与获取坐标 (三步�?)
export const triggerAtomicRecord = async (pointCmd: string, frame: string) => {
  // 第一步：发送记录点位指�? (�? 'RECORD_START' 会被翻译�? 'A', 'W' 直接透传)
  sendBridgeCommand(pointCmd)
  
  // 第二步：强制等待 1000 毫秒，让硬件保存数组并稳�? (修复�? wait 报错)
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // 第三步：根据当前参考系，瞬间发�? P �? TP 获取�? mm 单位的坐�?
  if (frame === 'Target') {
    sendBridgeCommand('TP') // 连发 T �? P，使用一次性修饰符
  } else {
    sendBridgeCommand('P')  // 默认获取 Base 坐标
  }
}

//0327
export function triggerCoordinateFlow() {
  // ���� K ָ��
  sendBridgeCommand('TOGGLE_COORD');
}

// === 专门用于 Test Tool 页面的真实硬件测试逻辑 ===
// isCorrectTool: true �?? �?? 'F'（正确路径），false �?? �?? 'G'（错误路径）
export async function startFixedMoveTest(durationMs: number = 6000, isCorrectTool: boolean = true) {
  if (typeof window === 'undefined') return

  startTelemetry()
  clearRunTimers()


  // 根据工具选择决定发送哪个指�??
  const sentToRealHardware = sendBridgeCommand(isCorrectTool ? 'FIXED_MOVE' : 'WRONG_FIXED_MOVE')
  
  //0327
  // if (sentToRealHardware) {
  //   sendBridgeCommand('TOGGLE_COORD')
  // }

  setState({
    connection: sentToRealHardware ? 'connected' : 'disconnected',
    source: sentToRealHardware ? 'hardware' : 'mock',
    isRunning: true,
    temperature: getNextTemperature(true),
    coords: sentToRealHardware ? state.coords : createMovingPoint(),
  })

  // 如果没连上硬件，继续用假数据跑动�??
  if (!sentToRealHardware) {
    runIntervalId = window.setInterval(() => {
      setState({
        coords: createMovingPoint(),
        temperature: getNextTemperature(true),
      })
    }, 450)
  }

  // 动作结束后的清理
  runTimeoutId = window.setTimeout(() => {
    clearRunTimers()
    //0327
    // if (sentToRealHardware) {
    //   // 发�? 'K' 关闭坐标流，节省资源
    //   sendBridgeCommand('TOGGLE_COORD') 
    // }
    setState({
      isRunning: false,
      temperature: getNextTemperature(false),
      coords: sentToRealHardware ? state.coords : createMovingPoint(),
    })
  }, durationMs)
}

export function captureCurrentPoint(): PointData {
  return { ...state.coords }
}

// //0324 �޸� handleRecordPoint �İ�װ�߼���ʹ���ڼ�¼�����ͬʱ����Ӳ��ָ��?
// export function recordPointWithSignal(type: 'pick' | 'drop') {
//   // 1. ��ȡ��ǰ������գ�ԭ���߼���?
//   const point = captureCurrentPoint();

//   // 2. �������ͷ��Ͷ�Ӧ��Ӳ��ָ��
//   if (type === 'pick') {
//     console.log("[Store] Recording Pick Point -> Sending RECORD_START");
//     sendBridgeCommand('RECORD_START'); // Bridge ���Զ�����ת��Ϊ 'A'
//   } else if (type === 'drop') {
//     console.log("[Store] Recording Drop Point -> Sending RECORD_END");
//     sendBridgeCommand('RECORD_END');   // Bridge ���Զ�����ת��Ϊ 'B'
//   }


//   return point;
// }

export function recordPointWithSignal(type: 'pick' | 'drop', setter: (p: PointData) => void) {
  // 1. ����ָ�'A' ��Ӧ Pick, 'B' ��Ӧ Drop
  if (type === 'pick') {
    console.log("[Store] Sending RECORD_START (A)");
    sendBridgeCommand('RECORD_START'); 
  } else {
    console.log("[Store] Sending RECORD_END (B)");
    sendBridgeCommand('RECORD_END');
  }

  if (!bridge) {
    console.warn("[Store] Bridge is null");
    return;
  }

  // 2. �����޸ģ�����һ�����μ�����
  const unsubscribe = bridge.onDataReceived((payload: HardwarePayload) => {
    // ���Ӳ���ش���? Payload ����
    if (payload.type === 'position' && payload.position) {
      console.log(`[Store] Successfully captured ${type} data:`, payload.position);
      
      // ִ�д����? setGrab �� setDrop���������������?
      setter(payload.position);
      
      // �ɹ���ȡ���ݺ�����ȡ�����ģ���ֹ�������ݸ���
      unsubscribe();
    }
  });

  // ��ȫ���ƣ�5�������û�յ����ݣ��Զ��رռ�������ֹ�ڴ�й�?
  setTimeout(unsubscribe, 5000);
}

export async function resetMockRobotToHome() {
  startTelemetry()
  const sentToRealHardware = sendBridgeCommand('RESET_HOME', { target: 'HOME' })

  if (sentToRealHardware) {
    setState({
      source: 'hardware',
      connection: 'connected',
      isRunning: false,
      temperature: getNextTemperature(false),
    })
    return
  }

  setState({
    source: 'mock',
    connection: 'disconnected',
    isRunning: false,
    coords: createPoint(200, 100, 200, 0),
    temperature: getNextTemperature(false),
  })
}

export async function sendMockJogMove(command: JogMoveCommand) {
  startTelemetry()
  const sentToRealHardware = sendBridgeCommand('JOG_MOVE', command as unknown as Record<string, unknown>)

  if (sentToRealHardware) {
    setState({
      source: 'hardware',
      connection: 'connected',
      temperature: getNextTemperature(false),
    })
    return
  }

  setState({
    source: 'mock',
    connection: 'disconnected',
    coords: applyJogMoveToCoords(command),
    temperature: getNextTemperature(false),
  })
}



export function useHardwareStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    ...snapshot,
    captureCurrentPoint,
    //0324
    recordPointWithSignal,
    initializeHardwareStore,
    resetMockRobotToHome,
    sendMockJogMove,
    startMockRun,
    //0330
    sendManualPoint,
  }
}

// =================================================================================
// === Assembly 示教页面专属控制逻辑 ===
// =================================================================================

/**
 * 进入 Assembly 页面时调用：卸力 + 开启坐标回�??
 * 对应前端调用位置：AssemblyModelPage.jsx �?? useEffect([], ...) �??
 */
export async function startAssemblyTeachMode() {
  if (typeof window === 'undefined') return
  startTelemetry()

  sendBridgeCommand('UNLOCK')

  //0324 �ȴ� 200ms ���ٷ��ڶ���ָ���ָֹ��ճ��
  await new Promise(r => setTimeout(r, 1000));

  sendBridgeCommand('UNLOCK')

  await new Promise(r => setTimeout(r, 1000));

  sendBridgeCommand('UNLOCK')

}

//0401 彻底清空底层机械臂的点位记忆（发 C） 仅在刚进入页面，或切换到下一块全新积木时使用
export function clearAssemblyPoints() {
  if (typeof window === 'undefined') return
  sendBridgeCommand('TEACH_START') // Bridge 里已配好 'TEACH_START' 翻译为 'C'
}

//0331 告诉底层主板：当前示教的这条完整路径确认有效，请存入 path_library 数组中
export function saveHardwarePath() {
  sendBridgeCommand('Z')
}

export function sendAssemblyTeachEnable() {
  sendBridgeCommand('TEACH_START')
}

/**
 * 用户�?? UI 上切换坐标系时调�??
 * frame: 'Base' �?? 'Target'
 * 发�? $FRM:0! �?? $FRM:1! �?? ESP32，切换正运动学输出的坐标�??
 */
export function setAssemblyReferenceFrame(frame: 'Base' | 'Target') {
  sendBridgeCommand(frame === 'Base' ? '$FRM:0!' : '$FRM:1!')
}

/**
 * 控制电磁铁开�??
 * isOn: true �?? 继电器上电（有磁力），false �?? 继电器断电（无磁力）
 */
// export function controlAssemblyMagnet(isOn: boolean) {
//   sendBridgeCommand(isOn ? '$MAG:1!' : '$MAG:0!')
// }
export function controlAssemblyMagnet(isOn: boolean) {
  // 0404=== 核心修改：改为发送刚刚在 Bridge 注册的指令 ===
  sendBridgeCommand(isOn ? 'MAGNET_ON' : 'MAGNET_OFF')
}

/**
 * 用于中途打断正在执行的 Assembly 路径
 */
let assemblyAbortController: AbortController | null = null

/**
 * 执行 Assembly 完整运动路径（点�?? CONFIRM & TEST 时调用）
 *
 * @param pick       起点坐标 (PointData)
 * @param waypoints  途径点数�?? (PointData[])，可能为空�?1个或2�??
 * @param drop       终点坐标 (PointData)
 * @param referenceFrame  当前坐标�?? 'Base' | 'Target'
 *
 * 运动序列�??
 *   1. 上力 �?? 2. 移动到起�?? �?? 3. 停留1.5s �?? 4. 电磁铁上�?? �?? 5. �??1.5s
 *   �?? 6. 依次途径�?? �?? 7. 移动到终�?? �?? 8. 停留1.5s �?? 9. 电磁铁断�??
 *
 * 急停信号处理�??
 *   - 无途径�?? + 急停 �?? 发射 ASSEMBLY_REACHED_SPECIFIED_POINT
 *   - 有途径�?? + 急停(终点前或终点�??1s�??) �?? 发射 ASSEMBLY_ESTOP_BEFORE_TARGET
 *   - 有途径�?? + 终点�??1.5s无急停 �?? 正常断电完成
 */
export function executeAssemblyPath(
  pick: PointData,
  waypoints: PointData[],
  drop: PointData,
  referenceFrame: 'Base' | 'Target'
) {
  if (typeof window === 'undefined') return
  startTelemetry()
  setState({ isRunning: true })

  // 如果上次的路径还在执行，先中�??
  if (assemblyAbortController) assemblyAbortController.abort()
  assemblyAbortController = new AbortController()
  const signal = assemblyAbortController.signal
  const hasWaypoints = waypoints.length > 0

  // ---- 急停信号监听�?? ----
  // �?? Bridge 检测到 EmergencyStop.ino 输出�?? "EMERGENCY STOP TRIGGERED" 文本时，
  // 会发�?? RAW_ESTOP_TRIGGERED 事件。我们在这里捕获它，根据有无途径�??
  // 分发给前端同事预留的不同弹窗信号�??
  const estopListener = (eventSignal: string) => {
    if (eventSignal === 'RAW_ESTOP_TRIGGERED') {
      // 立即中止后续运动序列
      if (assemblyAbortController) assemblyAbortController.abort()
      
      // 根据业务逻辑，分发不同信号给前端
      if (!hasWaypoints) {
        // 没有途径�?? �?? 途径点缺失报�??
        hardwareSignalListeners.forEach(l => l(HARDWARE_SIGNALS.ASSEMBLY_REACHED_SPECIFIED_POINT))
      } else {
        // 有途径�?? �?? 方向错误报错
        hardwareSignalListeners.forEach(l => l(HARDWARE_SIGNALS.ASSEMBLY_ESTOP_BEFORE_TARGET))
      }
      setState({ isRunning: false })
    }
  }
  hardwareSignalListeners.add(estopListener)

  // ---- 工具函数 ----
  // 可被 abort 打断的等待函�??
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('ABORTED')) })
  })

  // 坐标字符串转整数（ESP32 �?? kinematics_move 接收整数参数�??
  const parseNum = (val: string) => Math.round(Number(val)) || 0

  // ---- 异步运动序列 ----
  const runSequence = async () => {
    try {
      // 根据坐标系选择指令前缀：Base �?? $KMS，Target �?? $KMT
      const cmdPrefix = referenceFrame === 'Base' ? '$KMS' : '$KMT'

      // 步骤 1：上力（锁定关节�??
      sendBridgeCommand('LOCK')
      await wait(500)

      // 步骤 2：移动到起点 (Pick Point)
      sendBridgeCommand(`${cmdPrefix}:${parseNum(pick.x)},${parseNum(pick.y)},${parseNum(pick.z)},2000!`)
      await wait(2000) // 等待运动完成

      // 步骤 3：到达起点后停留 1.5 �??
      await wait(1500)

      // 步骤 4：电磁铁上电（吸附物品）
      controlAssemblyMagnet(true)

      // 步骤 5：等�?? 1.5 秒让磁铁吸稳
      await wait(1500)

      // 步骤 6：依次移动到途径点（如果有）
      for (const wp of waypoints) {
        if (wp.x !== '') {
          sendBridgeCommand(`${cmdPrefix}:${parseNum(wp.x)},${parseNum(wp.y)},${parseNum(wp.z)},2000!`)
          await wait(2000)
        }
      }

      // 步骤 7：移动到终点 (Drop Point)
      sendBridgeCommand(`${cmdPrefix}:${parseNum(drop.x)},${parseNum(drop.y)},${parseNum(drop.z)},2000!`)
      await wait(2000) // 等待运动完成

      // 步骤 8：到达终点后停留 1.5 秒（这段时间内急停仍然会被捕获�??
      await wait(1500)

      // 步骤 9：正常完�?? �?? 电磁铁断电（释放物品�??
      controlAssemblyMagnet(false)
      
      setState({ isRunning: false })
    } catch (e) {
      // 被急停信号通过 abort 打断，不做任何事
      // estopListener 已经处理了状态更新和信号分发
    } finally {
      // 无论正常完成还是被打断，都清理监听器
      hardwareSignalListeners.delete(estopListener)
    }
  }

  // 启动异步序列（不阻塞�??
  runSequence()
}

//0330
/**
 * �ֶ�����������͸���е��
 * ��ʽ: ָ��:X,Y,Z,Rx!
 */
export function sendManualPoint(type: 'pick' | 'drop' | 'w1' | 'w2', point: PointData, frame: string) {
  const isTarget = frame === 'Target';
  
  // 1. ���ݵ�λ���ͺͲο�ϵȷ��ָ��ǰ׺
  const map = {
    pick: isTarget ? 'TH' : 'H',
    drop: isTarget ? 'TI' : 'I',
    w1: isTarget ? 'TJ' : 'J',
    w2: isTarget ? 'TQ' : 'Q',
  };

  const cmd = map[type];
  
  // 2. ��ʽ�����꣨ȡ��������ȷ��Ӳ�������ȶ���
  const x = Math.round(Number(point.x)) || 0;
  const y = Math.round(Number(point.y)) || 0;
  const z = Math.round(Number(point.z)) || 0;
  const rx = Math.round(Number(point.rx)) || 0;

  // 3. ƴ���ַ���Э��: ָ��:X,Y,Z,Rx!
  const message = `${cmd}:${x},${y},${z},${rx}!`;
  
  // 4. ���õײ�ķ����߼�
  return sendBridgeCommand(message);
}

export function subscribeHardwareSignal(listener: HardwareSignalListener) {
  hardwareSignalListeners.add(listener)
  return () => {
    hardwareSignalListeners.delete(listener)
  }
}

export { HARDWARE_SIGNALS }
