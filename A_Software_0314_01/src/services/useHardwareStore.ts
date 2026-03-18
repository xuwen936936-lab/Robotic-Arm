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

// 强制设为 true，连通真实硬件
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
  if (!REAL_HARDWARE_ENABLED || bridge || typeof window === 'undefined') return

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

function sendBridgeCommand(command: string, payload?: Record<string, unknown>) {
  if (!bridge?.sendCommand || !isRealHardwareConnected) return false
  void bridge.sendCommand(command, payload)
  return true
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

export function initializeHardwareStore() {
  activeConsumers += 1
  startTelemetry()
  setState({ connection: 'disconnected', source: 'mock' })
  void connectRealHardwareIfEnabled()
  exposeRobotDebugApi()

  return () => {
    activeConsumers = Math.max(0, activeConsumers - 1)

    if (activeConsumers === 0) {
      clearRunTimers()
      stopTelemetry()
      void disconnectRealHardware()
      setState({
        connection: 'disconnected',
        source: 'mock',
        isRunning: false,
      })
    }
  }
}

export function startMockRun(durationMs: number = 6000) {
  if (typeof window === 'undefined') return

  startTelemetry()
  clearRunTimers()

  const sentToRealHardware = sendBridgeCommand('AUTO_RUN', { durationMs })

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

// === 新增：专门用于 Test Tool 页面的真实硬件测试逻辑 ===
export function startFixedMoveTest(durationMs: number = 6000) {
  if (typeof window === 'undefined') return

  startTelemetry()
  clearRunTimers()

  // 发送 'F' 触发定点移动
  const sentToRealHardware = sendBridgeCommand('FIXED_MOVE')
  
  if (sentToRealHardware) {
    // 发送 'K' 开启坐标实时回传流
    sendBridgeCommand('TOGGLE_COORD')
  }

  setState({
    connection: sentToRealHardware ? 'connected' : 'disconnected',
    source: sentToRealHardware ? 'hardware' : 'mock',
    isRunning: true,
    temperature: getNextTemperature(true),
    coords: sentToRealHardware ? state.coords : createMovingPoint(),
  })

  // 如果没连上硬件，继续用假数据跑动画
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
    if (sentToRealHardware) {
      // 发送 'K' 关闭坐标流，节省资源
      sendBridgeCommand('TOGGLE_COORD') 
    }
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

// === 终极修复版：解决严格模式报错和变量作用域问题 ===
export function startFixedMoveTest(durationMs: number = 6000) {
  if (typeof window === 'undefined') return

  startTelemetry()

  // 1. 发送硬件指令
  const sentToRealHardware = sendBridgeCommand('FIXED_MOVE')
  if (sentToRealHardware) {
    sendBridgeCommand('TOGGLE_COORD')
  }

  // 2. 更新启动状态 (注意：这里更正为了同事定义的 createPoint)
  setState({
    connection: state.connection, 
    source: sentToRealHardware ? 'hardware' : 'mock',
    isRunning: true,
    temperature: getNextTemperature(true),
    coords: sentToRealHardware ? state.coords : createPoint(), 
  })

  // 3. Mock 模式的本地安全定时器 (必须加 const)
  if (!sentToRealHardware) {
    const mockIntervalId = window.setInterval(() => {
      setState({
        coords: createPoint(),
        temperature: getNextTemperature(true),
      })
    }, 450)

    // 运行结束后清理动画
    window.setTimeout(() => {
      window.clearInterval(mockIntervalId)
    }, durationMs)
  }

  // 4. 运行结束后的状态重置与信号分发 (必须加 const)
  const timeoutId = window.setTimeout(() => {
    if (sentToRealHardware) {
      sendBridgeCommand('TOGGLE_COORD')
      // 兼容新架构：广播完成信号
      hardwareSignalListeners.forEach((listener) =>
        listener(HARDWARE_SIGNALS.TEST_TOOL_RUN_FINISHED)
      )
    }
    
    setState({
      isRunning: false,
      temperature: getNextTemperature(false),
      coords: sentToRealHardware ? state.coords : createPoint(),
    })
  }, durationMs)
}

export function useHardwareStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    ...snapshot,
    captureCurrentPoint,
    initializeHardwareStore,
    resetMockRobotToHome,
    sendMockJogMove,
    startMockRun,
    startFixedMoveTest, // <--- 就是在这里加上这一行！把它暴露给外部使用
  }
}

export function subscribeHardwareSignal(listener: HardwareSignalListener) {
  hardwareSignalListeners.add(listener)
  return () => {
    hardwareSignalListeners.delete(listener)
  }
}

export { HARDWARE_SIGNALS }
