import React, { useEffect } from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { InlineStep } from '../components/InlineStep.jsx'
import { InstallToolGuideImages } from '../components/InstallToolGuideImages.jsx'
import { mediaAssets } from '../mediaAssets.js'
import { initializeHardwareStore, useHardwareStore } from '../../services/useHardwareStore.ts'

const steps = [
  {
    id: 'step-1',
    status: 'active',
    position: 'first',
    label: '',
    title: 'INSTALL',
  },
  {
    id: 'step-2',
    status: 'pending_3',
    position: 'middle',
    label: '',
    title: 'TEST',
  },
  {
    id: 'step-3',
    status: 'pending_3',
    position: 'middle',
    label: '',
    title: 'ASSEMBLY',
  },
  {
    id: 'step-4',
    status: 'pending_4',
    position: 'last',
    label: '',
    title: 'EXECUTE',
  },
]

export default function InstallToolPage({ onInstalled }) {
  const hardware = useHardwareStore()
  const connectionInfo = `${
    hardware.connection === 'connected'
      ? 'Connected'
      : hardware.connection === 'error'
        ? 'Error'
        : 'Disconnected'
  } · ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

  useEffect(() => {
    const cleanup = initializeHardwareStore()
    return cleanup
  }, [])

  const handleInstalledClick = () => {
    if (typeof onInstalled === 'function') {
      onInstalled()
    }
  }

  return (
    <PageLayout>
      <div className="mb-10 flex shrink-0 items-center justify-between">
          <div className="px text-[24px]" style={{ color: 'var(--panel)' }}>
            Lion Model Assembly Game
          </div>
          <div className="flex items-center gap-3">
            <div className="connection-pill px text-[9px] px-2 py-2">
              {connectionInfo}
            </div>
            <div className="swatch" style={{ background: 'var(--bgPurple)' }} />
            <div className="swatch" style={{ background: 'var(--orange)' }} />
            <div className="swatch" style={{ background: 'var(--magenta)' }} />
          </div>
        </div>

        <StepBar steps={steps} />

        <div className="grid max-lg:grid-cols-1 max-lg:[grid-auto-rows:max-content] max-lg:flex-none gap-8 lg:grid-cols-[4fr_3fr] lg:flex-1 lg:min-h-0">
          <PixelCard
            padding="p-6"
            className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto max-lg:min-h-min max-lg:flex-none max-lg:overflow-visible">
              <div className="flex gap-4 items-start">
                <div className="flex-1 flex flex-col gap-4">
                  <InlineStep index="1" label="Install the tool" />
                  <InstallToolGuideImages />
                </div>
              </div>

              <div className="flex mt-4">
                <PixelButton
                  variant="magenta"
                  className="px-10 py-4 text-[12px]"
                  onClick={handleInstalledClick}
                >
                  INSTALLED
                </PixelButton>
              </div>
            </div>
          </PixelCard>

          <PixelCard
            title="3D ROBOT MODEL"
            titleColor="var(--orange)"
            className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:flex-none">
              <div
                className="relative min-h-[240px] w-full flex-1 overflow-hidden max-lg:min-h-[min(52vh,340px)] max-lg:flex-none"
                style={{
                  border: '3px dashed var(--ink)',
                  background: 'var(--panel)',
                }}
              >
                <img
                  src={mediaAssets.robot3dPreview}
                  alt="Robot arm hardware preview"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
            </div>
          </PixelCard>
        </div>
    </PageLayout>
  )
}

