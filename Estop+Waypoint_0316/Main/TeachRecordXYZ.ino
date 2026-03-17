// =================================================================================
// File: TeachRecordXYZ.ino
// Function: Keyboard-controlled teaching with up to 2 Waypoints and XYZ output
// =================================================================================
#include <math.h>

extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern void smart_delay_with_stop(unsigned long ms);

// 引入环境变量
extern uint8_t current_ref_frame;
extern const float TARGET_OFFSET_Y;

const float FK_L0 = 109.0;  
const float FK_L1 = 105.0;  
const float FK_L2 = 87.0;   
const float FK_L3_ACTUAL = 80.0 + 50.0; 

enum TeachState {
  STATE_IDLE,
  STATE_TEACHING,
  STATE_WAIT_CONFIRM_A,
  STATE_WAIT_CONFIRM_B,
  STATE_WAIT_CONFIRM_W, // 新增：等待确认途径点
  STATE_READY
};

TeachState current_state = STATE_IDLE;
int start_pos_buffer[5];
int end_pos_buffer[5];
int waypoint_pos_buffer[2][5]; // 新增：存储最多2个途径点
int temp_waypoint_buffer[5];    // 中转缓冲区

int final_start_pos[5];
int final_end_pos[5];
int final_waypoint_pos[2][5];

bool has_start = false;
bool has_end = false;
int waypoint_count = 0; // 记录已添加的途径点数量

void set_torque_all(const char* cmd_suffix) {
  char cmd[16];
  snprintf(cmd, sizeof(cmd), "#255%s!", cmd_suffix);
  all_uart_send_str(cmd); 
}

// ... print_xyz_from_pwm 函数保持不变 ...
// void print_xyz_from_pwm(int* pwm_array) {
//     float pwm0 = pwm_array[0], pwm1 = pwm_array[1], pwm2 = pwm_array[2], pwm3 = pwm_array[3];
//     float theta6 = (1500.0 - pwm0) * 270.0 / 2000.0;
//     float theta5 = (pwm1 - 1500.0) * 270.0 / 2000.0 + 90.0;
//     float theta4 = (pwm2 - 1500.0) * 270.0 / 2000.0;
//     float theta3 = (pwm3 - 1500.0) * 270.0 / 2000.0;
//     float alpha_deg = theta5 - theta4 + theta3;
//     float t6 = theta6 * PI / 180.0, t5 = theta5 * PI / 180.0, t4 = theta4 * PI / 180.0, alpha = alpha_deg * PI / 180.0;
//     float r = FK_L1 * cos(t5) + FK_L2 * cos(t5 - t4) + FK_L3_ACTUAL * cos(alpha);
//     float z = FK_L0 + FK_L1 * sin(t5) + FK_L2 * sin(t5 - t4) + FK_L3_ACTUAL * sin(alpha);
//     float x = r * sin(t6), y = r * cos(t6);

//     Serial.println("--------------------------------------------------");
//     Serial.print("📍 [Coords] X: "); Serial.print(x, 1);
//     Serial.print(" mm | Y: "); Serial.print(y, 1);
//     Serial.print(" mm | Z: "); Serial.print(z, 1);
//     Serial.print(" mm | Pitch: "); Serial.print(alpha_deg, 1); Serial.println(" deg");
//     Serial.println("--------------------------------------------------");
// }

// 修改这个函数
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

    // --- 核心：根据当前选中的坐标系处理输出结果 ---
    float out_x = x;
    float out_y = y;
    float out_z = z;

    if (current_ref_frame == 1) { // 如果处于 Target 坐标系
        out_y = y - TARGET_OFFSET_Y;
    }

    Serial.println("--------------------------------------------------");
    Serial.print("📍 [Coords] X: "); Serial.print(out_x, 1);
    Serial.print(" mm | Y: "); Serial.print(out_y, 1);
    Serial.print(" mm | Z: "); Serial.print(out_z, 1);
    Serial.print(" mm | Pitch: ");
    Serial.print(alpha_deg, 1); Serial.println(" deg");
    Serial.println("--------------------------------------------------");
}

// ... read_all_servos 函数保持不变 ...
bool read_all_servos(int* buffer) {
  Serial.println(">>> Reading physical joint angles...");
  bool success = true;
  for (int i = 0; i < 5; i++) {
    int pwm = read_servo_pwm(i, 100);
    if (pwm < 0) { delay(20); pwm = read_servo_pwm(i, 100); }
    if (pwm < 0) {
      Serial.print("Error: Read servo "); Serial.print(i); Serial.println(" failed!");
      success = false; buffer[i] = 1500; 
    } else {
      buffer[i] = pwm;
      Serial.print("Joint"); Serial.print(i); Serial.print("="); Serial.print(pwm); Serial.print("  ");
    }
  }
  Serial.println();
  if (success) print_xyz_from_pwm(buffer);
  return success;
}

void loop_teach_record() {
  if (Serial.available() > 0) {
    char key = (char)Serial.peek();
    if (key == '\n' || key == '\r') { Serial.read(); return; }
    key = toupper(key);

    // 允许的按键列表增加了 'W'
    if (key == 'C' || key == 'A' || key == 'Y' || key == 'B' || key == 'N' || key == 'V' || key == 'W') {
        Serial.read(); 
        switch (key) {
          case 'C':
            Serial.println("\n[CMD] Start Teaching (C)");
            set_torque_all("PULK"); 
            current_state = STATE_TEACHING;
            has_start = false; has_end = false; waypoint_count = 0;
            Serial.println(">>> Unlocked. Move to START and press 'A'.");
            break;

          case 'A':
            if (current_state == STATE_TEACHING) {
              Serial.println("\n[CMD] Record START (A)");
              if (read_all_servos(start_pos_buffer)) {
                current_state = STATE_WAIT_CONFIRM_A;
                Serial.println(">>> Press 'Y' to confirm START.");
              }
            } else Serial.println(">>> Error: Press 'C' first.");
            break;

          case 'W': // 新增：记录途径点
            if (current_state == STATE_TEACHING && has_start) {
              if (waypoint_count >= 2) {
                Serial.println("\n [Limit] Waypoint limit is 2 points!");
              } else {
                Serial.print("\n[CMD] Record Waypoint "); Serial.println(waypoint_count + 1);
                if (read_all_servos(temp_waypoint_buffer)) {
                  current_state = STATE_WAIT_CONFIRM_W;
                  Serial.println(">>> Press 'Y' to confirm Waypoint.");
                }
              }
            } else Serial.println(">>> Error: Record START first.");
            break;

          case 'B':
            if (current_state == STATE_TEACHING && has_start) {
              Serial.println("\n[CMD] Record END (B)");
              if (read_all_servos(end_pos_buffer)) {
                current_state = STATE_WAIT_CONFIRM_B;
                Serial.println(">>> Press 'Y' to confirm END.");
              }
            } else Serial.println(">>> Error: Record START first.");
            break;

          case 'Y':
            if (current_state == STATE_WAIT_CONFIRM_A) {
              memcpy(final_start_pos, start_pos_buffer, sizeof(start_pos_buffer));
              has_start = true; current_state = STATE_TEACHING; 
              Serial.println("✅ START saved! Now record Waypoints (W) or END (B).");
            } 
            else if (current_state == STATE_WAIT_CONFIRM_W) {
              memcpy(final_waypoint_pos[waypoint_count], temp_waypoint_buffer, sizeof(temp_waypoint_buffer));
              waypoint_count++;
              current_state = STATE_TEACHING;
              Serial.print("✅ Waypoint "); Serial.print(waypoint_count); Serial.println(" saved!");
            }
            else if (current_state == STATE_WAIT_CONFIRM_B) {
              memcpy(final_end_pos, end_pos_buffer, sizeof(end_pos_buffer));
              has_end = true; set_torque_all("PULR"); current_state = STATE_READY;
              Serial.println("✅ END saved! System Ready for Auto Run (V).");
            }
            break;

          case 'N':
            Serial.println("\n[CMD] Cancel (N)");
            current_state = STATE_TEACHING; // 回到示教状态
            break;
          
          /*
          case 'V':
            Serial.println("\n[CMD] Auto Run (V)");
            if (has_start && has_end) {
              set_torque_all("PULR"); 
              smart_delay_with_stop(500);

              // 1. 移动到起点
              Serial.println(">>> Moving to START...");
              for (int i = 0; i < 5; i++) set_servo(i, final_start_pos[i], 2000);
              smart_delay_with_stop(2500);

              // 2. 移动到途径点（如果有）
              for (int w = 0; w < waypoint_count; w++) {
                Serial.print(">>> Moving to Waypoint "); Serial.println(w + 1);
                for (int i = 0; i < 5; i++) set_servo(i, final_waypoint_pos[w][i], 2000);
                smart_delay_with_stop(2500);
              }

              // 3. 移动到终点
              Serial.println(">>> Moving to END...");
              for (int i = 0; i < 5; i++) set_servo(i, final_end_pos[i], 2000);
              smart_delay_with_stop(2500);

              Serial.println(">>> 🏁 Run complete!");
            } else Serial.println(">>> Error: START and END are required.");
            break;
            */
            case 'V':
              Serial.println("\n[CMD] Auto Run (V)");
              if (has_start && has_end) {
                  is_emergency_triggered = false; // 运行前先重置标志位
                  set_torque_all("PULR"); 
                  smart_delay_with_stop(500);
                  if (is_emergency_triggered) goto stop_run; // 检查是否需要强制跳出

                  // 1. 移动到起点
                  Serial.println(">>> Moving to START...");
                  for (int i = 0; i < 5; i++) set_servo(i, final_start_pos[i], 2000);
                  smart_delay_with_stop(2500);
                  if (is_emergency_triggered) goto stop_run;

                  // 2. 移动到途径点
                  for (int w = 0; w < waypoint_count; w++) {
                      Serial.print(">>> Moving to Waypoint "); Serial.println(w + 1);
                      for (int i = 0; i < 5; i++) set_servo(i, final_waypoint_pos[w][i], 2000);
                      smart_delay_with_stop(2500);
                      if (is_emergency_triggered) goto stop_run;
                  }

                  // 3. 移动到终点
                  Serial.println(">>> Moving to END...");
                  for (int i = 0; i < 5; i++) set_servo(i, final_end_pos[i], 2000);
                  smart_delay_with_stop(2500);
                  if (is_emergency_triggered) goto stop_run;

                  Serial.println(">>> 🏁 Run complete!");
                  break;

                  // 强行终止点
                  stop_run:
                  Serial.println("\n⚠️ [Aborted] Sequence interrupted by Emergency Stop!");
                  // 重置状态，要求用户重新进行路径设置（对应你的要求）
                  has_start = false;
                  has_end = false;
                  waypoint_count = 0;
                  current_state = STATE_IDLE;
                  is_emergency_triggered = false; // 清除标志位，为下次操作准备
              }
              break;
        }
    }
  }
}