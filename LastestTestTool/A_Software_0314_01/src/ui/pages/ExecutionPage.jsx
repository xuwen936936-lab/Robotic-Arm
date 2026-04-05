import React, { useEffect, useRef, useState } from 'react'
import { PageLayout } from '../components/PageLayout.jsx'
import { PixelCard } from '../components/PixelCard.jsx'
import { PixelButton } from '../components/PixelButton.jsx'
import { StepBar } from '../components/StepBar.jsx'
import { initializeHardwareStore, useHardwareStore } from '../../services/useHardwareStore.ts'
import './ExecutionPage.css'

const steps = [
  { id: 'step-1', status: 'done', position: 'first', label: '', title: 'INSTALL' },
  { id: 'step-2', status: 'done', position: 'middle', label: '', title: 'TEST' },
  { id: 'step-3', status: 'done', position: 'middle', label: '', title: 'ASSEMBLY' },
  { id: 'step-4', status: 'active', position: 'last', label: '', title: 'EXECUTE' },
]

const EXECUTION_SUCCESS_MS = 5200
const DANGER_SIGNAL_MS = 2300

export default function ExecutionPage({ onRestartGame }) {
  const hardware = useHardwareStore()
  const connectionInfo = `${
    hardware.connection === 'connected'
      ? 'Connected'
      : hardware.connection === 'error'
        ? 'Error'
        : 'Disconnected'
  } · ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`
  const [phase, setPhase] = useState('idle') // idle | running | paused-danger | success
  const [progress, setProgress] = useState(0)
  const [dangerWarning, setDangerWarning] = useState(false)
  const [hasTriggeredDangerSignal, setHasTriggeredDangerSignal] = useState(false)

  const progressIntervalRef = useRef(null)
  const completeTimeoutRef = useRef(null)
  const dangerTimeoutRef = useRef(null)

  const clearRunTimers = () => {
    if (progressIntervalRef.current !== null) {
      window.clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (completeTimeoutRef.current !== null) {
      window.clearTimeout(completeTimeoutRef.current)
      completeTimeoutRef.current = null
    }
    if (dangerTimeoutRef.current !== null) {
      window.clearTimeout(dangerTimeoutRef.current)
      dangerTimeoutRef.current = null
    }
  }

  useEffect(() => clearRunTimers, [])
  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    return cleanupHardware
  }, [])

  const startExecutionRun = () => {
    clearRunTimers()
    setPhase('running')
    setDangerWarning(false)
    setProgress(0)

    const startedAt = Date.now()
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setProgress(Math.min(0.98, elapsed / EXECUTION_SUCCESS_MS))
    }, 120)

    if (!hasTriggeredDangerSignal) {
      dangerTimeoutRef.current = window.setTimeout(() => {
        dangerTimeoutRef.current = null
        clearRunTimers()
        setHasTriggeredDangerSignal(true)
        setPhase('paused-danger')
        setDangerWarning(true)
        setProgress(0)
      }, DANGER_SIGNAL_MS)
      return
    }

    completeTimeoutRef.current = window.setTimeout(() => {
      completeTimeoutRef.current = null
      clearRunTimers()
      setProgress(1)
      setPhase('success')
      setDangerWarning(false)
    }, EXECUTION_SUCCESS_MS)
  }

  if (phase === 'success') {
    return (
      <PageLayout>
        <div className="execution-success-screen">
          <div className="execution-success-card">
            <div className="execution-success-model">
              <div className="execution-success-model-inner">
                <div className="execution-success-title">Congratulations!</div>
                <div className="execution-success-subtitle">Lion Gif</div>
              </div>
            </div>
          </div>
          <PixelButton
            variant="magenta"
            className="execution-success-cta"
            onClick={onRestartGame}
          >
            Restart the game
          </PixelButton>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between shrink-0 mb-10">
        <div className="assembly-page-title px text-[24px]">Lion Model Assembly Game</div>
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
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
            <div className="execution-title px text-[24px]">Debugging complete!</div>
            <div className="execution-paragraph text-[18px] leading-[1.35]">
              Reset the blocks, then run the robot in automatic mode to finish the
              full assembly.
            </div>
            <div className="execution-paragraph text-[18px] leading-[1.35]">
              Don&apos;t forget hold you E-stop button in hand while is running, and
              stay away from the danger area.
            </div>

            <div className="execution-danger-map">
              <img
                src="/placeholders/execution-warning-map-clean.png"
                alt="Warning area and singularity map"
                className="execution-danger-image"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            {phase === 'running' ? (
              <div className="assembly-running-shell w-full">
                <div className="running-bar assembly-running-fill" />
                <span className="assembly-running-label px text-[13px]">
                  Running...
                </span>
              </div>
            ) : (
              <PixelButton
                variant="magenta"
                className="w-full py-4 text-[18px]"
                onClick={startExecutionRun}
              >
                Run the Program
              </PixelButton>
            )}
          </div>

        </PixelCard>

        <PixelCard
          title="3D ROBOT MODEL"
          titleColor="var(--orange)"
          className="min-h-0 max-h-full flex flex-col overflow-hidden"
        >
          <div className="assembly-model-stage flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
            <div className="text-center">
              <div className="px text-[44px] mb-4">Lion Model</div>
              <div className="assembly-muted px text-[36px]">waiting for completing</div>
              {dangerWarning && (
                <div className="execution-danger-warning px mt-6">
                  Don&apos;t step in the dangerous area
                </div>
              )}
            </div>
          </div>
        </PixelCard>
      </div>

    </PageLayout>
  )
}
