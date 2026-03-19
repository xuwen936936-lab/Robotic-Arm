import React from 'react'
import { PixelButton } from './PixelButton.jsx'
import { PixelInput } from './PixelInput.jsx'
import { PixelSelect } from './PixelSelect.jsx'
import './TrajectoryPointCard.css'

const AXES = ['x', 'y', 'z', 'rx']
const DEFAULT_FRAME_OPTIONS = [
  { value: 'Base', label: 'Base' },
  { value: 'Flange', label: 'Flange' },
  { value: 'Tool A', label: 'Tool A' },
  { value: 'Start', label: 'Start' },
  { value: 'Target', label: 'Target' },
]

const ACCENT_CLASS = {
  magenta: 'trajectory-point-card-dot-magenta',
  orange: 'trajectory-point-card-dot-orange',
  green: 'trajectory-point-card-dot-green',
}

export function TrajectoryPointCard({
  title,
  point,
  accent = 'magenta',
  onAxisChange,
  onRecord,
  onRemove,
  bordered = true,
  frameOptions = DEFAULT_FRAME_OPTIONS,
  frameValue,
  defaultFrameValue = 'Base',
  onFrameChange,
}) {
  const accentClass = ACCENT_CLASS[accent] ?? ACCENT_CLASS.magenta
  const frameSelectProps =
    frameValue !== undefined
      ? { value: frameValue, onChange: onFrameChange }
      : { defaultValue: defaultFrameValue, onChange: onFrameChange }

  return (
    <div
      className={`trajectory-point-card ${
        bordered
          ? 'trajectory-point-card-bordered'
          : 'trajectory-point-card-unbordered'
      } ${onRemove ? 'trajectory-point-card-removable' : ''}`}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="trajectory-point-card-remove"
          aria-label={`Remove ${title}`}
        >
          -
        </button>
      )}

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`trajectory-point-card-dot ${accentClass}`}>●</span>
          <span className="text-[13px] font-semibold shrink-0">{title}</span>
          <span className="text-[12px] ml-4 shrink-0">Reference Frame</span>
          <PixelSelect
            className="flex-1 min-w-0"
            variant="plain"
            options={frameOptions}
            {...frameSelectProps}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {AXES.map((axis) => (
            <div key={axis} className="flex items-center gap-1 min-w-0">
              <span className="text-[12px] font-semibold shrink-0">
                {axis === 'rx' ? 'Rx' : axis.toUpperCase()}
              </span>
              <PixelInput
                className="min-w-0 flex-1"
                value={point[axis]}
                variant="flat"
                onChange={(value) => onAxisChange(axis, value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="trajectory-point-card-side flex items-center justify-center">
        <PixelButton
          variant="outline"
          className="text-[12px]"
          onClick={onRecord}
        >
          Record
        </PixelButton>
      </div>
    </div>
  )
}
