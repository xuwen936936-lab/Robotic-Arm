import React from 'react'

export function StatDisplay({ label, value }) {
  return (
    <div className="stat p-6 text-center">
      <div className="px text-[11px] mb-4">{label}</div>
      <div className="px text-[22px] text-black">{value}</div>
    </div>
  )
}

