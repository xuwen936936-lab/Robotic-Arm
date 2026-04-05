import React, { useEffect } from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { InlineStep } from '../components/InlineStep.jsx'
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
      <div className="flex items-center justify-between shrink-0 mb-10">
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

        <div className="grid lg:grid-cols-[4fr_3fr] gap-8 flex-1 min-h-0 max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <PixelCard
            padding="p-6"
            className="min-h-0 max-h-full flex flex-col overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-8">
              <div className="flex gap-4 items-start">
                <div className="flex-1 flex flex-col gap-4">
                  <InlineStep index="1" label="Install the tool" />
                  <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        className="flex items-center justify-center overflow-hidden"
                        style={{
                          border: '3px solid var(--ink)',
                          boxShadow: '6px 6px 0 var(--shadow)',
                          background: 'var(--panel)',
                          minHeight: '72px',
                        }}
                      >
                        <img
                          src="/placeholders/illustration.svg"
                          alt=""
                          className="w-full h-full object-cover min-h-[72px]"
                        />
                      </div>
                    ))}
                  </div>
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
            className="min-h-0 max-h-full flex flex-col overflow-hidden"
          >
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center min-h-[240px]">
              <div
                className="relative flex items-center justify-center w-full h-full"
                style={{
                  border: '3px dashed var(--ink)',
                  background: 'var(--panel)',
                }}
              >
                <img
                  src="/placeholders/3d-model.svg"
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </PixelCard>
        </div>
    </PageLayout>
  )
}

