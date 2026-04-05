// =================================================================================
// 文件名: FixedMoveWizMag.ino
// 功能: 定点移动并直接控制电磁铁继电器 (单板方案)
//       'F' = 正确路径 (Tool 1)
//       'G' = 错误路径 (其他工具，终点不同)
// =================================================================================

// 引用主文件中的变量和函数 (extern 关键字)
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern void smart_delay_with_stop(unsigned long ms); // 引用急停模块中的智能延时

// ===================== [参数配置区] =====================
// 1. 设置【初始位置】舵机角度 (待机状态，也是最后恢复的位置)
const int FIXED_INIT_POS[5]  = {1500, 1500, 1500, 1500, 1500}; 

// 2. 设置【起点】舵机角度 (电磁铁去抓取的位置) —— 正确和错误路径共用同一个起点
const int FIXED_START_POS[5] = {830, 1262, 2081, 1008, 1500}; 

// 3. 设置【正确终点】舵机角度 (Tool 1 的正确放置位置，按 'F' 触发)
const int FIXED_END_POS[5]   = {1478, 1262, 2081, 1008, 1500}; 

// 4. 设置【错误终点】舵机角度 (其他工具的错误放置位置，按 'G' 触发)
// ★★★ TODO: 测试完毕后填入实际数值 ★★★
const int FIXED_WRONG_END_POS[5] = {1478, 1081, 2096, 1165, 1500}; 

// 5. 设置机械臂单次运动的时间 (毫秒)
const int FIXED_MOVE_TIME = 2000; 

// 6. 电磁铁动作前后的停顿时间 (毫秒) - 设定为 1.5 秒
const int MAGNET_PAUSE_TIME = 1500; 

// 7. 继电器控制引脚 (根据图片，使用 IO13)
const int RELAY_PIN = 13; 
// ========================================================

// 内部函数：执行抓放流程，参数 end_pos 决定使用哪组终点数据
void execute_pick_and_place(const int *end_pos) {
  // 发送全局恢复扭矩指令 (上力)
  char lock_cmd[16];
  snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
  all_uart_send_str(lock_cmd);
  smart_delay_with_stop(200); 

  // 确保电磁铁初始处于断电状态
  digitalWrite(RELAY_PIN, LOW);

  // --- 准备阶段：确保机械臂在初始位置 ---
  Serial.println(">>> 0. Moving to INIT position...");
  for (int i = 0; i < 5; i++) {
    set_servo(i, FIXED_INIT_POS[i], FIXED_MOVE_TIME);
  }
  smart_delay_with_stop(FIXED_MOVE_TIME);

  // 步骤 1：移动到【起点】
  Serial.println(">>> 1. Moving to START...");
  for (int i = 0; i < 5; i++) {
    set_servo(i, FIXED_START_POS[i], FIXED_MOVE_TIME);
  }
  smart_delay_with_stop(FIXED_MOVE_TIME);
  
  Serial.println(">>> Arrived at START, pausing 1.5s...");
  smart_delay_with_stop(MAGNET_PAUSE_TIME);

  // 步骤 2：电磁铁上电
  Serial.println(">>> 2. Electromagnet ON");
  digitalWrite(RELAY_PIN, HIGH);
  smart_delay_with_stop(500);

  // 步骤 3：移动到【终点】(由参数决定是正确终点还是错误终点)
  Serial.println(">>> 3. Moving to END...");
  for (int i = 0; i < 5; i++) {
    set_servo(i, end_pos[i], FIXED_MOVE_TIME);
  }
  smart_delay_with_stop(FIXED_MOVE_TIME);
  
  Serial.println(">>> Arrived at END, pausing 1.5s...");
  smart_delay_with_stop(MAGNET_PAUSE_TIME);

  // 步骤 4：电磁铁断电
  Serial.println(">>> 4. Electromagnet OFF");
  digitalWrite(RELAY_PIN, LOW);
  smart_delay_with_stop(500);

  // 步骤 5：恢复初始位置
  Serial.println(">>> 5. Returning to INIT position...");
  for (int i = 0; i < 5; i++) {
    set_servo(i, FIXED_INIT_POS[i], FIXED_MOVE_TIME);
  }
  smart_delay_with_stop(FIXED_MOVE_TIME);

  Serial.println(">>> Pick-and-place sequence complete!");
}

void loop_fixed_move() {
  // 静态变量：用于确保继电器的初始化代码只执行一次
  static bool is_relay_init = false;
  if (!is_relay_init) {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    is_relay_init = true;
  }

  // 检查串口是否有数据输入
  if (Serial.available() > 0) {
    char key = (char)Serial.peek(); 
    if (key == '\n' || key == '\r') {
        Serial.read();
        return; 
    }
    key = toupper(key);

    // 'F' = 正确路径 (Tool 1 选中时前端发送)
    if (key == 'F') {
      Serial.read();
      Serial.println("\n[CMD] Correct path (F) - Tool 1");
      execute_pick_and_place(FIXED_END_POS);
    }

    // 'G' = 错误路径 (其他工具选中时前端发送)
    if (key == 'G') {
      Serial.read();
      Serial.println("\n[CMD] Wrong path (G) - Wrong tool");
      execute_pick_and_place(FIXED_WRONG_END_POS);
    }

    // 'M' = 电磁铁独立上电 (Magnet ON)
    if (key == 'M') {
      Serial.read(); // 消费掉字符
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("\n[System] Electromagnet forcibly turned ON (M)");
    }

    // 'N' = 电磁铁独立断电 (Magnet OFF)
    if (key == 'N') {
      Serial.read(); // 消费掉字符
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("\n[System] Electromagnet forcibly turned OFF (N)");
    }
  }
}
