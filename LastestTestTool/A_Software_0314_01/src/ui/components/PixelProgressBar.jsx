import React from 'react'

export function PixelProgressBar({ value = 0 }) {
  const clamped = Math.max(0, Math.min(1, value))

  return (
    <div className="w-full">
      <div
        className="relative h-3 box-border"
        style={{
          border: '3px solid var(--ink)',
          boxShadow: '6px 6px 0 var(--shadow)',
          background: 'var(--panel)',
        }}
      >
        <div
          className="h-full"
          style={{
            width: `${clamped * 100}%`,
            background: 'var(--bgPurple)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-1 top-0 h-[3px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0))',
          }}
        />
      </div>
    </div>
  )
}

