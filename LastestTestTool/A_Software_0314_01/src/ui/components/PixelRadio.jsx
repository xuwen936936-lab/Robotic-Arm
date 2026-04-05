import React from 'react'

export function PixelRadio({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer" onClick={onChange}>
      <span className="pixel-radio-outer">
        <span
          className={`pixel-radio-inner ${checked ? 'pixel-radio-inner-on' : ''}`}
        />
      </span>
      <span>{label}</span>
    </label>
  )
}


