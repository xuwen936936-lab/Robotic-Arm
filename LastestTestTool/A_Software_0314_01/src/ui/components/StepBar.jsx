import React from 'react'
import { StepItem } from './StepItem.jsx'

export function StepBar({ steps }) {
  return (
    <div className="flex gap-2 shrink-0 mb-10">
      {steps.map((step, index) => (
        <StepItem
          key={step.id ?? index}
          status={step.status}
          position={step.position}
          label={step.label}
          title={step.title}
        />
      ))}
    </div>
  )
}

