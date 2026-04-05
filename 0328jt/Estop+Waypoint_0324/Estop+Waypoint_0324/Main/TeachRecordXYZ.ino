// =================================================================================
// File: TeachRecordXYZ.ino
// Function: 即时示教系统 (取消 C 和 Y，增加 X 指令，V 指令含磁吸逻辑)
// =================================================================================
#include <math.h>

extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern void smart_delay_with_stop(unsigned long ms);
extern uint8_t current_ref_frame;
extern const float TARGET_OFFSET_Y;
extern const int RELAY_PIN; // 引用继电器引脚
extern bool is_emergency_triggered;

const float FK_L0 = 109.0;  
const float FK_L1 = 105.0;
const float FK_L2 = 87.0;   
const float FK_L3_ACTUAL = 80.0 + 50.0;

// 简化的状态机
enum TeachState {
  STATE_IDLE = 0,
  STATE_TEACHING = 1,
  STATE_READY = 2
};

//0326
extern int final_start_pos[5];
extern int final_end_pos[5];
extern int final_waypoint_pos[2][5];

//0324
extern int current_state; 
extern bool has_start;
extern bool has_end;
extern bool has_w1;
extern bool has_w2;
extern int waypoint_count; // [cite: 341]

void set_torque_all(const char* cmd_suffix) {
  char cmd[16];
  snprintf(cmd, sizeof(cmd), "#255%s!", cmd_suffix);
  all_uart_send_str(cmd);
}

// 坐标转换打印函数 (保持不变)
void print_xyz_from_pwm(int* pwm_array) {
    float pwm0 = pwm_array[0], pwm1 = pwm_array[1], pwm2 = pwm_array[2], pwm3 = pwm_array[3];
    float theta6 = (1500.0 - pwm0) * 270.0 / 2000.0;
    float theta5 = (pwm1 - 1500.0) * 270.0 / 2000.0 + 90.0;
    float theta4 = (pwm2 - 1500.0) * 270.0 / 2000.0;
    float theta3 = (pwm3 - 1500.0) * 270.0 / 2000.0;
    float alpha_deg = theta5 - theta4 + theta3;
    float t6 = theta6 * PI / 180.0, t5 = theta5 * PI / 180.0, t4 = theta4 * PI / 180.0, alpha = alpha_deg * PI / 180.0;
    float r = FK_L1 * cos(t5) + FK_L2 * cos(t5 - t4) + FK_L3_ACTUAL * cos(alpha);
    float z = FK_L0 + FK_L1 * sin(t5) + FK_L2 * sin(t5 - t4) + FK_L3_ACTUAL * sin(alpha);
    float x = r * sin(t6), y = r * cos(t6);

    float out_x = x, out_y = y, out_z = z;
    if (current_ref_frame == 1) out_y = y - TARGET_OFFSET_Y;

    Serial.println("--------------------------------------------------");
    Serial.print(" X: "); Serial.print(out_x, 1);
    Serial.print(" | Y: "); Serial.print(out_y, 1);
    Serial.print(" | Z: "); Serial.print(out_z, 1);
    Serial.print(" | Pitch: "); Serial.print(alpha_deg, 1); Serial.println(" deg");
    Serial.println("--------------------------------------------------");
}

// bool read_and_save(int* buffer) {
//   bool all_success = true;
//   Serial.print(">>> Reading Servos: ");

//   for (int i = 0; i < 5; i++) {
//     int pwm = -1;
//     int retry = 2; // 失败时额外重试 2 次

//     while (pwm < 0 && retry >= 0) {
//       pwm = read_servo_pwm(i, 150); // 增加等待时间至 150ms 提高成功率 [cite: 253, 256]
//       if (pwm < 0) {
//         delay(50); // 避开总线冲突 [cite: 183]
//         retry--;
//       }
//     }

//     if (pwm >= 0) {
//       buffer[i] = pwm;
//       // --- 新增：实时打印每个舵机的角度数值 ---
//       Serial.print("#"); Serial.print(i); 
//       Serial.print("P"); Serial.print(pwm); 
//       if (i < 4) Serial.print(", ");
//     } else {
//       all_success = false;
//       buffer[i] = 1500; // 失败则赋中位值
//       Serial.print("\n[Error] Servo "); Serial.print(i); Serial.println(" Timeout!");
//     }
//   }

//   if (all_success) {
//     Serial.println(" | [OK]");
//     print_xyz_from_pwm(buffer); // 调用现有的坐标转换打印 [cite: 430, 438]
//     return true;
//   } else {
//     Serial.println("\n⚠️ Record FAILED: Some servos did not respond.");
//     return false;
//   }
// }

bool read_and_save(int* buffer) {
  bool all_success = true;
  Serial.print(">>> Recording Status: ");

  for (int i = 0; i < 5; i++) {
    // 尝试读取当前舵机 PWM，超时时间设为 150ms 以应对总线压力
    int pwm = read_servo_pwm(i, 150);

    Serial.print("#"); Serial.print(i); Serial.print(":");
    
    if (pwm >= 0) {
      buffer[i] = pwm;
      Serial.print(pwm); 
    } else {
      all_success = false; 
      buffer[i] = 1500; // 失败时赋予中位安全值 [cite: 443]
      Serial.print("TIMEOUT"); 
    }
    
    if (i < 4) Serial.print(" | "); // 打印分隔符
  }

  Serial.println(); // 换行

  if (all_success) {
    Serial.println("✅ All servos recorded successfully.");
    print_xyz_from_pwm(buffer);
    return true; 
  } else {
    Serial.println("❌ Record FAILED: One or more servos did not respond.");
    return false; 
  }
}

void loop_teach_record() {
  if (Serial.available() > 0) {
    char key = toupper((char)Serial.peek());
    if (key == '\n' || key == '\r') { Serial.read(); return; }

    // 监听 A, B, W, X, V
    if (key == 'A' || key == 'B' || key == 'W' || key == 'X' || key == 'V') {
        Serial.read();
        switch (key) {
          case 'A':
            Serial.println("\n[RECORD] Saving START Point...");
            if (read_and_save(final_start_pos)) {
                has_start = true;
                Serial.println("✅ START saved.");
            }
            break;

          case 'B':
            Serial.println("\n[RECORD] Saving END Point...");
            if (read_and_save(final_end_pos)) {
                has_end = true;
                Serial.println("✅ END saved.");
            }
            break;

            case 'W': 
              Serial.println("\n[RECORD] Waypoint 1 (W)");
              if (read_and_save(final_waypoint_pos[0])) {
                  has_w1 = true;
                  waypoint_count = 1; // 更新计数供存储使用 [cite: 307, 393]
                  Serial.println("✅ W1 saved.");
              }
            break;

          case 'X':
              Serial.println("\n[RECORD] Waypoint 2 (X)");
              if (read_and_save(final_waypoint_pos[1])) {
                  has_w2 = true;
                  waypoint_count = 2; // 更新计数 [cite: 307, 393]
                  Serial.println("✅ W2 saved.");
              }
            break;

          case 'V':
            Serial.println("\n[CMD] Starting Auto Run (V)...");
            if (has_start && has_end) {
                is_emergency_triggered = false;
                set_torque_all("PULR"); // 恢复力矩
                smart_delay_with_stop(500);

                // 1. 移动到起点
                Serial.println(">>> 1. Moving to START...");
                for (int i = 0; i < 5; i++) set_servo(i, final_start_pos[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) goto stop_v;

                // 2. 磁吸上电
                Serial.println(">>> 2. Magnet ON");
                digitalWrite(RELAY_PIN, HIGH);
                smart_delay_with_stop(800);

                // 3. 移动到过渡点 (如果有)
                if (has_w1) {
                    Serial.println(">>> 3. Moving to Waypoint 1...");
                    for (int i = 0; i < 5; i++) set_servo(i, final_waypoint_pos[0][i], 2000);
                    smart_delay_with_stop(2500);
                    if (is_emergency_triggered) goto stop_v;
                }
                if (has_w2) {
                    Serial.println(">>> 4. Moving to Waypoint 2...");
                    for (int i = 0; i < 5; i++) set_servo(i, final_waypoint_pos[1][i], 2000);
                    smart_delay_with_stop(2500);
                    if (is_emergency_triggered) goto stop_v;
                }

                // 4. 移动到终点
                Serial.println(">>> 5. Moving to END...");
                for (int i = 0; i < 5; i++) set_servo(i, final_end_pos[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) goto stop_v;

                // 5. 磁吸断电
                Serial.println(">>> 6. Magnet OFF");
                digitalWrite(RELAY_PIN, LOW);
                smart_delay_with_stop(800);

                Serial.println(">>> 🏁 Sequence Complete!");
                break;

                stop_v:
                Serial.println("\n⚠️ [Aborted] Sequence interrupted.");
                digitalWrite(RELAY_PIN, LOW); // 安全第一，断开磁铁
            } else {
                Serial.println("❌ Error: Missing START or END points!");
            }
            break;
        }
    }
  }
}