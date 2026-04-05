// =================================================================================
// 文件名: TeachRecord.ino
// 功能: 实现键盘控制的机械臂示教再现功能 (示教记录)
// 版本: v1.0 Perfect Edition
// 依赖: Main.ino 中的 read_servo_pwm, set_servo, all_uart_send_str
// =================================================================================

// 引用主文件中的变量和函数 (extern 关键字)
extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);

// 定义示教状态枚举
enum TeachState {
  STATE_IDLE,          // 空闲状态
  STATE_TEACHING,      // 示教模式中（舵机已卸力）
  STATE_WAIT_CONFIRM_A, // 等待确认起点
  STATE_WAIT_CONFIRM_B, // 等待确认终点
  STATE_READY          // 示教完成，准备运行
};

// 全局变量
TeachState current_state = STATE_IDLE;
int start_pos_buffer[6];  // 起点缓存
int end_pos_buffer[6];    // 终点缓存
int final_start_pos[6];   // 确认后的起点
int final_end_pos[6];     // 确认后的终点
bool has_start = false;   // 是否已记录起点
bool has_end = false;     // 是否已记录终点

// 辅助函数：批量发送总线指令（卸力/上力）
// cmd_suffix: "PULK" (Unlock/卸力) 或 "PULR" (Lock/Run/恢复扭矩)
void set_torque_all(const char* cmd_suffix) {
  char cmd[16];
  // 使用广播ID 255 控制所有舵机
  snprintf(cmd, sizeof(cmd), "#255%s!", cmd_suffix);
  all_uart_send_str(cmd); 
  Serial.print(">>> 发送总线指令: ");
  Serial.println(cmd);
}

// 辅助函数：读取所有舵机位置到缓冲区
bool read_all_servos(int* buffer) {
  Serial.println(">>> 正在读取所有舵机位置...");
  bool success = true;
  for (int i = 0; i < 5; i++) {
    // 调用主文件的读取函数，超时100ms
    int pwm = read_servo_pwm(i, 100); 
    if (pwm < 0) {
      Serial.print("错误: 读取舵机 "); Serial.print(i); Serial.println(" 失败!");
      success = false;
      buffer[i] = 1500; // 失败时的默认值，防止数组未初始化
    } else {
      buffer[i] = pwm;
      Serial.print("舵机"); Serial.print(i); Serial.print("="); Serial.print(pwm); Serial.print(" ");
    }
  }
  Serial.println();
  return success;
}

// 核心功能：处理键盘输入 (主循环调用)
void loop_teach_record() {
  if (Serial.available() > 0) {
    char key = (char)Serial.read();
    // 忽略回车换行符
    if (key == '\n' || key == '\r') return;
    
    // 转大写，方便输入
    key = toupper(key);

    switch (key) {
      // ---------------- Key C: 开始示教 (卸力) ----------------
      case 'C':
        Serial.println("\n[指令] 开始示教 (C)");
        // 发送 #255PULK! 全体卸力
        set_torque_all("PULK"); 
        current_state = STATE_TEACHING;
        has_start = false;
        has_end = false;
        Serial.println(">>> 机械臂已卸力，请手动拖拽到【起点】位置。");
        Serial.println(">>> 摆好后按 'A' 记录起点。");
        break;

      // ---------------- Key A: 设置起点 ----------------
      case 'A':
        if (current_state == STATE_TEACHING) {
          Serial.println("\n[指令] 设置起点 (A)");
          if (read_all_servos(start_pos_buffer)) {
            current_state = STATE_WAIT_CONFIRM_A;
            Serial.println(">>> 起点数据已读取。请按 'Y' 确认，或按 'N' 取消。");
          } else {
            Serial.println(">>> 读取失败，请检查连线后重试 'A'。");
          }
        } else {
          Serial.println(">>> 错误：请先按 'C' 进入示教模式。");
        }
        break;

      // ---------------- Key Y: 确认 ----------------
      case 'Y':
        if (current_state == STATE_WAIT_CONFIRM_A) {
          // 确认起点
          memcpy(final_start_pos, start_pos_buffer, sizeof(start_pos_buffer));
          has_start = true;
          current_state = STATE_TEACHING; // 回到示教模式，继续拖动
          Serial.println("\n[确认] 起点已保存！");
          Serial.println(">>> 请继续手动拖拽到【终点】位置。");
          Serial.println(">>> 摆好后按 'B' 记录终点。");
        } 
        else if (current_state == STATE_WAIT_CONFIRM_B) {
          // 确认终点
          memcpy(final_end_pos, end_pos_buffer, sizeof(end_pos_buffer));
          has_end = true;
          // 发送 #255PULR! 全体恢复扭矩
          set_torque_all("PULR");
          current_state = STATE_READY;
          Serial.println("\n[确认] 终点已保存！");
          Serial.println(">>> 机械臂已上电锁定。");
          Serial.println(">>> 现在可以按 'V' 开始自动运行。");
        } 
        else {
          Serial.println(">>> 当前无需确认。");
        }
        break;

      // ---------------- Key B: 设置终点 ----------------
      case 'B':
        if (current_state == STATE_TEACHING) {
          if (!has_start) {
            Serial.println(">>> 错误：请先设置并确认起点 (A -> Y)。");
            return;
          }
          Serial.println("\n[指令] 设置终点 (B)");
          if (read_all_servos(end_pos_buffer)) {
            current_state = STATE_WAIT_CONFIRM_B;
            Serial.println(">>> 终点数据已读取。请按 'Y' 确认，或按 'N' 取消。");
          } else {
            Serial.println(">>> 读取失败，请重试 'B'。");
          }
        } else {
          Serial.println(">>> 错误：请先进入示教模式或确认起点。");
        }
        break;

      // ---------------- Key N: 取消/重置 ----------------
      case 'N':
        Serial.println("\n[指令] 取消/重置 (N)");
        
        // 情况 1：正在等待确认【起点】 -> 仅取消本次记录，回到拖拽状态
        if (current_state == STATE_WAIT_CONFIRM_A) {
            current_state = STATE_TEACHING; // 回到示教模式
            Serial.println(">>> 已取消【起点】设置。"); 
            Serial.println(">>> 机械臂保持卸力，请重新调整位置后按 'A'。");
        }
        // 情况 2：正在等待确认【终点】 -> 仅取消本次记录，保留起点，回到拖拽状态
        else if (current_state == STATE_WAIT_CONFIRM_B) {
            current_state = STATE_TEACHING; // 回到示教模式
            Serial.println(">>> 已取消【终点】设置（起点数据已保留）。");
            Serial.println(">>> 机械臂保持卸力，请重新调整位置后按 'B'。");
        }
        // 情况 3：其他状态（如空闲、运行后、或示教中途想全重置） -> 全局重置
        else {
            // 恢复扭矩，防止摔机
            set_torque_all("PULR");
            current_state = STATE_IDLE;
            has_start = false;
            has_end = false;
            Serial.println(">>> 系统已【完全重置】。所有数据清除，按 'C' 重新开始。");
        }
        break;

      // ---------------- Key V: 自动运行 ----------------
      case 'V':
        Serial.println("\n[指令] 开始自动运行 (V)");
        if (has_start && has_end) {
          // 确保有扭矩
          set_torque_all("PULR"); 
          delay(500);

          Serial.println(">>> 1. 移动到起点...");
          for (int i = 0; i < 5; i++) {
            // 调用主文件的 set_servo, 设定时间 2000ms
            set_servo(i, final_start_pos[i], 2000); 
          }
          // 等待运动完成 (2000ms + 缓冲)
          delay(2500); 

          Serial.println(">>> 2. 移动到终点...");
          for (int i = 0; i < 5; i++) {
            set_servo(i, final_end_pos[i], 2000);
          }
          delay(2500);

          Serial.println(">>> 运行结束！");
        } else {
          Serial.println(">>> 错误：起点或终点未设置。请按 'C' 重新示教。");
        }
        break;
        
      default:
        // 忽略其他按键，避免干扰
        break;
    }
  }
}
