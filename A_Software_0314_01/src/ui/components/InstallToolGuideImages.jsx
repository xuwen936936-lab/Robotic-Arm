import React from 'react'

const IMAGES = [
  { src: '/install-tool-guide/1.png', alt: 'Tool installation step 1' },
  { src: '/install-tool-guide/2.png', alt: 'Tool installation step 2' },
  { src: '/install-tool-guide/3.png', alt: 'Tool installation step 3' },
]

export function InstallToolGuideImages() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {IMAGES.map((item) => (
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
