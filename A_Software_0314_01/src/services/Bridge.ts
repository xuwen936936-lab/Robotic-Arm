/**
 * Bridge — 硬件与 UI 的中间层
 * UI 只依赖本文件定义的接口；硬件层由 hardware/ 实现并注入。
 * 开发阶段可用 createMockBridge() 用模拟数据跑通 UI。
 */

// --- 数据类型（由硬件层上报或 UI 下发）---

/** 设备连接状态 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** 点位数据（如 TCP 坐标、抓取点等） */
export interface PointData {
  x: string
  y: string
  z: string
  rx: string
}

/** 设备状态快照（可选，用于状态栏等） */
export interface DeviceStatus {
  connection: ConnectionStatus
  position?: PointData
  lastError?: string
}

/** 硬件层上报的原始数据（按需扩展字段） */
export interface HardwarePayload {
  type: 'position' | 'status' | 'event'
  position?: PointData
  status?: Partial<DeviceStatus>
  event?: string
  [key: string]: unknown
}

/**
 * Hardware signals for UI workflow triggers.
 *
 * Integration contract for robot-side teammates:
 * - After finishing the pre-programmed Test Tool run, output one line:
 *   SIGNAL:TEST_TOOL_RUN_FINISHED
 * - During Assembly P2 flow (no waypoint), if robot reaches a specified stop/checkpoint
 *   instead of drop point, output one line:
 *   SIGNAL:ASSEMBLY_REACHED_SPECIFIED_POINT
 * - During Assembly direction-error flow (second block), if E-stop is pressed before
 *   reaching final target point, output one line:
 *   SIGNAL:ASSEMBLY_ESTOP_BEFORE_TARGET
 * - This line can come from serial output and will be parsed by the bridge.
 */
export const HARDWARE_SIGNALS = {
  TEST_TOOL_RUN_FINISHED: 'TEST_TOOL_RUN_FINISHED',
  ASSEMBLY_REACHED_SPECIFIED_POINT: 'ASSEMBLY_REACHED_SPECIFIED_POINT',
  ASSEMBLY_ESTOP_BEFORE_TARGET: 'ASSEMBLY_ESTOP_BEFORE_TARGET',
} as const

// --- 硬件层必须实现的接口 ---

export interface IHardwareBridge {
  /** 连接设备 */
  connectDevice(): Promise<void>

  /** 断开连接 */
  disconnectDevice(): Promise<void>

  /** 注册“收到硬件数据”的回调，UI 在此更新状态 */
  onDataReceived(callback: (data: HardwarePayload) => void): () => void

  /** 获取当前连接状态与设备状态（可选） */
  getStatus(): Promise<DeviceStatus>

  /** 下发指令到硬件（如移动、记录点位等，按需扩展） */
  sendCommand?(command: string, payload?: Record<string, unknown>): Promise<void>
}

// --- 模拟实现：便于先用模拟数据跑 UI ---

export function createMockBridge(): IHardwareBridge {
  let listener: ((data: HardwarePayload) => void) | null = null

  const mockPoint = (): PointData => ({
    x: '200.00',
    y: '200.00',
    z: '200.00',
    rx: '200.00',
  })

  return {
    async connectDevice() {
      // 模拟连接成功后可推送一次状态
      await new Promise((r) => setTimeout(r, 300))
      listener?.({
        type: 'status',
        status: { connection: 'connected', position: mockPoint() },
      })
    },

    async disconnectDevice() {
      listener?.({
        type: 'status',
        status: { connection: 'disconnected' },
      })
    },

    onDataReceived(callback: (data: HardwarePayload) => void) {
      listener = callback
      return () => {
        listener = null
      }
    },

    async getStatus(): Promise<DeviceStatus> {
      return {
        connection: 'connected',
        position: mockPoint(),
      }
    },

    async sendCommand(command: string, payload?: Record<string, unknown>) {
      if (command === 'recordPosition') {
        listener?.({
          type: 'position',
          position: payload as unknown as PointData,
        })
      }
    },
  }
}

export function createWebSocketBridge(url: string = 'ws://localhost:8080'): IHardwareBridge {
  let ws: WebSocket | null = null;
  let listener: ((data: HardwarePayload) => void) | null = null;

  return {
    async connectDevice() {
      return new Promise((resolve, reject) => {
        ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log("[Bridge] Connected to Node Gateway");
          // WS connected != serial connected. Real hardware state should come from gateway status.
          listener?.({ type: 'status', status: { connection: 'connecting' } });
          resolve();
        };

        ws.onerror = (err) => {
          console.error("[Bridge] Connection Error", err);
          listener?.({ type: 'status', status: { connection: 'error' } });
          reject(err);
        };

        ws.onclose = () => {
          console.log("[Bridge] Disconnected");
          listener?.({ type: 'status', status: { connection: 'disconnected' } });
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') {
              const statusConnection =
                msg.status?.connection === 'connected'
                  ? 'connected'
                  : msg.status?.connection === 'error'
                    ? 'error'
                    : 'disconnected'

              listener?.({
                type: 'status',
                status: { connection: statusConnection },
              })
              return
            }

            if (msg.type === 'robot_serial' && msg.data) {
              const text = msg.data;

              const signalMatch = text.match(/^SIGNAL:([A-Z0-9_]+)$/)
              if (signalMatch) {
                listener?.({
                  type: 'event',
                  event: signalMatch[1],
                })
                return
              }
              
              // 魔法：在这里拦截并解析串口回传的坐标数据
              // 匹配格式: X: 200.0 mm | Y: 150.0 mm | Z: 100.0 mm | Pitch: 0.0 deg
              const coordMatch = text.match(/X:\s*([-\d.]+)\s*mm\s*\|\s*Y:\s*([-\d.]+)\s*mm\s*\|\s*Z:\s*([-\d.]+)\s*mm\s*\|\s*Pitch:\s*([-\d.]+)\s*deg/);
              
              if (coordMatch) {
                listener?.({
                  type: 'position',
                  position: {
                    x: coordMatch[1],
                    y: coordMatch[2],
                    z: coordMatch[3],
                    rx: coordMatch[4] // 硬件侧的 Pitch 映射为 UI 的 Rx
                  }
                });
              }
            }
            if (msg.type === 'event' && typeof msg.event === 'string') {
              listener?.({ type: 'event', event: msg.event })
            }
          } catch(e) {
            console.error("[Bridge] Parse error", e);
          }
        };
      });
    },

    async disconnectDevice() {
      if (ws) {
        ws.close();
        ws = null;
      }
    },

    onDataReceived(callback: (data: HardwarePayload) => void) {
      listener = callback;
      return () => { listener = null; };
    },

    async getStatus(): Promise<DeviceStatus> {
      return {
        connection: ws?.readyState === WebSocket.OPEN ? 'connected' : 'disconnected'
      };
    },

    async sendCommand(command: string) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // 兼容简易版后端的翻译逻辑，如果你想在前端直接发单词，这里做个拦截映射
        const COMMAND_MAP: Record<string, string> = {
          "UNLOCK": "U", "LOCK": "L", "FIXED_MOVE": "F", "TOGGLE_COORD": "K",
          "TEACH_START": "C", "RECORD_START": "A", "RECORD_END": "B",
          "CONFIRM": "Y", "CANCEL": "N", "AUTO_RUN": "V"
        };
        const mappedCmd = COMMAND_MAP[command] || command;
        ws.send(mappedCmd);
      } else {
        console.warn("[Bridge] Cannot send command, socket not connected.");
      }
    }
  };
}
