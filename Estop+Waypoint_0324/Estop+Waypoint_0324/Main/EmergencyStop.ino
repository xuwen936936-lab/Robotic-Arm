// =================================================================================
// File: EmergencyStop.ino
// Function: NC Emergency Button Logic via GPIO 19. 
//           Stops all motion on press, resets to Vertical Pose (1500) on release.
// =================================================================================

#include <Arduino.h>

#define PIN_STOP 19 // GPIO 19 connected to Pin 12 of the button

// 声明外部变量和函数
extern void all_uart_send_str(char *str);
extern void parse_action(char *action_str);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern uint8_t group_do_ok;
extern bool is_emergency_triggered; // 引用全局标志位

// 初始化急停引脚
void setup_emergency_stop() {
    // 常闭(NC)逻辑：闭合时为LOW (GND)，断开/按下时内部上拉为HIGH
    pinMode(PIN_STOP, INPUT_PULLUP);
}

// 急停检测核心逻辑
void loop_emergency_stop() {
    // 【判断逻辑】：电路断开（按下按钮）触发 HIGH 电平
    if (digitalRead(PIN_STOP) == HIGH) {
        is_emergency_triggered = true;  //标志位置为true
        // 1. 强制阻断正在执行的动作组
        group_do_ok = 1; 

        // 2. 立即向所有舵机发送停止指令
        all_uart_send_str("#000PDST!");
        
        Serial.println("\n[ALERT] !!! EMERGENCY STOP TRIGGERED !!!");
        Serial.println("[STATUS] System locked. Waiting for manual reset...");

        // 3. 进入锁定循环，只要按钮没复位就一直停在这里
        while (digitalRead(PIN_STOP) == HIGH) {
            // 声光报警反馈 (1秒一次)
            beep_on();
            nled_on();
            delay(50);  
            beep_off();
            nled_off();
            delay(950); 
            
            // 喂狗防止重启
            yield(); 
        }

        //0405 4. 按钮复位后的处理逻辑（保持原姿态并等待人为指令）
        Serial.println("\n[SYSTEM] Emergency Stop Released.");
        Serial.println("[ACTION] Recovering torque to hold current posture. Awaiting 'E' command to reset...");

        // A. 仅恢复所有舵机的扭矩 (上力)，确保机械臂不会因为重力掉下来，但不改变位置
        all_uart_send_str("#255PULR!");
        delay(200); 

        // 删除了回中位的代码，直接就绪
        Serial.println("[SYSTEM] System READY. Press 'E' to move to vertical pose.");
    }
}

// 带检测的特殊延时函数
// void smart_delay_with_stop(unsigned long ms) {
//     unsigned long start_time = millis();
//     while (millis() - start_time < ms) {
//         loop_emergency_stop(); 
        
//         if (digitalRead(PIN_STOP) == HIGH) return;
        
//         delay(1); 
//     }
// }

// 0404 修改：软件触发急停的函数，供奇异点模块调用
void trigger_software_emergency(const char* reason) {
    is_emergency_triggered = true;
    group_do_ok = 1; 

    // === 核心修复 1：必须先上力恢复扭矩，才能把软趴趴的手臂瞬间冻结在半空中！ ===
    all_uart_send_str("#255PULR!"); 
    delay(50); // 给舵机 50 毫秒的反应时间
    all_uart_send_str("#000PDST!"); // 然后立刻刹车死锁
    
    Serial.println("\n==================================================");
    Serial.print("[SOFTWARE STOP] Triggered by: "); Serial.println(reason);
    Serial.println("[WARNING] !!! SINGULARITY ZONE DETECTED !!!");
    Serial.println("SIGNAL:ASSEMBLY_SINGULARITY_REACHED");
    Serial.println("==================================================");
}

// 0404 修改 smart_delay_with_stop，确保移动过程中也在监测坐标和奇异点
extern void loop_print_tcp(); // 引用坐标打印/检测函数
extern void loop_servo(); //0405 <--- 新增：引用外部的舵机运动引擎
void smart_delay_with_stop(unsigned long ms) {
    unsigned long start_time = millis();
    while (millis() - start_time < ms) {
        loop_emergency_stop(); 
        loop_print_tcp(); // <--- 核心修改：在移动的间隙持续计算当前坐标并检测奇异点 [cite: 51, 62]
        loop_servo();  //0405 <--- 核心修复 2：在延时的每一毫秒间隙，持续驱动舵机步进！否则机械臂就是瘫痪的。
        
        if (is_emergency_triggered) return; // 无论是物理还是软件触发，立即跳出延时 [cite: 6]
        delay(1); 
    }
}