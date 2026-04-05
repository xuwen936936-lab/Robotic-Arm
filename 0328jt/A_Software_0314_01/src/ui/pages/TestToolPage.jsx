import React, { useEffect, useRef, useState } from 'react'
import {
  HARDWARE_SIGNALS,
  initializeHardwareStore,
  subscribeHardwareSignal,
  startFixedMoveTest,
  useHardwareStore,
} from '../../services/useHardwareStore.ts'
import { TestToolPageView } from './TestToolPageView.jsx'

const RUN_DURATION_MS = 6000

export default function TestToolPage({ onStartGame, calibratedPayload = '2kg' }) {
  const hardware = useHardwareStore()
  const [status, setStatus] = useState('idle')
  const [showToast, setShowToast] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedTool, setSelectedTool] = useState('Flange')
  const resultTimerRef = useRef(null)
  const waitingHardwareResultRef = useRef(false)
  const selectedToolRef = useRef(selectedTool)

  const hasError = status === 'error'
  const isSuccess = status === 'success'
  const payloadValue = selectedTool === 'Tool A' ? calibratedPayload : '0'
  const connectionInfo = `${
    hardware.connection === 'connected'
      ? 'Connected'
      : hardware.connection === 'error'
        ? 'Error'
        : 'Disconnected'
  } · ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

  useEffect(() => {
    selectedToolRef.current = selectedTool
  }, [selectedTool])

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    const unsubscribeSignal = subscribeHardwareSignal((signal) => {
      if (!waitingHardwareResultRef.current) return
      if (signal !== HARDWARE_SIGNALS.TEST_TOOL_RUN_FINISHED) return

      waitingHardwareResultRef.current = false
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current)
        resultTimerRef.current = null
      }

      if (selectedToolRef.current === 'Tool A') {
        setStatus('success')
        return
      }
      setStatus('error')
      setShowToast(true)
    })

    return () => {
      cleanupHardware()
      unsubscribeSignal()
      waitingHardwareResultRef.current = false

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
    waitingHardwareResultRef.current = false
    startFixedMoveTest(RUN_DURATION_MS, selectedToolRef.current === 'Tool A')

    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current)
    }

    const isRealHardwarePath =
      hardware.source === 'hardware' && hardware.connection === 'connected'

    if (isRealHardwarePath) {
      // Real hardware path: prefer hardware completion signal.
      waitingHardwareResultRef.current = true
    }

    resultTimerRef.current = window.setTimeout(() => {
      resultTimerRef.current = null
      // Fallback for mock mode, and also safety fallback if hardware signal is missing.
      waitingHardwareResultRef.current = false
      if (selectedToolRef.current === 'Tool A') {
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
      connectionInfo={connectionInfo}
      isRunning={hardware.isRunning}
      hasError={hasError}
      isSuccess={isSuccess}
      showToast={showToast}
      showHintModal={showHintModal}
      selectedOption={selectedOption}
      selectedTool={selectedTool}
      payloadValue={payloadValue}
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
