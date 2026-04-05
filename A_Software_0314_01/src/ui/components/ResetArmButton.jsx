import React from 'react'

/**
 * 机械臂回到初始位（占位）。硬件通讯后续再接；目前仅视觉与可点击反馈。
 */
export function ResetArmButton({ className = '' }) {
  return (
    <button
      type="button"
      className={`connection-pill px text-[9px] px-2 py-2 cursor-pointer select-none hover:brightness-[0.97] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_var(--shadow)] ${className}`}
      onClick={() => {}}
      aria-label="Reset arm to home (hardware not wired yet)"
    >
      RESET
    </button>
  )
}
