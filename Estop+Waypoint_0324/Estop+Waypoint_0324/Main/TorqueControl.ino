// // =================================================================================
// // 文件名: TorqueControl.ino
// // 功能: 独立快捷键控制机械臂整体卸力(U)与上力(L)
// // =================================================================================

// // 引用主文件中的全局发送函数
// extern void all_uart_send_str(char *str);

// void loop_torque_control() {
//     // 检查串口是否有数据输入
//     if (Serial.available() > 0) {
//         // 使用 peek() 查看第一个字符，如果不属于这里的指令，留给其他模块处理
//         char key = (char)Serial.peek(); 
        
//         // 忽略回车换行符
//         if (key == '\n' || key == '\r') {
//             Serial.read(); // 把垃圾字符吞掉
//             return; 
//         }
        
//         // 统一转换为大写
//         key = toupper(key);

//         // 如果按下了 'U' 或 'L' 键，正式消费这个字符并执行对应动作
//         if (key == 'U' || key == 'L') {
//             Serial.read(); // 把字符从串口缓冲区拿走
            
//             char lock_cmd[16];

//             if (key == 'U') {
//                 Serial.println("\n[指令] 机械臂已手动卸力 (U) - 现在可以自由拖拽");
//                 // 发送 #255PULK! 全体卸力指令
//                 snprintf(lock_cmd, sizeof(lock_cmd), "#255PULK!");
//                 all_uart_send_str(lock_cmd);
//             } 
//             else if (key == 'L') {
//                 Serial.println("\n[指令] 机械臂已手动上力 (L) - 关节已锁定");
//                 // 发送 #255PULR! 全体恢复扭矩指令
//                 snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
//                 all_uart_send_str(lock_cmd);
//             }
//         }
//     }
// }

// =================================================================================
// 文件名: TorqueControl.ino
// 修改：按下 'U' 时自动初始化示教状态，替代原有的 'C' 指令
// =================================================================================

#include <Arduino.h>

extern void all_uart_send_str(char *str);

// 0404 === 新增：引用电磁铁继电器的引脚 ===
extern const int RELAY_PIN;

//0324
extern int current_state;
extern bool has_start;
extern bool has_end;
extern bool has_w1;
extern bool has_w2;

void loop_torque_control() {
    if (Serial.available() > 0) {
        char key = (char)Serial.peek();
        if (key == '\n' || key == '\r') {
            Serial.read();
            return;
        }
        
        key = toupper(key);
        // if (key == 'U' || key == 'L') {
        //     Serial.read();
        //     char lock_cmd[16];

        //     if (key == 'U') {
        //         Serial.println("\n[指令] 机械臂已卸力 (U) - 示教模式已开启");
        //         // --- 新增：初始化示教状态 ---
        //         has_start = false; 
        //         has_end = false;
        //         has_w1 = false;
        //         has_w2 = false;
        //         current_state = 1; // 设为 STATE_TEACHING (1)

        //         snprintf(lock_cmd, sizeof(lock_cmd), "#255PULK!");
        //         all_uart_send_str(lock_cmd);
        //         Serial.println(">>> 状态已重置。请移动机械臂并按 A(起点), B(终点), W(过渡1), X(过渡2)");
        //     } 
        //     else if (key == 'L') {
        //         Serial.println("\n[指令] 机械臂已上力 (L)");
        //         snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
        //         all_uart_send_str(lock_cmd);
        //     }
        // }
        if (key == 'U' || key == 'L') {
            Serial.read();
            char lock_cmd[16];

            if (key == 'U') {
                Serial.println("\n[指令] 机械臂已卸力 (U) - 允许重新拖拽微调");
                // --- 核心修改：删除了这里的清空状态代码，只保留模式切换 ---
                current_state = 1; // 设为 STATE_TEACHING (1)

                // 0404 === 就是加下面这一行！重新武装报警器！ ===
                is_emergency_triggered = false;

                snprintf(lock_cmd, sizeof(lock_cmd), "#255PULK!");
                all_uart_send_str(lock_cmd);
                Serial.println(">>> 仅卸力，不丢失已有记录点位。");
            } else {
                Serial.println("\n[指令] 机械臂已锁定 (L)");
                current_state = 2; 
                snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
                all_uart_send_str(lock_cmd);
            }
        }
        // --- 新增：独立的 C 指令，专门用于彻底清空点位记忆 ---
        else if (key == 'C') {
            Serial.read();
            Serial.println("\n[指令] 点位缓存已彻底清空 (C) - 准备全新的示教");
            has_start = false; 
            has_end = false;
            has_w1 = false;
            has_w2 = false;
            current_state = 1; 
        }
        // 0404=== 核心新增：独立的 M / N 指令，控制电磁铁手动开关 ===
        else if (key == 'M') {
            Serial.read();
            Serial.println("\n[指令] 电磁铁手动上电吸附 (M)");
            digitalWrite(RELAY_PIN, HIGH);
        }
        else if (key == 'N') {
            Serial.read();
            Serial.println("\n[指令] 电磁铁手动断电松开 (N)");
            digitalWrite(RELAY_PIN, LOW);
        }
        //0405 === 新增：独立的 E 指令，用于急停释放后或任意时刻的机械臂姿态复位 ===
        else if (key == 'E') {
            Serial.read(); // 消费掉字符
            Serial.println("\n[指令] 执行归位程序 (E) - 正在回归竖直构型...");
            
            // 声明外部函数
            extern void set_servo(int servo_index, int pwm_value, int move_time);
            
            // 确保先恢复力矩
            all_uart_send_str("#255PULR!");
            delay(200);
            
            // 0-5 号舵机回到 1500 中位，移动时间 2 秒
            for (int i = 0; i < 6; i++) {
                set_servo(i, 1500, 2000);
            }
            Serial.println("[System] 复位指令已下发，预计 2 秒后完成。");
        }
    }
}
