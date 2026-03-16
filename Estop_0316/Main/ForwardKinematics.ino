#include <math.h>

extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);

const float L0 = 109.0, L1 = 105.0, L2 = 87.0, L3_BASE = 80.0;
const float END_EFFECTOR_OFFSET = 50.0; 

void loop_print_tcp() {
    static unsigned long last_print_time = 0;
    static bool is_printing = false;

    if (Serial.available() > 0) {
        char key = toupper((char)Serial.peek());
        
        // -----------------------------------------------------
        // 🐛 修复处：加上了大括号，确保只有遇到回车时才 return
        // -----------------------------------------------------
        if (key == '\n' || key == '\r') {
            Serial.read(); // 把垃圾字符吞掉
            return;
        }

        if (key == 'K') {
            Serial.read(); 
            is_printing = !is_printing;
            if (is_printing) Serial.println("\n[System] Real-time coordinates display ON");
            else Serial.println("\n[System] Coordinates display OFF");
        }
    }

    if (is_printing && (millis() - last_print_time > 500)) {
        last_print_time = millis();

        float pwm0 = read_servo_pwm(0, 30), pwm1 = read_servo_pwm(1, 30); 
        float pwm2 = read_servo_pwm(2, 30), pwm3 = read_servo_pwm(3, 30); 

        if (pwm0 < 0 || pwm1 < 0 || pwm2 < 0 || pwm3 < 0) return;

        float theta6 = (1500.0 - pwm0) * 270.0 / 2000.0;
        float theta5 = (pwm1 - 1500.0) * 270.0 / 2000.0 + 90.0;
        float theta4 = (pwm2 - 1500.0) * 270.0 / 2000.0;
        float theta3 = (pwm3 - 1500.0) * 270.0 / 2000.0;

        float alpha_deg = theta5 - theta4 + theta3;
        float t6 = theta6 * PI / 180.0, t5 = theta5 * PI / 180.0, t4 = theta4 * PI / 180.0, alpha = alpha_deg * PI / 180.0;

        float L3_ACTUAL = L3_BASE + END_EFFECTOR_OFFSET;
        float r = L1 * cos(t5) + L2 * cos(t5 - t4) + L3_ACTUAL * cos(alpha);
        float z = L0 + L1 * sin(t5) + L2 * sin(t5 - t4) + L3_ACTUAL * sin(alpha);
        float x = r * sin(t6), y = r * cos(t6);

        Serial.print(">> [Real-time] X: "); Serial.print(x, 1);
        Serial.print(" mm | Y: "); Serial.print(y, 1);
        Serial.print(" mm | Z: "); Serial.print(z, 1);
        Serial.print(" mm | Pitch: "); Serial.print(alpha_deg, 1);
        Serial.println(" deg");
    }
}