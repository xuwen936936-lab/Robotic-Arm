// =================================================================================
// File: PathMemoryManager.ino
// Function: Store and playback multiple teaching sequences with Magnet control
// =================================================================================

#include <Arduino.h>

// 引用外部功能
extern void set_servo(int servo_index, int pwm_value, int move_time);
extern void all_uart_send_str(char *str);
extern void smart_delay_with_stop(unsigned long ms);

// 引用 TeachRecordXYZ 中的变量
extern int final_start_pos[5];
extern int final_end_pos[5];
extern int final_waypoint_pos[2][5];
extern int waypoint_count;
extern bool has_start, has_end;
extern bool is_emergency_triggered;

// 继电器引脚（磁铁）
extern const int RELAY_PIN; 

// ===================== [数据结构定义] =====================
struct PathSequence {
    int start[5];
    int waypoints[2][5];
    int end[5];
    int w_cnt;
    bool isValid = false;
};

// 1. 创建数组，最多放置 12 组路径信息
PathSequence path_library[12];
int library_count = 0;

void loop_path_memory() {
    if (Serial.available() > 0) {
        char key = toupper((char)Serial.peek());
        if (key == '\n' || key == '\r') { Serial.read(); return; }

        // 2. 按下 Z 键：保存当前路径
        if (key == 'Z') {
            Serial.read();
            if (!has_start || !has_end) {
                Serial.println("\n[Error] No complete path to save! Set A and B first.");
                return;
            }
            if (library_count >= 12) {
                Serial.println("\n[Limit] Path library is full! (Max 12)");
                return;
            }

            // 将当前视教数据拷贝到库中
            memcpy(path_library[library_count].start, final_start_pos, sizeof(final_start_pos));
            memcpy(path_library[library_count].end, final_end_pos, sizeof(final_end_pos));
            memcpy(path_library[library_count].waypoints, final_waypoint_pos, sizeof(final_waypoint_pos));
            path_library[library_count].w_cnt = waypoint_count;
            path_library[library_count].isValid = true;

            library_count++;
            Serial.print("\n[MEM] Path saved to slot "); Serial.print(library_count);
            Serial.println("/12. (Z to save more, D to run all)");
        }

        // 3. 按下 D 键：流水线式运行所有已存路径
        if (key == 'D') {
            Serial.read();
            if (library_count == 0) {
                Serial.println("\n[Error] Path library is empty!");
                return;
            }

            Serial.println("\n[EXE] Starting Batch Process (D)...");
            is_emergency_triggered = false;

            for (int p = 0; p < library_count; p++) {
                if (!path_library[p].isValid) continue;
                Serial.print(">>> Executing Path Group: "); Serial.println(p + 1);

                // --- A. 移动到该组的起点 ---
                for (int i = 0; i < 5; i++) set_servo(i, path_library[p].start[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) break;

                // --- B. 起点执行上电 (吸磁) ---
                Serial.println(">>> Magnet ON (Sucking)");
                digitalWrite(RELAY_PIN, HIGH);
                smart_delay_with_stop(800); 

                // --- C. 移动到该组的途径点 ---
                for (int w = 0; w < path_library[p].w_cnt; w++) {
                    for (int i = 0; i < 5; i++) set_servo(i, path_library[p].waypoints[w][i], 2000);
                    smart_delay_with_stop(2500);
                    if (is_emergency_triggered) break;
                }

                // --- D. 移动到该组的终点 ---
                for (int i = 0; i < 5; i++) set_servo(i, path_library[p].end[i], 2000);
                smart_delay_with_stop(2500);
                if (is_emergency_triggered) break;

                // --- E. 终点执行放电 (失磁) ---
                Serial.println(">>> Magnet OFF (Released)");
                digitalWrite(RELAY_PIN, LOW);
                smart_delay_with_stop(800);
                
                if (is_emergency_triggered) break;
            }

            if (is_emergency_triggered) {
                Serial.println("\n[Aborted] Batch process stopped by Emergency.");
                digitalWrite(RELAY_PIN, LOW); // 安全起见，急停释放磁铁
            } else {
                Serial.println("\n[DONE] All saved paths executed!");
            }
        }
    }
}