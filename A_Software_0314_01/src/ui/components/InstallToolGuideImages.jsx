import React from 'react'
import { mediaAssets } from '../mediaAssets.js'

export function InstallToolGuideImages() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {mediaAssets.installToolGuide.map((item) => (
        <div
          key={item.src}
          className="flex items-center justify-center overflow-hidden aspect-[2/1] w-full min-h-0"
          style={{
            border: '3px solid var(--ink)',
            boxShadow: '6px 6px 0 var(--shadow)',
            background: 'var(--panel)',
          }}
        >
          <img
            src={item.src}
            alt={item.alt}
            className="max-h-full w-full object-contain"
          />
        </div>
      ))}
    </div>
  )
}
