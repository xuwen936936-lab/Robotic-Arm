import React, { useState } from 'react'

export function PixelSelect({
  label,
  options,
  value,
  defaultValue,
  onChange,
  className = '',
  variant = 'default', // default | flat | plain
}) {
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (options && options.length > 0 ? options[0].value : ''),
  )

  const currentValue = value !== undefined ? value : internalValue
  const selected =
    options?.find((opt) => opt.value === currentValue) ?? options?.[0] ?? null

  const handleSelect = (next) => {
    if (!next || !options) return
    if (value === undefined) {
      setInternalValue(next.value)
    }
    if (typeof onChange === 'function') {
      onChange(next.value)
    }
    setOpen(false)
  }

  return (
    <div className={className}>
      {label && (
        <div className="px text-[12px] mb-1">
          {label}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full flex items-center justify-between text-left"
          style={{
            border: '2px solid var(--ink)',
            boxShadow: 'none',
            background: 'var(--panel)',
            height: variant === 'default' ? '40px' : '30px',
            padding: '0 10px',
            borderRadius: variant === 'default' ? '0px' : '4px',
          }}
        >
          <span className="px text-[11px] leading-none truncate">
            {selected ? selected.label : ''}
          </span>
          <span className="px text-[10px] leading-none ml-2 shrink-0">
            ▼
          </span>
        </button>
        {open && options && options.length > 0 && (
          <div
            className="absolute left-0 right-0 mt-1 z-30"
            style={{
              border: '2px solid var(--ink)',
              boxShadow: 'none',
              background: 'var(--panel)',
              borderRadius: variant === 'default' ? '0px' : '4px',
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full text-left px text-[11px]"
                style={{
                  padding: '6px 10px',
                  background:
                    opt.value === selected?.value
                      ? 'var(--bgPurple)'
                      : 'var(--panel)',
                  color: opt.value === selected?.value ? '#ffffff' : 'var(--ink)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

