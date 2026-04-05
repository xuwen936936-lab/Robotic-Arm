import React from 'react'

const STATUS_WRAPPER_CLASS = {
  done: 'step-wrapper step-done-wrapper',
  active: 'step-wrapper step-active-wrapper',
  pending_3: 'step-wrapper step-pending-wrapper',
  pending_4: 'step-wrapper step-pending-wrapper',
}

const STATUS_INNER_CLASS = {
  done: 'step-inner step-done',
  active: 'step-inner step-active',
  pending_3: 'step-inner step-pending',
  pending_4: 'step-inner step-pending',
}

const POSITION_CLASS = {
  first: 'step-first',
  middle: 'step-middle',
  last: 'step-last',
}

function getLabelClass(status) {
  if (status === 'done') return 'px text-[11px] opacity-60 mb-1'
  if (status === 'active') return 'px text-[11px] opacity-80 mb-1 text-black'
  if (status === 'pending_3' || status === 'pending_4') {
    return 'px text-[11px] mb-1 text-[#352E75]'
  }
  return 'px text-[11px] mb-1'
}

function getTitleClass(status) {
  if (status === 'active') return 'px text-[14px] text-black'
  if (status === 'pending_3' || status === 'pending_4') {
    return 'px text-[14px] text-[#352E75]'
  }
  return 'px text-[14px]'
}

export function StepItem({
  status,
  position,
  label,
  title,
}) {
  const wrapperClass = STATUS_WRAPPER_CLASS[status] ?? STATUS_WRAPPER_CLASS.pending_3
  const innerBaseClass = STATUS_INNER_CLASS[status] ?? STATUS_INNER_CLASS.pending_3
  const positionClass = POSITION_CLASS[position] ?? POSITION_CLASS.middle

  const innerClass = `${innerBaseClass} ${positionClass} w-full h-full pl-10 pr-10 py-4 flex flex-col justify-center`
  const labelClass = getLabelClass(status)
  const titleClass = getTitleClass(status)

  return (
    <div className={`${wrapperClass} flex-1 flex`}>
      <div className={innerClass}>
        <div className={labelClass}>{label}</div>
        <div className={titleClass}>{title}</div>
      </div>
    </div>
  )
}

