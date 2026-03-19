import React from 'react'

const VARIANT_CLASS = {
  purple: 'btn-purple',
  orange: 'btn-orange',
  magenta: 'btn-magenta',
  black: 'btn-black',
  red: 'btn-red',
  white: 'btn-white',
  outline: 'btn-outline',
}

const WRAPPER_CLASS_PREFIXES = [
  // margin
  'm-',
  'mt-',
  'mb-',
  'ml-',
  'mr-',
  'mx-',
  'my-',
  // size / flex layout
  'w-',
  'min-w-',
  'max-w-',
  'h-',
  'min-h-',
  'max-h-',
  'flex',
  'inline-flex',
  'grow',
  'shrink',
  'basis-',
  'self-',
  'justify-',
  'items-',
  'place-',
]

function splitClassName(className) {
  if (!className) return { wrapper: '', button: '' }
  const tokens = className.split(/\s+/).filter(Boolean)

  const wrapperTokens = []
  const buttonTokens = []

  tokens.forEach((token) => {
    if (WRAPPER_CLASS_PREFIXES.some((prefix) => token.startsWith(prefix))) {
      wrapperTokens.push(token)
    } else {
      buttonTokens.push(token)
    }
  })

  return {
    wrapper: wrapperTokens.join(' '),
    button: buttonTokens.join(' '),
  }
}

export function PixelButton({
  variant = 'purple',
  className = '',
  icon,
  children,
  ...rest
}) {
  const colorClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.purple
  const { wrapper, button } = splitClassName(className)

  const buttonTokens = button ? button.split(/\s+/).filter(Boolean) : []
  const hasCustomPadding = buttonTokens.some(
    (t) => t.startsWith('p-') || t.startsWith('px-') || t.startsWith('py-'),
  )
  const isOutline = variant === 'outline'
  const defaultPadding = hasCustomPadding ? '' : isOutline ? 'px-4' : 'py-4 px-6'

  return (
    <div className={`p-[4px] pb-[8px] inline-block ${wrapper}`}>
      <button
        className={`pixel-btn px ${colorClass} px text-[12px] w-full h-full flex items-center justify-center ${defaultPadding} ${button}`}
        style={isOutline ? { height: '40px' } : undefined}
        type="button"
        {...rest}
      >
        {icon && (
          <span
            className="inline-flex items-center justify-center mr-3 align-middle"
            style={{
              fontSize: '24px',
              transform: 'translateY(-4px)',
            }}
          >
            {icon}
          </span>
        )}
        <span className="align-middle">{children}</span>
      </button>
    </div>
  )
}

