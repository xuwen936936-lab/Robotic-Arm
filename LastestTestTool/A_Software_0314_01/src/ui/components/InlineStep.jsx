import React from 'react'

export function InlineStep({ index, label }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="swatch flex items-center justify-center"
        style={{
          background: 'var(--bgPurple)',
          width: '24px',
          height: '24px',
          boxShadow: '4px 4px 0 var(--shadow)',
        }}
      >
        <span className="px text-[10px]" style={{ color: 'var(--panel)' }}>
          {index}
        </span>
      </div>
      <div className="px text-[12px]">{label}</div>
    </div>
  )
}

