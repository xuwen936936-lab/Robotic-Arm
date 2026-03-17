# hardware/

硬件通讯逻辑目录，由负责硬件的同学实现。

## 约定

- 实现 `src/services/Bridge.ts` 中定义的 **`IHardwareBridge`** 接口。
- 接口方法包括：
  - `connectDevice()`：连接设备
  - `disconnectDevice()`：断开连接
  - `onDataReceived(callback)`：注册“收到硬件数据”的回调
  - `getStatus()`：返回当前设备/连接状态
  - （可选）`sendCommand(command, payload)`：下发指令

UI 通过 `services/Bridge` 的接口调用硬件能力，本目录提供真实实现并注入到应用（例如在 `main.tsx` 或上层 Provider 中替换 `createMockBridge()`）。

## UI workflow signals

以下信号用于触发 UI 中的流程弹窗（由硬件/网关上报，前端在 `src/services/Bridge.ts` 解析）。

### 1) P1: Test Tool program finished

- Signal name: `TEST_TOOL_RUN_FINISHED`
- Trigger timing:
  - Test Tool 页发起测试后
  - 预设程序运行完成时发送
- Purpose:
  - 通知 UI 进入 Test Tool 结果判定（包含 P1 提示链路）

### 2) P2: Assembly reached specified point (not drop)

- Signal name: `ASSEMBLY_REACHED_SPECIFIED_POINT`
- Trigger timing:
  - Assembly 第二块流程运行中
  - 无 waypoint 场景下，机械臂到达“指定位置/停止点”而非 drop point 时发送
- Purpose:
  - 触发 P2（waypoint 不足）碰撞提示 toast + 右下角提示入口 + 对应弹窗

### 3) Direction error: E-stop before final target (block 2)

- Signal name: `ASSEMBLY_ESTOP_BEFORE_TARGET`
- Trigger timing:
  - Assembly 第二块流程运行中
  - TCP 尚未到达最终目标点，且通过急停按钮触发停止运动时发送
- Purpose:
  - 触发方向错误提示弹窗（Wrong Direction，对应 direction 流程）

### Sending format (either one is supported)

1. Serial line text (recommended for MCU -> gateway):
   - `SIGNAL:TEST_TOOL_RUN_FINISHED`
   - `SIGNAL:ASSEMBLY_REACHED_SPECIFIED_POINT`
   - `SIGNAL:ASSEMBLY_ESTOP_BEFORE_TARGET`

2. WebSocket JSON event (gateway -> frontend):
   - `{"type":"event","event":"TEST_TOOL_RUN_FINISHED"}`
   - `{"type":"event","event":"ASSEMBLY_REACHED_SPECIFIED_POINT"}`
   - `{"type":"event","event":"ASSEMBLY_ESTOP_BEFORE_TARGET"}`
