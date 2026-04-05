import React from 'react'

export function PixelToast({
  open,
  icon = '⚠️',
  message,
  className = '',
}) {
  if (!open) return null

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 top-4 z-40 px-6 py-3 flex items-center ${className}`}
      style={{
        border: '2px solid var(--ink)',
        boxShadow: '4px 4px 0 var(--shadow)',
        background: '#FFD5D5',
      }}
    >
      <div className="flex items-center gap-2">
        {icon && <div className="px text-[14px]">{icon}</div>}
        <div
          className="px text-[12px]"
          style={{
            color: '#FF3B3B',
          }}
        >
          {message}
        </div>
      </div>
    </div>
  )
}

