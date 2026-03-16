import React, { useEffect, useRef, useState } from 'react'
import {
  initializeHardwareStore,
  startFixedMoveTest,
  useHardwareStore,
} from '../../services/useHardwareStore.ts'
import { TestToolPageView } from './TestToolPageView.jsx'

const RUN_DURATION_MS = 6000

export default function TestToolPage({ onStartGame }) {
  const hardware = useHardwareStore()
  const [status, setStatus] = useState('idle')
  const [showToast, setShowToast] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedTool, setSelectedTool] = useState('Flange')
  const resultTimerRef = useRef(null)

  const hasError = status === 'error'
  const isSuccess = status === 'success'

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()

    return () => {
      cleanupHardware()

      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!showToast) return undefined

    const toastTimerId = window.setTimeout(() => {
      setShowToast(false)
    }, 3000)

    return () => window.clearTimeout(toastTimerId)
  }, [showToast])

  const handleTestClick = () => {
    if (hardware.isRunning) return

    setStatus('idle')
    setShowToast(false)
    setShowHintModal(false)
    //startMockRun(RUN_DURATION_MS)
    startFixedMoveTest(RUN_DURATION_MS) // <-- 改为调用我们写的方法

    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current)
    }

    resultTimerRef.current = window.setTimeout(() => {
      resultTimerRef.current = null

      if (selectedTool === 'Tool 1') {
        setStatus('success')
        return
      }

      setStatus('error')
      setShowToast(true)
    }, RUN_DURATION_MS)
  }

  return (
    <TestToolPageView
      coords={hardware.coords}
      connectionLabel={
        hardware.connection === 'connected' ? 'Mock connected' : 'Disconnected'
      }
      temperatureLabel={`${hardware.temperature.toFixed(1)} C`}
      sourceLabel="Mock telemetry"
      isRunning={hardware.isRunning}
      hasError={hasError}
      isSuccess={isSuccess}
      showToast={showToast}
      showHintModal={showHintModal}
      selectedOption={selectedOption}
      selectedTool={selectedTool}
      onSelectTool={setSelectedTool}
      onSelectOption={setSelectedOption}
      onPrimaryAction={
        isSuccess && onStartGame ? onStartGame : handleTestClick
      }
      onOpenHintModal={() => setShowHintModal(true)}
      onCloseHintModal={() => setShowHintModal(false)}
      onConfirmHintModal={() => {
        if (selectedOption !== 'C') return
        setShowHintModal(false)
        setSelectedOption(null)
      }}
    />
  )
}
