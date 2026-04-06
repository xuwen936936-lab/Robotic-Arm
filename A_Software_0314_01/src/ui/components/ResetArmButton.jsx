import React from 'react'
import { useHardwareStore } from '../../services/useHardwareStore.ts' // <--- 就是漏了这一行！必须把它引入进来才能用

/**
 * 机械臂回到初始位。点击向底层发送复位指令。
 */
export function ResetArmButton({ className = '' }) {
  // 提取发送指令的函数
  const { resetMockRobotToHome } = useHardwareStore()  
  
  return (
    <button
      type="button"
      className={`connection-pill px text-[9px] px-2 py-2 cursor-pointer select-none hover:brightness-[0.97] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_var(--shadow)] ${className}`}
      onClick={resetMockRobotToHome} // 绑定真实的发送函数
      aria-label="Reset arm to home"
    >
      RESET
    </button>
  )
}
