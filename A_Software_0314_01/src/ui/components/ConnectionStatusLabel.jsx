import React from 'react'

/** 顶栏连接状态：纯文字 / 弱化标签，样式与 RESET、Enable 按钮区分 */
export function ConnectionStatusLabel({ text, className = '' }) {
  return (
    <span
      className={`connection-status-label px ${className}`}
      title={text}
    >
      {text}
    </span>
  )
}
