// =================================================================================
// File: ManualInputHandler.ino
// Function: 解析来自网页端的手动坐标输入 (H, I, J, Q)
//           支持 Base/Target 坐标系自动转换并存储为 PWM 脉宽
// =================================================================================

#include <Arduino.h>

// 引用外部全局变量和函数
extern int final_start_pos[5];
extern int final_end_pos[5];
extern int final_waypoint_pos[2][5];
extern bool has_start, has_end, has_w1, has_w2;
extern int waypoint_count;
extern uint8_t current_ref_frame;
//extern const float TARGET_OFFSET_Y;
//0331
extern float target_offset_x;
extern float target_offset_y;
extern float target_offset_z;

// 引用运动学解算函数
extern int kinematics_analysis(float x, float y, float z, float Alpha, kinematics_t *kin);
extern kinematics_t kinematics;

/**
 * 核心解析函数：处理手动坐标指令
 * 格式示例: "H:10,200,169,90!"
 */
void handle_manual_coordinate_input(char *cmd_buf) {
    char type_char;
    int raw_x, raw_y, raw_z, raw_rx;
    int *target_buffer = nullptr;
    const char *point_name = "";

    // 1. 使用 sscanf 解析格式化的字符串
    // %c 抓取第一个字母, %d 抓取坐标
    // if (sscanf(cmd_buf, "%c:%d,%d,%d,%d!", &type_char, &raw_x, &raw_y, &raw_z, &raw_rx) != 5) {
    //     // 如果解析失败（可能是 TH: 这种带 T 的格式），尝试解析带 T 的格式
    //     if (sscanf(cmd_buf, "T%c:%d,%d,%d,%d!", &type_char, &raw_x, &raw_y, &raw_z, &raw_rx) != 5) {
    //         return; // 格式完全不匹配则退出
    //     }
    // }

    //0331 若没有传入俯仰角数值，则默认是 0
    // 1. 尝试解析参数：sscanf 会返回成功匹配到的变量个数
    int parsed_count = sscanf(cmd_buf, "%c:%d,%d,%d,%d!", &type_char, &raw_x, &raw_y, &raw_z, &raw_rx);

    if (parsed_count < 4) {
        // 如果普通格式失败，尝试解析带 T 的格式
        parsed_count = sscanf(cmd_buf, "T%c:%d,%d,%d,%d!", &type_char, &raw_x, &raw_y, &raw_z, &raw_rx);
        if (parsed_count < 4) {
            return; // 如果连 X, Y, Z 都没凑齐，说明指令完全乱码，直接退出
        }
    }

    // 核心逻辑：如果成功解析了 4 个参数（即 Type, X, Y, Z），说明没传 rx，自动补 0
    if (parsed_count == 4) {
        raw_rx = 0; 
        // 建议：如果你发现默认姿态水平朝前不好用，把这行改成 raw_rx = -90;
    }

    // 2. 判定点位类型并分配存储空间
    switch (toupper(type_char)) {
        case 'H': 
            target_buffer = final_start_pos; 
            point_name = "START (Pick)";
            break;
        case 'I': 
            target_buffer = final_end_pos; 
            point_name = "END (Drop)";
            break;
        case 'J': 
            target_buffer = final_waypoint_pos[0]; 
            point_name = "Waypoint 1";
            break;
        case 'Q': 
            target_buffer = final_waypoint_pos[1]; 
            point_name = "Waypoint 2";
            break;
        default: return; // 未知点位类型
    }

    // // 3. 坐标系补偿 (处理 Target 坐标系)
    // float calc_x = (float)raw_x;
    // float calc_y = (float)raw_y;
    // float calc_z = (float)raw_z;
    // float calc_rx = (float)raw_rx;

    // // 如果当前处于 Target 坐标系，或者指令以 T 开头，进行 Y 轴偏移 [cite: 139, 276]
    // if (current_ref_frame == 1 || cmd_buf[0] == 'T') {
    //     calc_y += TARGET_OFFSET_Y; // 加上 370.0mm 偏移 [cite: 139]
    // }
    // 3. 坐标系补偿 (处理 Target 坐标系)
    float calc_x = (float)raw_x;
    float calc_y = (float)raw_y;
    float calc_z = (float)raw_z;
    float calc_rx = (float)raw_rx;

    // 只有当 Drop Point 存在 (has_end) 且要求使用 Target 坐标系时才做补偿
    if ((current_ref_frame == 1 || cmd_buf[0] == 'T') && has_end) {
        calc_x += target_offset_x;
        calc_y += target_offset_y;
        calc_z += target_offset_z;
    }

    // // 4. 逆运动学解算：将坐标转为 PWM [cite: 150, 161]
    // int result = kinematics_analysis(calc_x, calc_y, calc_z, calc_rx, &kinematics);

    // if (result == 0) {
    //     // 解算成功，拷贝 PWM 数值到对应全局数组 [cite: 162, 163]
    //     for (int i = 0; i < 4; i++) {
    //         target_buffer[i] = kinematics.servo_pwm[i];
    //     }
    //     target_buffer[4] = 1500; // 5号舵机默认中位

    //     // 更新逻辑标志位 [cite: 136, 137]
    //     if (toupper(type_char) == 'H') has_start = true;
    //     if (toupper(type_char) == 'I') has_end = true;
    //     if (toupper(type_char) == 'J') { has_w1 = true; if(waypoint_count < 1) waypoint_count = 1; }
    //     if (toupper(type_char) == 'Q') { has_w2 = true; waypoint_count = 2; }

    //     Serial.print(">> [Manual Input] Saved "); Serial.print(point_name);
    //     Serial.print(" | PWM: "); Serial.print(target_buffer[0]); 
    //     Serial.print(","); Serial.println(target_buffer[1]);
    // } else {
    //     // 解算失败（坐标超限） [cite: 154, 160]
    //     Serial.print(">> [Error] Manual coordinates out of reach! Code: ");
    //     Serial.println(result);
    // }
    // 4. 逆运动学解算：将坐标转为 PWM
    int result = kinematics_analysis(calc_x, calc_y, calc_z, calc_rx, &kinematics);
    if (result == 0) {
        for (int i = 0; i < 4; i++) {
            target_buffer[i] = kinematics.servo_pwm[i];
        }
        target_buffer[4] = 1500;

        // 更新逻辑标志位
        if (toupper(type_char) == 'H') has_start = true;
        if (toupper(type_char) == 'J') { has_w1 = true; if(waypoint_count < 1) waypoint_count = 1; }
        if (toupper(type_char) == 'Q') { has_w2 = true; waypoint_count = 2; }
        
        // --- 核心修改：如果是录入终点(I)，同步更新 Target 原点 ---
        if (toupper(type_char) == 'I') {
            has_end = true;
            // 此时的 calc_x/y/z 已经是纯净的 Base 坐标了，直接设为新原点
            target_offset_x = calc_x;
            target_offset_y = calc_y;
            target_offset_z = calc_z;
        }

        Serial.print(">> [Manual Input] Saved "); Serial.print(point_name);
    }
}