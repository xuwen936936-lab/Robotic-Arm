// =================================================================================
// 文件名: TorqueControl.ino
// 功能: 独立快捷键控制机械臂整体卸力(U)与上力(L)
// =================================================================================

// 引用主文件中的全局发送函数
extern void all_uart_send_str(char *str);

void loop_torque_control() {
    // 检查串口是否有数据输入
    if (Serial.available() > 0) {
        // 使用 peek() 查看第一个字符，如果不属于这里的指令，留给其他模块处理
        char key = (char)Serial.peek(); 
        
        // 忽略回车换行符
        if (key == '\n' || key == '\r') {
            Serial.read(); // 把垃圾字符吞掉
            return; 
        }
        
        // 统一转换为大写
        key = toupper(key);

        // 如果按下了 'U' 或 'L' 键，正式消费这个字符并执行对应动作
        if (key == 'U' || key == 'L') {
            Serial.read(); // 把字符从串口缓冲区拿走
            
            char lock_cmd[16];

            if (key == 'U') {
                Serial.println("\n[指令] 机械臂已手动卸力 (U) - 现在可以自由拖拽");
                // 发送 #255PULK! 全体卸力指令
                snprintf(lock_cmd, sizeof(lock_cmd), "#255PULK!");
                all_uart_send_str(lock_cmd);
            } 
            else if (key == 'L') {
                Serial.println("\n[指令] 机械臂已手动上力 (L) - 关节已锁定");
                // 发送 #255PULR! 全体恢复扭矩指令
                snprintf(lock_cmd, sizeof(lock_cmd), "#255PULR!");
                all_uart_send_str(lock_cmd);
            }
        }
    }
}
