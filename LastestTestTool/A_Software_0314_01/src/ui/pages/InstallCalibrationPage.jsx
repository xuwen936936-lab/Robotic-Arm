import React, { useState, useEffect, useRef } from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { PixelProgressBar } from '../components/PixelProgressBar.jsx'
import { InlineStep } from '../components/InlineStep.jsx'
import { initializeHardwareStore, useHardwareStore } from '../../services/useHardwareStore.ts'

const YOUTUBE_VIDEO_ID = 'jNQXAC9IVRw'

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

export default function InstallCalibrationPage({ onNext }) {
  const hardware = useHardwareStore()
  const connectionInfo = `${
    hardware.connection === 'connected'
      ? 'Connected'
      : hardware.connection === 'error'
        ? 'Error'
        : 'Disconnected'
  } · ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`
  const [videoCompleted, setVideoCompleted] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const videoContainerRef = useRef(null)
  const leftScrollRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    return cleanupHardware
  }, [])

  useEffect(() => {
    function initPlayer() {
      if (!videoContainerRef.current || !window.YT || !window.YT.Player) return
      playerRef.current = new window.YT.Player(videoContainerRef.current, {
        videoId: YOUTUBE_VIDEO_ID,
        events: {
          onStateChange: (e) => {
            if (e.data === 0) setVideoCompleted(true)
          },
        },
      })
    }
    if (window.YT && window.YT.Player) {
      initPlayer()
      return () => { if (playerRef.current?.destroy) playerRef.current.destroy() }
    }
    const id = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(id)
        initPlayer()
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const tick = () => {
      const p = playerRef.current
      if (!p || !p.getCurrentTime || !p.getDuration) return
      const duration = p.getDuration()
      if (duration <= 0) return
      const current = p.getCurrentTime()
      setVideoProgress(Math.min(1, current / duration))
    }
    const id = setInterval(tick, 300)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!videoCompleted || !leftScrollRef.current) return
    leftScrollRef.current.scrollTo({
      top: leftScrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [videoCompleted])

  const handleNextClick = () => {
    if (typeof onNext === 'function') {
      onNext()
    }
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between shrink-0 mb-10">
          <div className="px text-[24px]" style={{ color: '#FFFFFF' }}>
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
            <div
              ref={leftScrollRef}
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-8"
            >
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-4">
                  <InlineStep index="1" label="Install the tool" />
                  <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        className="flex items-center justify-center"
                        style={{
                          border: '3px solid var(--ink)',
                          boxShadow: '6px 6px 0 var(--shadow)',
                          background: 'var(--panel)',
                          minHeight: '72px',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-4">
                  <InlineStep index="2" label="Tool installed! Next mission: Calibration" />
                  <div
                    className="text-sm"
                    style={{ color: 'var(--muted)' }}
                  >
                    Calibrate the tool to unlock its TCP and payload data. Watch
                    the video to learn the correct way to complete this step.
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div
                      className="pixel-card overflow-hidden min-h-[200px]"
                      style={{ background: 'var(--panel)' }}
                    >
                      <div ref={videoContainerRef} className="w-full h-full min-h-[200px]" />
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="px text-[10px]" style={{ color: 'var(--magenta)' }}>
                        TCP (Tool Center Point)
                      </div>
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>
                        The tool&apos;s working point — where the robot&apos;s
                        &quot;hand&quot; touches and interacts with objects.
                      </div>
                      <div className="px text-[10px]" style={{ color: 'var(--magenta)' }}>
                        Payload
                      </div>
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>
                        How heavy the tool is, and where its weight is balanced.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <PixelProgressBar value={videoProgress} />
                  </div>
                </div>
              </div>

              {videoCompleted && (
                <>
                  <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-4">
                      <InlineStep index="3" label="Calibration results" />

                      <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="px text-[10px] mb-1">Name</div>
                            <div
                              className="px text-[11px]"
                              style={{
                                border: '2px solid var(--ink)',
                                background: 'var(--panel)',
                                padding: '6px 10px',
                              }}
                            >
                              Tool A
                            </div>
                          </div>
                          <div>
                            <div className="px text-[10px] mb-1">Payload</div>
                            <div
                              className="px text-[11px]"
                              style={{
                                border: '2px solid var(--ink)',
                                background: 'var(--panel)',
                                padding: '6px 10px',
                              }}
                            >
                              2kg
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="px text-[10px] mb-2">TCP</div>
                          <div className="grid grid-cols-4 gap-2">
                            {['X', 'Y', 'Z', 'Rx'].map((axis) => (
                              <div key={axis} className="flex items-center gap-2 min-w-0">
                                <div className="px text-[12px]">{axis}</div>
                                <div
                                  className="px text-[11px] text-center flex-1 min-w-0"
                                  style={{
                                    border: '2px solid var(--ink)',
                                    background: 'var(--panel)',
                                    padding: '6px 10px',
                                  }}
                                >
                                  {axis === 'Rx' ? '0.00' : '100.00'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {videoCompleted && (
              <div className="shrink-0 mt-6 w-full">
                <PixelButton
                  variant="magenta"
                  className="w-full py-4 text-[12px]"
                  onClick={handleNextClick}
                >
                  NEXT
                </PixelButton>
              </div>
            )}
          </PixelCard>

          <PixelCard
            title="3D ROBOT MODEL"
            titleColor="var(--orange)"
            className="min-h-0 max-h-full flex flex-col overflow-hidden"
          >
            <div
              className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center"
              style={{
                border: '3px dashed var(--ink)',
                background: 'var(--panel)',
              }}
            >
              <div className="relative w-full h-full flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="px text-[16px] mb-2">
                    Lion Model
                  </div>
                  <div className="px text-[12px]" style={{ color: 'var(--muted)' }}>
                    Install the first building block
                  </div>
                </div>

                <div className="absolute bottom-10 left-10 flex flex-col items-center gap-1">
                  <div className="px text-[10px]">Base</div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Z ↑
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    X →
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Y •
                  </div>
                </div>

                <div className="absolute bottom-10 right-10 flex flex-col items-center gap-1">
                  <div className="px text-[10px]">TCP</div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Z ↑
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    X →
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Y •
                  </div>
                </div>

                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="px text-[10px]">Flange</div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Z ↑
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    X →
                  </div>
                  <div className="px text-[9px]" style={{ color: 'var(--muted)' }}>
                    Y •
                  </div>
                </div>
              </div>
            </div>
          </PixelCard>
        </div>
    </PageLayout>
  )
}

