import React from 'react'

export function PixelCard({
  title,
  titleColor,
  children,
  className = '',
  padding = 'p-8',
}) {
  const colors = Array.isArray(titleColor) ? titleColor : titleColor ? [titleColor] : []
  const hasHeader = title || colors.length > 0

  return (
    <section className={`pixel-card soft-grid ${padding} flex flex-col ${className}`}>
      {hasHeader && (
        <div className="flex items-start justify-between mb-6 shrink-0">
          {title ? <div className="px text-[12px]">{title}</div> : <div />}
          {colors.length > 0 && (
            <div className="flex gap-2">
              {colors.map((color, index) => (
                <div
                  key={`${color}-${index}`}
                  className="swatch"
                  style={{ background: color }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

