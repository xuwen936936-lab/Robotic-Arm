import React, { useEffect, useRef, useState } from 'react'
import {
  captureCurrentPoint,
  initializeHardwareStore,
  resetMockRobotToHome,
  sendMockJogMove,
  startMockRun,
  useHardwareStore,
} from '../../services/useHardwareStore.ts'
import { AssemblyModelPageView } from './AssemblyModelPageView.jsx'

const EMPTY_POINT = { x: '', y: '', z: '', rx: '' }
const ASSEMBLY_RUN_MS = 5000
const COLLISION_SIGNAL_MS = 2200
const SINGULARITY_SIGNAL_MS = 2500
const REFERENCE_FRAME_OPTIONS = [
  { value: 'Base', label: 'Base' },
  { value: 'Flange', label: 'Flange' },
  { value: 'Tool A', label: 'Tool A' },
  { value: 'Start', label: 'Start' },
  { value: 'Target', label: 'Target' },
]
const JOG_FRAME_OPTIONS = [
  { value: 'Base', label: 'Base' },
  { value: 'Tool', label: 'Tool' },
]

function isPointFilled(point) {
  return point.x && point.y && point.z && point.rx
}

export default function AssemblyModelPage({ onGoExecution }) {
  const hardware = useHardwareStore()
  const [mode, setMode] = useState('pick')
  const [grab, setGrab] = useState(EMPTY_POINT)
  const [grabFrame, setGrabFrame] = useState('Base')
  const [drop, setDrop] = useState(EMPTY_POINT)
  const [dropFrame, setDropFrame] = useState('Base')
  const [waypoints, setWaypoints] = useState([])
  const [nextId, setNextId] = useState(1)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isRunningPreview, setIsRunningPreview] = useState(false)
  const [showCollisionToast, setShowCollisionToast] = useState(false)
  const [hasCollision, setHasCollision] = useState(false)
  const [showCollisionHintModal, setShowCollisionHintModal] = useState(false)
  const [selectedCollisionOption, setSelectedCollisionOption] = useState(null)
  const [collisionHintType, setCollisionHintType] = useState('waypoint')
  const [collisionHintStep, setCollisionHintStep] = useState(1)
  const [showRelativeHintInfo, setShowRelativeHintInfo] = useState(false)
  const [hasTriggeredDirectionCollision, setHasTriggeredDirectionCollision] = useState(false)
  const [hasTriggeredSingularityCollision, setHasTriggeredSingularityCollision] =
    useState(false)
  const [hasSingularityWarning, setHasSingularityWarning] = useState(false)
  const [isAutomaticReassemblyReady, setIsAutomaticReassemblyReady] = useState(false)
  const [stage, setStage] = useState('first-block') // first-block | second-block | third-block
  const [jogFrame, setJogFrame] = useState('Base')
  const runCompleteTimerRef = useRef(null)
  const collisionSignalTimerRef = useRef(null)

  const canConfirm = isPointFilled(grab) && isPointFilled(drop)
  const requiresRecordedPoints = stage !== 'first-block'
  const canConfirmNow = requiresRecordedPoints ? canConfirm : true

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    return () => {
      cleanupHardware()
      if (runCompleteTimerRef.current !== null) {
        window.clearTimeout(runCompleteTimerRef.current)
      }
      if (collisionSignalTimerRef.current !== null) {
        window.clearTimeout(collisionSignalTimerRef.current)
      }
      setIsRunningPreview(false)
    }
  }, [])

  useEffect(() => {
    if (!showCollisionToast) return undefined
    const toastTimerId = window.setTimeout(() => {
      setShowCollisionToast(false)
    }, 3500)
    return () => window.clearTimeout(toastTimerId)
  }, [showCollisionToast])

  const triggerCollision = (type) => {
    setIsRunningPreview(false)
    setHasCollision(true)
    setShowCollisionToast(true)
    setCollisionHintType(type)
    setCollisionHintStep(1)
    setSelectedCollisionOption(null)
  }

  const handleAddWaypoint = () => {
    const currentPoint = captureCurrentPoint()
    setWaypoints((prev) => [
      ...prev,
      {
        id: nextId,
        point: currentPoint,
        frame: jogFrame,
        isManuallyEdited: false,
      },
    ])
    setNextId((id) => id + 1)
  }

  const handleRemoveWaypoint = (id) => {
    setWaypoints((prev) => prev.filter((waypoint) => waypoint.id !== id))
  }

  const handlePointChange = (setter, axis, value) => {
    setter((prev) => ({ ...prev, [axis]: value }))
  }

  const handleWaypointChange = (id, axis, value) => {
    setWaypoints((prev) =>
      prev.map((waypoint) =>
        waypoint.id === id
          ? {
              ...waypoint,
              isManuallyEdited: true,
              point: {
                ...waypoint.point,
                [axis]: value,
              },
            }
          : waypoint,
      ),
    )
  }

  const handleRecordPoint = (setter) => {
    setter(captureCurrentPoint())
  }

  const handleRecordWaypoint = (id) => {
    const currentPoint = captureCurrentPoint()
    setWaypoints((prev) =>
      prev.map((waypoint) =>
        waypoint.id === id
          ? {
              ...waypoint,
              point: currentPoint,
              frame: jogFrame,
              isManuallyEdited: false,
            }
          : waypoint,
      ),
    )
  }

  const handleWaypointFrameChange = (id, frame) => {
    setWaypoints((prev) =>
      prev.map((waypoint) =>
        waypoint.id === id
          ? {
              ...waypoint,
              frame,
              isManuallyEdited: true,
            }
          : waypoint,
      ),
    )
  }

  const handleConfirmTest = () => {
    if (isRunningPreview || hardware.isRunning) return
    if (!canConfirmNow) return
    if (hasSingularityWarning) {
      void resetMockRobotToHome()
      setHasSingularityWarning(false)
      setHasCollision(false)
      setShowCollisionToast(false)
      setShowCollisionHintModal(false)
      setSelectedCollisionOption(null)
      setIsAutomaticReassemblyReady(true)
      return
    }

    setShowSuccessModal(false)
    setShowCollisionToast(false)
    setShowCollisionHintModal(false)
    setSelectedCollisionOption(null)
    setIsRunningPreview(true)
    startMockRun(ASSEMBLY_RUN_MS)

    if (runCompleteTimerRef.current !== null) {
      window.clearTimeout(runCompleteTimerRef.current)
    }
    if (collisionSignalTimerRef.current !== null) {
      window.clearTimeout(collisionSignalTimerRef.current)
    }

    const shouldTriggerWaypointCollision = stage === 'second-block' && waypoints.length < 1
    const hasManualWaypointInput = waypoints.some((waypoint) => waypoint.isManuallyEdited)
    const shouldTriggerDirectionCollision =
      stage === 'second-block' &&
      waypoints.length > 0 &&
      hasManualWaypointInput &&
      !hasTriggeredDirectionCollision
    const shouldTriggerSingularityCollision =
      stage === 'third-block' &&
      !hasTriggeredSingularityCollision

    if (
      shouldTriggerWaypointCollision ||
      shouldTriggerDirectionCollision ||
      shouldTriggerSingularityCollision
    ) {
      collisionSignalTimerRef.current = window.setTimeout(() => {
        collisionSignalTimerRef.current = null
        if (shouldTriggerSingularityCollision) {
          setHasTriggeredSingularityCollision(true)
          setHasSingularityWarning(true)
          triggerCollision('singularity')
          return
        }
        if (shouldTriggerDirectionCollision) {
          setHasTriggeredDirectionCollision(true)
          triggerCollision('direction')
          return
        }
        triggerCollision('waypoint')
      }, shouldTriggerSingularityCollision ? SINGULARITY_SIGNAL_MS : COLLISION_SIGNAL_MS)
      return
    }

    runCompleteTimerRef.current = window.setTimeout(() => {
      runCompleteTimerRef.current = null
      setIsRunningPreview(false)
      setHasCollision(false)
      setShowSuccessModal(true)
    }, ASSEMBLY_RUN_MS)
  }

  const handleNextBlock = () => {
    setShowSuccessModal(false)
    if (stage === 'first-block') {
      setStage('second-block')
    } else if (stage === 'second-block') {
      setStage('third-block')
    }
    setMode('pick')
    setGrab(EMPTY_POINT)
    setGrabFrame('Base')
    setDrop(EMPTY_POINT)
    setDropFrame('Base')
    setWaypoints([])
    setNextId(1)
    setIsRunningPreview(false)
    setHasCollision(false)
    setShowCollisionToast(false)
    setShowCollisionHintModal(false)
    setSelectedCollisionOption(null)
    setCollisionHintType('waypoint')
    setCollisionHintStep(1)
    setShowRelativeHintInfo(false)
    if (stage === 'first-block') {
      setHasTriggeredDirectionCollision(false)
    }
    if (stage === 'second-block') {
      setHasTriggeredSingularityCollision(false)
      setHasSingularityWarning(false)
      setIsAutomaticReassemblyReady(false)
    }
  }

  const handleSuccessPrimaryAction = () => {
    setShowSuccessModal(false)
    if (stage === 'third-block' && isAutomaticReassemblyReady) {
      if (typeof onGoExecution === 'function') {
        onGoExecution()
      }
      return
    }
    handleNextBlock()
  }

  const handleJogMove = async (axis, direction) => {
    const distance = axis === 'rx' ? 5 : 10
    await sendMockJogMove({
      axis,
      direction,
      frame: jogFrame,
      distance,
    })
  }

  return (
    <AssemblyModelPageView
      stage={stage}
      mode={mode}
      grab={grab}
      grabFrame={grabFrame}
      drop={drop}
      dropFrame={dropFrame}
      waypoints={waypoints}
      frameOptions={REFERENCE_FRAME_OPTIONS}
      jogFrameOptions={JOG_FRAME_OPTIONS}
      canConfirm={canConfirmNow}
      isAssemblyRunning={isRunningPreview}
      hasCollision={hasCollision}
      showCollisionToast={showCollisionToast}
      showCollisionHintModal={showCollisionHintModal}
      selectedCollisionOption={selectedCollisionOption}
      collisionHintType={collisionHintType}
      collisionHintStep={collisionHintStep}
      showRelativeHintInfo={showRelativeHintInfo}
      showSuccessModal={showSuccessModal}
      successPrimaryLabel={
        stage === 'third-block' && isAutomaticReassemblyReady
          ? 'Automatic reassembly'
          : 'Next block'
      }
      jogFrame={jogFrame}
      hasSingularityWarning={hasSingularityWarning}
      hardwareStatusLabel={
        hardware.connection === 'connected' ? 'Mock connected' : 'Disconnected'
      }
      temperatureLabel={`${hardware.temperature.toFixed(1)} C`}
      onToggleMode={() => setMode((prev) => (prev === 'pick' ? 'drop' : 'pick'))}
      onConfirmTest={handleConfirmTest}
      onNextBlock={handleNextBlock}
      onSuccessPrimaryAction={handleSuccessPrimaryAction}
      onOpenCollisionHint={() => setShowCollisionHintModal(true)}
      onCloseCollisionHint={() => {
        setShowCollisionHintModal(false)
        setSelectedCollisionOption(null)
        if (collisionHintType === 'singularity') return
        setShowRelativeHintInfo(true)
      }}
      onSelectCollisionOption={setSelectedCollisionOption}
      onConfirmCollisionHint={() => {
        if (collisionHintType === 'singularity') {
          if (selectedCollisionOption !== 'C') return
          setShowCollisionHintModal(false)
          setSelectedCollisionOption(null)
          setHasCollision(false)
          return
        }
        if (collisionHintType === 'direction' && collisionHintStep === 1) {
          if (selectedCollisionOption !== 'B') return
          setCollisionHintStep(2)
          setSelectedCollisionOption(null)
          return
        }
        if (collisionHintType === 'direction' && collisionHintStep === 2) {
          if (selectedCollisionOption !== 'A') return
          setShowCollisionHintModal(false)
          setHasCollision(false)
          setSelectedCollisionOption(null)
          setShowRelativeHintInfo(true)
          return
        }
        if (selectedCollisionOption !== 'B') return
        setShowCollisionHintModal(false)
        setHasCollision(false)
        setSelectedCollisionOption(null)
        setShowRelativeHintInfo(true)
      }}
      onAddWaypoint={handleAddWaypoint}
      onRemoveWaypoint={handleRemoveWaypoint}
      onChangeGrabAxis={(axis, value) => handlePointChange(setGrab, axis, value)}
      onChangeGrabFrame={setGrabFrame}
      onChangeDropAxis={(axis, value) => handlePointChange(setDrop, axis, value)}
      onChangeDropFrame={setDropFrame}
      onChangeWaypointAxis={handleWaypointChange}
      onChangeWaypointFrame={handleWaypointFrameChange}
      onChangeJogFrame={setJogFrame}
      onJogMove={handleJogMove}
      onRecordGrab={() => handleRecordPoint(setGrab)}
      onRecordDrop={() => handleRecordPoint(setDrop)}
      onRecordWaypoint={handleRecordWaypoint}
    />
  )
}
