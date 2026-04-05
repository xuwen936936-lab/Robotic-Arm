// =================================================================================
// 文件名: FixedMove.ino
// 功能: 预设起点和终点的固定轨迹运动 (适配 5 个舵机: 0-4号)
// 依赖: Main.ino 中的 set_servo, all_uart_send_str
// =================================================================================

// 引用主文件中的变量和函数 (extern 关键字)
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);

// ===================== [参数配置区] =====================
// 在这里修改你的起点和终点舵机数值 (PWM值通常在 500 到 2500 之间，1500 为居中)
// 数组索引 0 到 4 对应机械臂的 0 到 4 号舵机（共5个）

// 1. 设置【起点】舵机角度
const int FIXED_START_POS[5] = {1500, 1500, 1500, 1500, 1500}; 

// 2. 设置【终点】舵机角度
const int FIXED_END_POS[5]   = {1500, 1800, 1200, 1500, 1500}; 

// 3. 设置运动时间 (毫秒) - 值越大，舵机动作越慢越平滑
const int FIXED_MOVE_TIME = 2000; 

// 4. 机械臂到达起点后的停顿等待时间 (毫秒)
const int FIXED_PAUSE_TIME = 1000;
// ========================================================

void loop_fixed_move() {
  // 检查串口是否有数据输入
  if (Serial.available() > 0) {
    // 使用 peek() 查看第一个字符，避免误吞示教功能的按键
    char key = (char)Serial.peek(); 
    
    // 忽略回车换行符
    if (key == '\n' || key == '\r') {
        return; 
    }
    
    key = toupper(key);

    // 如果按下了 'F' 键，触发定点移动逻辑
    if (key == 'F') {
      Serial.read(); // 确认是 'F' 键，正式从串口缓冲区拿走
      Serial.println("\n[指令] 开始执行预设的定点移动 (F)");

      // 发送全局恢复扭矩指令 
      char lock_cmd[16];
      snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
      all_uart_send_str(lock_cmd);
      delay(200); // 等待指令生效

      // ------------------------------------------------
      // 步骤 1：移动到写定的【起点】
      // ------------------------------------------------
      Serial.println(">>> 1. 正在移动到【起点】...");
      // 循环 0 到 4
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_START_POS[i], FIXED_MOVE_TIME);
      }
      
      // 阻塞等待动作执行完成，外加停顿时间
      delay(FIXED_MOVE_TIME + FIXED_PAUSE_TIME);

      // ------------------------------------------------
      // 步骤 2：移动到写定的【终点】
      // ------------------------------------------------
      Serial.println(">>> 2. 正在移动到【终点】...");
      // 循环 0 到 4
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_END_POS[i], FIXED_MOVE_TIME);
      }
      
      // 等待终点动作执行完成
      delay(FIXED_MOVE_TIME);

      Serial.println(">>> 预设移动顺利结束！");
    }
  }
}