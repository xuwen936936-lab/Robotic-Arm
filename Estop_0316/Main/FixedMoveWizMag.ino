// =================================================================================
// 文件名: FixedMoveWizMag.ino
// 功能: 定点移动并直接控制电磁铁继电器 (单板方案)
// =================================================================================

// 引用主文件中的变量和函数 (extern 关键字)
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);

// ===================== [参数配置区] =====================
// 1. 设置【初始位置】舵机角度 (待机状态，也是最后恢复的位置)
const int FIXED_INIT_POS[5]  = {1500, 1500, 1500, 1500, 1500}; 

// 2. 设置【起点】舵机角度 (电磁铁去抓取的位置)
const int FIXED_START_POS[5] = {1500, 1500, 1500, 1500, 1500}; 

// 3. 设置【终点】舵机角度 (电磁铁放置的位置)
const int FIXED_END_POS[5]   = {1500, 1800, 1200, 1500, 1500}; 

// 4. 设置机械臂单次运动的时间 (毫秒)
const int FIXED_MOVE_TIME = 2000; 

// 5. 电磁铁动作前后的停顿时间 (毫秒) - 设定为 1.5 秒
const int MAGNET_PAUSE_TIME = 1500; 

// 6. 继电器控制引脚 (根据图片，使用 IO13)
const int RELAY_PIN = 13; 
// ========================================================

void loop_fixed_move() {
  // 静态变量：用于确保继电器的初始化代码只执行一次
  static bool is_relay_init = false;
  if (!is_relay_init) {
    // 这里强制将 13 号引脚设为输出模式，覆盖 Main.ino 中的输入模式设置
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // 初始默认断电无磁力
    is_relay_init = true;
  }

  // 检查串口是否有数据输入
  if (Serial.available() > 0) {
    char key = (char)Serial.peek(); 
    if (key == '\n' || key == '\r') {
        Serial.read(); // 把垃圾字符吞掉
        return; 
    }
    key = toupper(key);

    // 触发按键 'F'
    if (key == 'F') {
      Serial.read(); // 正式从串口缓冲区拿走字符
      Serial.println("\n[指令] 开始执行单板定点抓放流程 (F)");

      // 发送全局恢复扭矩指令 (上力)
      char lock_cmd[16];
      snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
      all_uart_send_str(lock_cmd);
      delay(200); 

      // 确保电磁铁初始处于断电状态
      digitalWrite(RELAY_PIN, LOW);

      // --- 准备阶段：确保机械臂在初始位置 ---
      Serial.println(">>> 0. 准备：正在前往【初始位置】...");
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_INIT_POS[i], FIXED_MOVE_TIME);
      }
      delay(FIXED_MOVE_TIME); // 阻塞等待机械臂走到初始位置

      // ------------------------------------------------
      // 步骤 1：从初始位置移动到【起点】
      // ------------------------------------------------
      Serial.println(">>> 1. 正在移动到【起点】...");
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_START_POS[i], FIXED_MOVE_TIME);
      }
      delay(FIXED_MOVE_TIME); // 阻塞等待机械臂走到起点
      
      // 停顿 1.5 秒
      Serial.println(">>> 到达起点，停顿 1.5 秒...");
      delay(MAGNET_PAUSE_TIME);

      // ------------------------------------------------
      // 步骤 2：电磁铁上电有磁力
      // ------------------------------------------------
      Serial.println(">>> 2. 电磁铁【上电】 (吸取)");
      digitalWrite(RELAY_PIN, HIGH);
      delay(500); // 给 0.5 秒缓冲时间让磁铁吸稳物品

      // ------------------------------------------------
      // 步骤 3：保持上电，移动到【终点】
      // ------------------------------------------------
      Serial.println(">>> 3. 正在移动到【终点】...");
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_END_POS[i], FIXED_MOVE_TIME);
      }
      delay(FIXED_MOVE_TIME); // 阻塞等待机械臂走到终点
      
      // 停顿 1.5 秒
      Serial.println(">>> 到达终点，停顿 1.5 秒...");
      delay(MAGNET_PAUSE_TIME);

      // ------------------------------------------------
      // 步骤 4：电磁铁断电无磁力
      // ------------------------------------------------
      Serial.println(">>> 4. 电磁铁【断电】 (释放)");
      digitalWrite(RELAY_PIN, LOW);
      delay(500); // 给 0.5 秒缓冲时间让物品自然掉落

      // ------------------------------------------------
      // 步骤 5：保持断电，恢复【初始位置】
      // ------------------------------------------------
      Serial.println(">>> 5. 正在恢复到【初始位置】...");
      for (int i = 0; i < 5; i++) {
        set_servo(i, FIXED_INIT_POS[i], FIXED_MOVE_TIME);
      }
      delay(FIXED_MOVE_TIME); // 阻塞等待复位完成

      Serial.println(">>> 抓放完整流程顺利结束！");
    }
  }
}
