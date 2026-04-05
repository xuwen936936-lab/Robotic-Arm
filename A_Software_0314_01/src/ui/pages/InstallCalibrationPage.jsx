import React, { useState, useEffect, useRef } from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { PixelProgressBar } from '../components/PixelProgressBar.jsx'
import { InlineStep } from '../components/InlineStep.jsx'
import { InstallToolGuideImages } from '../components/InstallToolGuideImages.jsx'
import { initializeHardwareStore, useHardwareStore } from '../../services/useHardwareStore.ts'

const YOUTUBE_VIDEO_ID = 'q7YXq3LCzTM'

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
      onNext({
        calibratedPayload: '2kg',
      })
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

        <div className="grid max-lg:grid-cols-1 max-lg:[grid-auto-rows:max-content] max-lg:flex-none gap-[1.333rem] lg:grid-cols-[4fr_3fr] lg:flex-1 lg:min-h-0">
          <PixelCard
            padding="p-6"
            className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
          >
            <div
              ref={leftScrollRef}
              className="flex min-h-0 flex-1 flex-col gap-[1.333rem] overflow-y-auto max-lg:min-h-min max-lg:flex-none max-lg:overflow-visible"
            >
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-[0.667rem]">
                  <InlineStep index="1" label="Install the tool" />
                  <div className="pl-10">
                    <InstallToolGuideImages />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-[0.667rem]">
                  <InlineStep index="2" label="Tool installed! Next mission: calibration" />
                  <div className="flex flex-col gap-[0.667rem] pl-10">
                    <div
                      className="text-sm"
                      style={{ color: 'var(--muted)' }}
                    >
                      Calibrate the tool to unlock its TCP and payload data. Watch
                      the video on the right to learn the correct way to complete
                      this step.
                    </div>

                    <div className="flex w-full max-w-full flex-col gap-[0.667rem]">
                      <div className="flex flex-col gap-[calc(0.5rem*2/3)]">
                        <div
                          className="text-[12px] font-bold"
                          style={{
                            color: 'var(--magenta)',
                            fontFamily:
                              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                          }}
                        >
                          TCP (Tool Center Point)
                        </div>
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          The tool&apos;s working point — where the robot&apos;s
                          &quot;hand&quot; touches and interacts with objects.
                        </div>
                      </div>
                      <div className="flex flex-col gap-[calc(0.5rem*2/3)]">
                        <div
                          className="text-[12px] font-bold"
                          style={{
                            color: 'var(--magenta)',
                            fontFamily:
                              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                          }}
                        >
                          Payload
                        </div>
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          How heavy the tool is, and where its weight is balanced.
                        </div>
                      </div>
                    </div>

                    <div className="mt-0">
                      <PixelProgressBar value={videoProgress} />
                    </div>
                  </div>
                </div>
              </div>

              {videoCompleted && (
                <>
                  <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-[0.667rem]">
                      <InlineStep index="3" label="Calibration results" />

                      <div className="flex flex-col gap-[0.667rem] pl-10">
                        <div className="grid grid-cols-2 gap-[0.667rem]">
                          <div className="flex items-center gap-2">
                            <div className="px shrink-0 text-[8px] leading-tight">Name</div>
                            <div
                              className="text-[11px] flex-1 min-w-0"
                              style={{
                                border: '2px solid var(--ink)',
                                background: 'var(--panel)',
                                padding: '6px 10px',
                              }}
                            >
                              Tool A
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="px shrink-0 text-[8px] leading-tight">Payload</div>
                            <div
                              className="text-[11px] flex-1 min-w-0"
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

                        <div className="flex items-center gap-3">
                          <div className="px shrink-0 text-[8px] leading-tight">TCP</div>
                          <div className="grid grid-cols-4 gap-2 flex-1 min-w-0">
                            {['X', 'Y', 'Z', 'Rx'].map((axis) => (
                              <div key={axis} className="flex items-center gap-2 min-w-0">
                                <div className="text-[12px]">{axis}</div>
                                <div
                                  className="text-[11px] text-center flex-1 min-w-0"
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
              <div className="shrink-0 mt-4 w-full">
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
            title="Tool Calibration Procedure"
            titleColor="var(--orange)"
            className="flex min-h-0 max-h-full flex-col overflow-hidden max-lg:max-h-none"
          >
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden max-lg:flex-none"
              style={{
                border: '3px dashed var(--ink)',
                background: 'var(--panel)',
              }}
            >
              <div className="relative min-h-[240px] w-full flex-1 overflow-hidden bg-black max-lg:min-h-[min(52vh,340px)] max-lg:flex-none">
                <div
                  ref={videoContainerRef}
                  className="absolute inset-0 h-full w-full min-h-[200px]"
                />
              </div>
            </div>
          </PixelCard>
        </div>
    </PageLayout>
  )
}

