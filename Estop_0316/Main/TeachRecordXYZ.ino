// =================================================================================
// File: TeachRecordXYZ.ino
// Function: 智能多点途径记录 (A, B, C, D 直接录制)
// =================================================================================
#include <math.h>

extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern HardwareSerial Serial1; // 用于清理底层冲突垃圾

const float FK_L0 = 109.0; 
const float FK_L1 = 105.0;  
const float FK_L2 = 87.0;   
const float FK_L3_ACTUAL = 80.0 + 50.0;

// 存储 4 个点的数组
int pos_A[5], pos_B[5], pos_C[5], pos_D[5];
// 记录标志位
bool has_A = false, has_B = false, has_C = false, has_D = false;
bool is_teaching = false;

void set_torque_all(const char* cmd_suffix) {
  char cmd[16];
  snprintf(cmd, sizeof(cmd), "#255%s!", cmd_suffix);
  all_uart_send_str(cmd); 
}

void print_xyz_from_pwm(int* pwm_array, const char* point_name) {
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
    
    Serial.println("--------------------------------------------------");
    Serial.print("📍 ["); Serial.print(point_name); Serial.print("] X: "); Serial.print(x, 1);
    Serial.print(" mm | Y: "); Serial.print(y, 1);
    Serial.print(" mm | Z: "); Serial.print(z, 1);
    Serial.print(" mm | Pitch: "); Serial.print(alpha_deg, 1); Serial.println(" deg");
    Serial.println("--------------------------------------------------");
}

// 基于原始架构，加入防冲突保护的读取函数
bool read_all_servos(int* buffer, const char* point_name) {
  Serial.print(">>> Reading "); Serial.print(point_name); Serial.println(" physical joint angles...");
  bool success = true;

  // 【核心防报错】：暴力清空总线上的上一波垃圾响应，然后避让50ms
  while (Serial1.available() > 0) Serial1.read();
  delay(50);

  for (int i = 0; i < 5; i++) {
    int pwm = read_servo_pwm(i, 100);
    if (pwm < 0) {
        delay(30);
        pwm = read_servo_pwm(i, 150); // 给一次重试机会
    }

    if (pwm < 0) {
      Serial.print("Error: Read servo "); Serial.print(i); Serial.println(" failed!");
      success = false; buffer[i] = 1500;
    } else {
      buffer[i] = pwm;
      Serial.print("Joint"); Serial.print(i); Serial.print("="); Serial.print(pwm); Serial.print("  ");
    }
  }
  Serial.println();
  if (success) print_xyz_from_pwm(buffer, point_name);
  return success;
}

void loop_teach_record() {
  if (Serial.available() > 0) {
    char key = toupper((char)Serial.peek());
    if (key == '\n' || key == '\r') {
        Serial.read(); return;
    }

    // 监听 T(开始), A/B/C/D(打点), V(执行)
    if (key == 'T' || key == 'A' || key == 'B' || key == 'C' || key == 'D' || key == 'V') {
        Serial.read();
        switch (key) {
          case 'T': // 【注意】原来的 C 改成了 T (Teach)
            Serial.println("\n[CMD] Start Teaching (T)");
            set_torque_all("PULK");
            is_teaching = true;
            has_A = false; has_B = false; has_C = false; has_D = false; // 清空旧数据
            Serial.println(">>> Unlocked. Manually move to points and press A, B, C, D directly.");
            break;

          case 'A':
            if (is_teaching) {
              Serial.println("\n[CMD] Record Point A (START)");
              if (read_all_servos(pos_A, "Point A")) {
                  has_A = true;
                  Serial.println("\n✅ [OK] Point A saved!");
              }
            } else Serial.println(">>> Error: Press 'T' first.");
            break;

          case 'B':
            if (is_teaching) {
              Serial.println("\n[CMD] Record Point B");
              if (read_all_servos(pos_B, "Point B")) {
                  has_B = true;
                  Serial.println("\n✅ [OK] Point B saved!");
              }
            } else Serial.println(">>> Error: Press 'T' first.");
            break;

          case 'C':
            if (is_teaching) {
              Serial.println("\n[CMD] Record Point C");
              if (read_all_servos(pos_C, "Point C")) {
                  has_C = true;
                  Serial.println("\n✅ [OK] Point C saved!");
              }
            } else Serial.println(">>> Error: Press 'T' first.");
            break;

          case 'D':
            if (is_teaching) {
              Serial.println("\n[CMD] Record Point D");
              if (read_all_servos(pos_D, "Point D")) {
                  has_D = true;
                  Serial.println("\n✅ [OK] Point D saved!");
              }
            } else Serial.println(">>> Error: Press 'T' first.");
            break;

          case 'V':
            Serial.println("\n[CMD] Auto Run (V)");
            // 至少要有A和B才能跑
            if (has_A && has_B) {
              set_torque_all("PULR"); // 锁死舵机
              delay(500);
              
              Serial.println(">>> 1. Moving to Point A...");
              for (int i = 0; i < 5; i++) set_servo(i, pos_A[i], 2000);
              delay(2500);

              Serial.println(">>> 2. Moving to Point B...");
              for (int i = 0; i < 5; i++) set_servo(i, pos_B[i], 2000);
              delay(2500);

              if (has_C) {
                  Serial.println(">>> 3. Moving to Point C...");
                  for (int i = 0; i < 5; i++) set_servo(i, pos_C[i], 2000);
                  delay(2500);
              }

              if (has_D) {
                  Serial.println(">>> 4. Moving to Point D...");
                  for (int i = 0; i < 5; i++) set_servo(i, pos_D[i], 2000);
                  delay(2500);
              }

              Serial.println(">>> 🏁 Run complete!");
            } else {
              Serial.println(">>> Error: You must record at least Point A and Point B.");
            }
            break;
        }
    }
  }
}
