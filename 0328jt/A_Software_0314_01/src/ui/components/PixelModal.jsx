import React from 'react'

export function PixelModal({ open, children, className = '' }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      <div
        className={`pixel-card soft-grid p-10 ${className}`}
        style={{
          background: 'var(--panel)',
          maxWidth: '1120px',
          width: 'calc(100% - 64px)',
          maxHeight: '82vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

