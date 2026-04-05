// ===================== 修改后的 ForwardKinematics.ino =====================
#include <math.h>

extern int read_servo_pwm(uint8_t idx, uint32_t timeout_ms);
extern uint8_t current_ref_frame;
//extern const float TARGET_OFFSET_Y;
//0331
extern float target_offset_x;
extern float target_offset_y;
extern float target_offset_z;
extern bool has_end;

extern void check_singularity_zone(float current_x, float current_y, float current_z, float current_pitch);

// 物理参数保持不变
const float L0 = 109.0, L1 = 105.0, L2 = 87.0, L3_BASE = 80.0;
const float END_EFFECTOR_OFFSET = 50.0;

void loop_print_tcp() {
    static unsigned long last_calc_time = 0;
    static bool is_printing = false;
    static int print_count = 0;

    // 1. 指令监听保持不变
    if (Serial.available() > 0) {
        char key = toupper((char)Serial.peek());
        if (key == 'K') {
            Serial.read();
            is_printing = true;
            print_count = 0;
            Serial.println("\n[System] Starting optimized 3-step sequence...");
        }
    }

    // 2. 频率控制
    if (millis() - last_calc_time > 500) {
        last_calc_time = millis(); // 无论成功与否，立即重置时间基准

        // --- 关键优化：缩短超时时间从 30ms 减小到 10ms ---
        // 增加一个快速检测，如果第一个舵机就读取失败，直接判定总线忙，跳过本次循环
        int p0 = read_servo_pwm(0, 10); 
        if (p0 < 0) return; 

        int p1 = read_servo_pwm(1, 10);
        int p2 = read_servo_pwm(2, 10);
        int p3 = read_servo_pwm(3, 10);

        if (p1 < 0 || p2 < 0 || p3 < 0) return;

        // 3. 计算逻辑 (保持原样)
        float pwm0=p0, pwm1=p1, pwm2=p2, pwm3=p3;
        float theta6 = (1500.0 - pwm0) * 270.0 / 2000.0;
        float theta5 = (pwm1 - 1500.0) * 270.0 / 2000.0 + 90.0;
        float theta4 = (pwm2 - 1500.0) * 270.0 / 2000.0;
        float theta3 = (pwm3 - 1500.0) * 270.0 / 2000.0;
        float alpha_deg = theta5 - theta4 + theta3;
        
        float t6 = theta6 * PI / 180.0, t5 = theta5 * PI / 180.0, t4 = theta4 * PI / 180.0, alpha = alpha_deg * PI / 180.0;
        float L3_ACTUAL = L0 + L1; // 简化示例，使用你原有的物理常量
        float r = L1 * cos(t5) + L2 * cos(t5 - t4) + (80.0 + 50.0) * cos(alpha);
        float z = 109.0 + L1 * sin(t5) + L2 * sin(t5 - t4) + (80.0 + 50.0) * sin(alpha);
        float x = r * sin(t6), y = r * cos(t6);

        check_singularity_zone(x, y, z, alpha_deg);


        // 4. 受限打印逻辑
        if (is_printing) {
            float out_x = x, out_y = y, out_z = z;
            // if (current_ref_frame == 1) out_y = y - TARGET_OFFSET_Y; // 坐标系转换
            //0331
            // --- 核心修改：三轴动态补偿，无数值时等同于 Base ---
            if (current_ref_frame == 1 && has_end) { 
                out_x = x - target_offset_x;
                out_y = y - target_offset_y;
                out_z = z - target_offset_z;
            }

            // 输出坐标数据
            Serial.print(">> [Sample "); Serial.print(print_count + 1); Serial.print("/3] ");
            Serial.print("X: "); Serial.print(out_x, 1);
            Serial.print(" mm | Y: "); Serial.print(out_y, 1);
            Serial.print(" mm | Z: "); Serial.print(out_z, 1);
            Serial.print(" mm | Pitch: "); Serial.print(alpha_deg, 1); Serial.println(" deg");

            print_count++; // 计数增加

            // 达到 3 次后自动停止
            if (print_count >= 3) {
                is_printing = false;
                Serial.println("[System] Sequence complete. Output stopped.");
            }
        }
    }
}

// 在 ForwardKinematics.ino 文件的末尾添加以下代码

// 定义一次性坐标系修饰符标志位
bool use_target_frame_once = false;

void loop_oneshot_tcp() {
    // 核心修复：用 while 替代单次 if，确保连发的字符能被一次性榨干
    while (Serial.available() > 0) {
        char key = toupper((char)Serial.peek());

        // 1. 监听修饰符 'T' (Target Frame)
        if (key == 'T') {
            Serial.read(); // 消费掉 'T'
            use_target_frame_once = true;
            // 收到 T 后立刻 continue，不退出函数，回头紧接着去读缓冲区里的下一个字符 'P'
            continue; 
        }

        // 2. 监听单次坐标获取指令 'P' (Position)
        if (key == 'P') {
            Serial.read(); // 消费掉 'P'

            // 快速读取舵机当前 PWM
            int p0 = read_servo_pwm(0, 10); if (p0 < 0) return;
            int p1 = read_servo_pwm(1, 10); if (p1 < 0) return;
            int p2 = read_servo_pwm(2, 10); if (p2 < 0) return;
            int p3 = read_servo_pwm(3, 10); if (p3 < 0) return;

            // 运动学正解算
            float theta6 = (1500.0 - p0) * 270.0 / 2000.0;
            float theta5 = (p1 - 1500.0) * 270.0 / 2000.0 + 90.0;
            float theta4 = (p2 - 1500.0) * 270.0 / 2000.0;
            float theta3 = (p3 - 1500.0) * 270.0 / 2000.0;
            float alpha_deg = theta5 - theta4 + theta3;

            float t6 = theta6 * PI / 180.0, t5 = theta5 * PI / 180.0, t4 = theta4 * PI / 180.0, alpha = alpha_deg * PI / 180.0;
            float r = L1 * cos(t5) + L2 * cos(t5 - t4) + (80.0 + 50.0) * cos(alpha);
            float z = 109.0 + L1 * sin(t5) + L2 * sin(t5 - t4) + (80.0 + 50.0) * sin(alpha);
            float x = r * sin(t6), y = r * cos(t6);

            // 后台奇异点检测 [cite: 117]
            check_singularity_zone(x, y, z, alpha_deg);

            // // 坐标系转换逻辑
            // float out_x = x, out_y = y, out_z = z;
            // String frame_name = "BASE";

            // if (use_target_frame_once) {
            //     out_y = y - TARGET_OFFSET_Y; 
            //     frame_name = "TARGET";
            //     use_target_frame_once = false; // 用完即焚
            // }
            // 0331 坐标系转换逻辑
            float out_x = x, out_y = y, out_z = z;
            String frame_name = "BASE";

            if (use_target_frame_once) {
                if (has_end) {
                    out_x = x - target_offset_x;
                    out_y = y - target_offset_y;
                    out_z = z - target_offset_z;
                    frame_name = "TARGET";
                } else {
                    frame_name = "TARGET(Unset->BASE)"; // 提示当前无 Drop Point，退化为 Base
                }
                use_target_frame_once = false; // 用完即焚
            }

            // 打印结果 [cite: 122]
            Serial.println("--------------------------------------------------");
            Serial.print(">> [One-Shot | Frame: "); Serial.print(frame_name); Serial.print("] ");
            Serial.print("X: "); Serial.print(out_x, 1);
            Serial.print(" mm | Y: "); Serial.print(out_y, 1);
            Serial.print(" mm | Z: "); Serial.print(out_z, 1);
            Serial.print(" mm | Pitch: "); Serial.print(alpha_deg, 1); Serial.println(" deg");
            Serial.println("--------------------------------------------------");
            
            return; // P 打印完毕后安全退出
        }

        // 3. 如果遇到的既不是 T 也不是 P（比如收到了回车或 '$'），立刻跳出循环，留给主程序的其他模块去解析
        break; 
    }
}
