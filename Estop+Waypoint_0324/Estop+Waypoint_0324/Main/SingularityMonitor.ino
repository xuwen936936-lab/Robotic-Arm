// =================================================================================
// File: SingularityMonitor.ino
// Function: Monitor end-effector position and warn if entering singularity zone
// =================================================================================
#include <Arduino.h>
#include <math.h>

// 奇异点坐标 (始终在 Base 坐标系下定义)
const float SINGULARITY_X = -63.5;
const float SINGULARITY_Y = 46.8;
const float SINGULARITY_Z = -0.7;
const float SINGULARITY_PITCH = -91.6;

// 误差范围阈值（警戒区大小）
const float DISTANCE_THRESHOLD = 15.0; // 空间距离 15mm 的球形区域内
const float PITCH_THRESHOLD = 5.0;     // 俯仰角误差 5 度内

void check_singularity_zone(float current_x, float current_y, float current_z, float current_pitch) {
    static unsigned long last_warn_time = 0;
    
    // 1. 计算当前点到奇异点的空间欧氏距离
    float dx = current_x - SINGULARITY_X;
    float dy = current_y - SINGULARITY_Y;
    float dz = current_z - SINGULARITY_Z;
    float distance = sqrt(dx * dx + dy * dy + dz * dz);
    
    // 2. 计算 Pitch 的差值绝对值
    float dpitch = abs(current_pitch - SINGULARITY_PITCH);

    // 3. 综合判定：如果落入危险警戒区
    // if (distance <= DISTANCE_THRESHOLD && dpitch <= PITCH_THRESHOLD) {
        
    //     // 限制报错频率，每 1.5 秒最多报错一次，防止把串口监视器刷爆
    //     if (millis() - last_warn_time > 1500) {
    //         last_warn_time = millis();
            
    //         Serial.println("\n==================================================");
    //         Serial.println("[WARNING] !!! SINGULARITY ZONE DETECTED !!!");
    //         Serial.println("[WARNING] The robotic arm is dangerously close to the singularity point.");
    //         Serial.print("[WARNING] Current Dist to Center: "); Serial.print(distance, 1); 
    //         Serial.print(" mm | Pitch Diff: "); Serial.print(dpitch, 1); Serial.println(" deg");
    //         Serial.println("==================================================");
            
    //         // 如果未来你需要：在这里可以加入蜂鸣器报警代码，如 beep_on(); 
    //     }
    // }
    
    //0404
    if (distance <= DISTANCE_THRESHOLD && dpitch <= PITCH_THRESHOLD) {
        // 如果落入危险警戒区，不再仅仅是打印，而是直接触发停机复位
        if (!is_emergency_triggered) { 
            // 确保不重复触发复位
            extern void trigger_software_emergency(const char* reason);
            trigger_software_emergency("SINGULARITY_ZONE");
        }
    }
}