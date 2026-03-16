// // =================================================================================
// // 文件名: EmergencyStop.ino
// // 功能: 处理常闭(NC)急停按钮逻辑，实现“假断电”效果
// // =================================================================================

// #define PIN_STOP 19 // 使用 GPIO 19

// // 声明外部变量和函数（引用 main.ino 或其他模块中的功能）
// extern void all_uart_send_str(char *str);
// extern void parse_action(char *action_str);
// extern uint8_t group_do_ok;
// //extern void nled_on();
// //extern void nled_off();
// //extern void beep_on();
// //extern void beep_off();

// // 初始化急停引脚
// void setup_emergency_stop() {
//     // 必须使用 INPUT_PULLUP，确保按钮断开时引脚电平稳定为 HIGH
//     pinMode(PIN_STOP, INPUT_PULLUP);
// }

// // 急停检测核心逻辑
// void loop_emergency_stop() {
//     // 【判断逻辑】：常闭触点断开（按下）时，电平跳变为 HIGH
//     if (digitalRead(PIN_STOP) == HIGH) {
        
//         // 1. 强制阻断动作组运行标志位
//         group_do_ok = 1; 

//         // 2. 发送全总线停止指令 (使用 #000 广播 ID 或 #255)
//         // 根据你的要求发送 #000PDST!
//         all_uart_send_str("#000PDST!");
        
//         Serial.println("\n[ALERT] !!! EMERGENCY STOP TRIGGERED !!!");

//         // 3. 进入锁定循环，直到按钮复位（重新闭合为 LOW）
//         while (digitalRead(PIN_STOP) == HIGH) {
//             // 报警声反馈
//             //beep_on();
//             nled_on();
//             delay(100);
//             //beep_off();
//             nled_off();
//             delay(100);
            
//             // 喂狗防止 ESP32 触发看门狗重启（如果启用了看门狗）
//             yield(); 
//         }

//         // 4. 按钮复位后的处理
//         Serial.println("[SYSTEM] Emergency Stop Released. System Ready.");
//     }
// }

// // 一个在延时过程中也能监测急停的特殊函数
// void smart_delay_with_stop(unsigned long ms) {
//     unsigned long start_time = millis();
//     while (millis() - start_time < ms) {
//         // 在延时期间，每毫秒都检查一次急停引脚
//         loop_emergency_stop(); 
        
//         // 如果急停被触发并进入了 while 循环，当它跳出来时，
//         // 我们应该直接退出这个延时，不再执行后续动作
//         if (digitalRead(PIN_STOP) == HIGH) return;
        
//         delay(1); // 喘息 1ms
//     }
// }

// =================================================================================
// File: EmergencyStop.ino
// Function: NC Emergency Button Logic via GPIO 19. 
//           Stops all motion on press, resets to Vertical Pose (1500) on release.
// =================================================================================

#include <Arduino.h>

#define PIN_STOP 19 // GPIO 19 connected to Pin 12 of the button

// External references from main.ino and other modules
extern void all_uart_send_str(char *str);
extern void parse_action(char *uart_receive_buf);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern uint8_t group_do_ok;

void setup_emergency_stop() {
    // NC logic: Button closed = LOW (GND), Button pressed/open = HIGH (Internal Pull-up)
    pinMode(PIN_STOP, INPUT_PULLUP);
}

void loop_emergency_stop() {
    // Check if the emergency button is pressed (Circuit Open -> HIGH)
    if (digitalRead(PIN_STOP) == HIGH) {
        
        // 1. Force stop current action group logic
        group_do_ok = 1;

        // 2. Broadcast Stop command to all servos
        all_uart_send_str("#000PDST!");
        
        Serial.println("\n[ALARM] !!! EMERGENCY STOP TRIGGERED !!!");
        Serial.println("[STATUS] System locked. Waiting for reset...");

        // 3. Lock the system while the button is pressed
        while (digitalRead(PIN_STOP) == HIGH) {
            beep_on();
            nled_on();
            delay(50);  // Short beep
            beep_off();
            nled_off();
            delay(950); // Beep once per second
            
            // Clear Serial buffer to prevent overflow during lock
            if (Serial.available()) Serial.read(); 
        }

        // 4. Recovery logic after button release
        Serial.println("\n[RESET] Emergency button released.");
        Serial.println("[ACTION] Recovering torque and moving to VERTICAL pose...");

        // A. Restore torque to all servos
        all_uart_send_str("#255PULR!"); 
        delay(200); 

        // B. Command all 6 joints to return to middle position (1500us)
        // Adjust the move_time (2000ms) as needed for safety
        for (int i = 0; i < 6; i++) {
            set_servo(i, 1500, 2000); 
        }

        // C. Wait for the reset movement to complete
        delay(2000); 
        
        Serial.println("[SYSTEM] Reset complete. System READY.");
    }
}