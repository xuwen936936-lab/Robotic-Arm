import React from 'react'

export function PixelInput({
  label,
  className = '',
  inputClassName = '',
  type = 'text',
  value,
  onChange,
  placeholder,
  variant = 'default', // default | flat
  ...rest
}) {
  const handleChange = (e) => {
    if (typeof onChange === 'function') {
      onChange(e.target.value)
    }
  }

  return (
    <div className={className}>
      {label && (
        <div className="px text-[12px] mb-1">
          {label}
        </div>
      )}
      <div
        style={{
          border: '2px solid var(--ink)',
          boxShadow: 'none',
          background: 'var(--panel)',
          height: variant === 'flat' ? '30px' : '40px',
          borderRadius: variant === 'flat' ? '4px' : '0px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`px text-[11px] w-full bg-transparent outline-none border-none ${inputClassName}`}
          style={{
            padding: '0 10px',
          }}
          {...rest}
        />
      </div>
    </div>
  )
}

