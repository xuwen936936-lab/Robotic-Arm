// =================================================================================
// File: PathMemoryManager.ino
// Function: Store and playback multiple sequences with Emergency Stop Breakout
// =================================================================================

#include <Arduino.h>

// 引用外部功能
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern void smart_delay_with_stop(unsigned long ms);

// 引用 TeachRecordXYZ 和 EmergencyStop 中的变量
extern int final_start_pos[5];
extern int final_end_pos[5];
extern int final_waypoint_pos[2][5];
extern int waypoint_count;
extern bool has_start, has_end;
extern bool is_emergency_triggered; // 核心：急停标志位

// 继电器引脚（磁铁）
extern const int RELAY_PIN; 

// 数据结构定义
struct PathSequence {
    int start[5];
    int waypoints[2][5];
    int end[5];
    int w_cnt;
    bool isValid = false;
};

PathSequence path_library[12];
int library_count = 0;

void loop_path_memory() {
    if (Serial.available() > 0) {
        char key = toupper((char)Serial.peek());
        if (key == '\n' || key == '\r') { Serial.read(); return; }

        // --- 1. 保存路径 (Z) ---
        if (key == 'Z') {
            Serial.read();
            if (!has_start || !has_end) {
                Serial.println("\n[Error] No complete path to save!");
                return;
            }
            if (library_count >= 12) {
                Serial.println("\n[Limit] Library full!");
                return;
            }
            memcpy(path_library[library_count].start, final_start_pos, sizeof(final_start_pos));
            memcpy(path_library[library_count].end, final_end_pos, sizeof(final_end_pos));
            memcpy(path_library[library_count].waypoints, final_waypoint_pos, sizeof(final_waypoint_pos));
            path_library[library_count].w_cnt = waypoint_count;
            path_library[library_count].isValid = true;
            library_count++;
            Serial.print("\n[MEM] Saved to Slot "); Serial.println(library_count);
        }

        // --- 2. 批量执行 (D) ---
        if (key == 'D') {
            Serial.read();
            if (library_count == 0) {
                Serial.println("\n[Error] Library empty!");
                return;
            }

            Serial.println("\n[EXE] Starting Batch Process...");
            is_emergency_triggered = false; // 执行前重置

            for (int p = 0; p < library_count; p++) {
                if (!path_library[p].isValid) continue;

                // --- 步骤 A: 前往起点 ---
                Serial.print(">>> Task "); Serial.print(p+1); Serial.println(": Moving to START");
                for (int i = 0; i < 5; i++) set_servo(i, path_library[p].start[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) goto stop_batch; // 拦截

                // --- 步骤 B: 起点吸磁 ---
                digitalWrite(RELAY_PIN, HIGH);
                smart_delay_with_stop(800);
                if (is_emergency_triggered) goto stop_batch; // 拦截

                // --- 步骤 C: 经过途径点 ---
                for (int w = 0; w < path_library[p].w_cnt; w++) {
                    for (int i = 0; i < 5; i++) set_servo(i, path_library[p].waypoints[w][i], 2000);
                    smart_delay_with_stop(2500);
                    if (is_emergency_triggered) goto stop_batch; // 拦截
                }

                // --- 步骤 D: 前往终点 ---
                for (int i = 0; i < 5; i++) set_servo(i, path_library[p].end[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) goto stop_batch; // 拦截

                // --- 步骤 E: 终点放磁 ---
                digitalWrite(RELAY_PIN, LOW);
                smart_delay_with_stop(800);
                if (is_emergency_triggered) goto stop_batch; // 拦截
            }

            Serial.println("\n[DONE] Batch process finished.");
            return; 


            // --- 急停强制跳出点 ---
            stop_batch:
            Serial.println("\n⚠️ [TERMINATED] Batch process aborted by Emergency Stop!");
            digitalWrite(RELAY_PIN, LOW); // 强制关闭磁铁安全
            // 这里不需要手动写归位逻辑，因为 EmergencyStop.ino 已经处理了归位到 1500
            is_emergency_triggered = false; 
            return; 
        }

        // --- 3. 清空库 (C) ---
        if (key == 'C') {
            Serial.read();
            library_count = 0;
            for (int i = 0; i < 12; i++) path_library[i].isValid = false;
            Serial.println("\n[RESET] Library cleared.");
        }
    }
}
