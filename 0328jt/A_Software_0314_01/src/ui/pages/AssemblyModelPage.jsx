import React, { useEffect, useRef, useState } from 'react'
import {
  HARDWARE_SIGNALS,
  captureCurrentPoint,
  initializeHardwareStore, 
  //0319
  startAssemblyTeachMode, 
  resetMockRobotToHome,
  sendMockJogMove,
  subscribeHardwareSignal,
  startMockRun,
  useHardwareStore,
  saveHardwarePath, //0331
  clearAssemblyPoints, //0401
  sendAssemblyTeachEnable,
} from '../../services/useHardwareStore.ts'
import { AssemblyModelPageView } from './AssemblyModelPageView.jsx'

//const EMPTY_POINT = { x: '', y: '', z: '', rx: '' }
//0330
const EMPTY_POINT = { x: '', y: '', z: '', rx: '', isManual: false }
const ASSEMBLY_RUN_MS = 5000
const COLLISION_SIGNAL_MS = 2200
const SINGULARITY_SIGNAL_MS = 2500
const MAX_WAYPOINTS = 2
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

// function isPointFilled(point) {
//   return point.x && point.y && point.z && point.rx
// }

//0330
function isPointFilled(point) {
  // ?????????????????????????
  return point.x !== '' && point.y !== '' && point.z !== '' && point.rx !== ''
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
  const [showWrongAnswerToast, setShowWrongAnswerToast] = useState(false)
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
  const waitingP2HardwareSignalRef = useRef(false)
  const waitingDirectionHardwareSignalRef = useRef(false)
  const waitingSingularityHardwareSignalRef = useRef(false)
  const stageRef = useRef(stage)
  const waypointCountRef = useRef(waypoints.length)

  const canConfirm = isPointFilled(grab) && isPointFilled(drop)
  const requiresRecordedPoints = stage !== 'first-block'
  const canConfirmNow = requiresRecordedPoints ? canConfirm : true
  const connectionInfo = `${
    hardware.connection === 'connected'
      ? 'Connected'
      : hardware.connection === 'error'
        ? 'Error'
        : 'Disconnected'
  } Â· ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  useEffect(() => {
    waypointCountRef.current = waypoints.length
  }, [waypoints.length])

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    const unsubscribeSignal = subscribeHardwareSignal((rawSignal) => {

      let signal = rawSignal;
      // === ???????????????????????????????????????????????????????????? ===
      if (signal === 'RAW_ESTOP_TRIGGERED') {
        if (stageRef.current === 'second-block') {
          if (waypointCountRef.current < 1) {
            // ?????????????? -> ??????????????????????????????????
            signal = HARDWARE_SIGNALS.ASSEMBLY_REACHED_SPECIFIED_POINT;
          } else {
            // ???????????????? -> ?????????????????????????????
            signal = HARDWARE_SIGNALS.ASSEMBLY_ESTOP_BEFORE_TARGET;
          }
        }
      }

      // //0404 ????????????????????????????
      // if (
      //   waitingSingularityHardwareSignalRef.current &&
      //   signal === HARDWARE_SIGNALS.ASSEMBLY_SINGULARITY_REACHED &&
      //   stageRef.current === 'third-block' // <--- ??????????????????????? 
      // ) {
      //   waitingSingularityHardwareSignalRef.current = false;
      //   // ?????????????????????????
      //   if (runCompleteTimerRef.current !== null) {
      //     window.clearTimeout(runCompleteTimerRef.current);
      //     runCompleteTimerRef.current = null;
      //   }
      //   setHasTriggeredSingularityCollision(true);
      //   setHasSingularityWarning(true);
      //   triggerCollision('singularity'); // ???????????????????? [cite: 441]
      // }

      // 0404 ??????????????????????????????????????????
      if (
        signal === HARDWARE_SIGNALS.ASSEMBLY_SINGULARITY_REACHED &&
        stageRef.current === 'third-block'
      ) {
        waitingSingularityHardwareSignalRef.current = false;
        if (runCompleteTimerRef.current !== null) {
          window.clearTimeout(runCompleteTimerRef.current);
          runCompleteTimerRef.current = null;
        }
        if (collisionSignalTimerRef.current !== null) {
          window.clearTimeout(collisionSignalTimerRef.current);
          collisionSignalTimerRef.current = null;
        }
        setHasTriggeredSingularityCollision(true);
        setHasSingularityWarning(true);
        triggerCollision('singularity'); // ????????????????????
        return; // ?????????????????
      }

      if (
        waitingP2HardwareSignalRef.current &&
        signal === HARDWARE_SIGNALS.ASSEMBLY_REACHED_SPECIFIED_POINT &&
        stageRef.current === 'second-block' &&
        waypointCountRef.current < 1
      ) {
        waitingP2HardwareSignalRef.current = false
        waitingDirectionHardwareSignalRef.current = false
        if (runCompleteTimerRef.current !== null) {
          window.clearTimeout(runCompleteTimerRef.current)
          runCompleteTimerRef.current = null
        }
        if (collisionSignalTimerRef.current !== null) {
          window.clearTimeout(collisionSignalTimerRef.current)
          collisionSignalTimerRef.current = null
        }
        triggerCollision('waypoint')
        return
      }

      if (
        waitingDirectionHardwareSignalRef.current &&
        signal === HARDWARE_SIGNALS.ASSEMBLY_ESTOP_BEFORE_TARGET &&
        stageRef.current === 'second-block'
      ) {
        waitingDirectionHardwareSignalRef.current = false
        waitingP2HardwareSignalRef.current = false
        if (runCompleteTimerRef.current !== null) {
          window.clearTimeout(runCompleteTimerRef.current)
          runCompleteTimerRef.current = null
        }
        if (collisionSignalTimerRef.current !== null) {
          window.clearTimeout(collisionSignalTimerRef.current)
          collisionSignalTimerRef.current = null
        }
        setHasTriggeredDirectionCollision(true)
        triggerCollision('direction')
        return
      }

      // if (
      //   waitingSingularityHardwareSignalRef.current &&
      //   signal === HARDWARE_SIGNALS.ASSEMBLY_SINGULARITY_REACHED &&
      //   stageRef.current === 'third-block'
      // ) {
      //   waitingSingularityHardwareSignalRef.current = false
      //   waitingP2HardwareSignalRef.current = false
      //   waitingDirectionHardwareSignalRef.current = false
      //   if (runCompleteTimerRef.current !== null) {
      //     window.clearTimeout(runCompleteTimerRef.current)
      //     runCompleteTimerRef.current = null
      //   }
      //   if (collisionSignalTimerRef.current !== null) {
      //     window.clearTimeout(collisionSignalTimerRef.current)
      //     collisionSignalTimerRef.current = null
      //   }
      //   setHasTriggeredSingularityCollision(true)
      //   setHasSingularityWarning(true)
      //   triggerCollision('singularity')
      // }
    })

    return () => {
      cleanupHardware()
      unsubscribeSignal()
      waitingP2HardwareSignalRef.current = false
      waitingDirectionHardwareSignalRef.current = false
      waitingSingularityHardwareSignalRef.current = false
      if (runCompleteTimerRef.current !== null) {
        window.clearTimeout(runCompleteTimerRef.current)
      }
      if (collisionSignalTimerRef.current !== null) {
        window.clearTimeout(collisionSignalTimerRef.current)
      }
      setIsRunningPreview(false)
    }
  }, [])
  

  // //0324  ?????????????????????????????1s????????U
  // useEffect(() => {
  //   if (hardware.connection === 'connected' && hardware.source === 'hardware') {
  //     console.log("Detected Real Robot connection. Initializing with delay...");
      
  //     // ?????????????????????·??????
  //     const initTimer = setTimeout(() => {
  //       import('../../services/useHardwareStore.ts').then(m => {
  //         m.startAssemblyTeachMode();
  //       });
  //     }, 1000); // ???????? 1 ??

  //     return () => clearTimeout(initTimer);
  //   }
  // }, [hardware.connection, hardware.source]);

  // 0328 ??????????????? 2 ???????????????????????? (??? U?????? K)
  // useEffect(() => {
    // ???????????????????????????????????
  //   if (hardware.connection === 'connected' && hardware.source === 'hardware') {
  //     const timer = setTimeout(() => {
  //       console.log("[Assembly] 2s delayed: Entering teach mode (U)...");
  //       // ??????????????????????? store ???????????? enterTeachMode
  //       import('../../services/useHardwareStore.ts').then(m => {
  //         if (m.startAssemblyTeachMode) m.startAssemblyTeachMode();
  //       });
  //     }, 2000); 

  //     return () => clearTimeout(timer);
  //   }
  // }, [hardware.connection, hardware.source]);

  //0401 ??????????????????????????????????? C ????????????????????????????????????????????????????????????
  useEffect(() => {
    if (hardware.connection === 'connected' && hardware.source === 'hardware') {
      const timer = setTimeout(() => {
        console.log("[Assembly] 2s delayed: Entering teach mode (U)...");
        import('../../services/useHardwareStore.ts').then(m => {
          if (m.clearAssemblyPoints) m.clearAssemblyPoints(); // <--- ???????????????????????
          if (m.startAssemblyTeachMode) m.startAssemblyTeachMode();
        });
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [hardware.connection, hardware.source]);

  useEffect(() => {
    if (!showCollisionToast) return undefined
    const toastTimerId = window.setTimeout(() => {
      setShowCollisionToast(false)
    }, 3500)
    return () => window.clearTimeout(toastTimerId)
  }, [showCollisionToast])

  useEffect(() => {
    if (!showWrongAnswerToast) return undefined
    const toastTimerId = window.setTimeout(() => {
      setShowWrongAnswerToast(false)
    }, 2000)
    return () => window.clearTimeout(toastTimerId)
  }, [showWrongAnswerToast])

  //0330 ?????????????????????
  // useEffect(() => {
  //   // ??????????????????????????
  //   const checkAndSend = (point, type, frame) => {
  //     if (isPointFilled(point)) {
  //       hardware.sendManualPoint(type, point, frame);
  //     }
  //   };

  //   // ???????????û??????? 500ms ???????
  //   const timer = setTimeout(() => {
  //     // ???? Pick ??
  //     checkAndSend(grab, 'pick', grabFrame);
      
  //     // ???? Drop ??
  //     checkAndSend(drop, 'drop', dropFrame);
      
  //     // ???? Waypoints
  //     waypoints.forEach((wp, index) => {
  //       const type = index === 0 ? 'w1' : 'w2';
  //       checkAndSend(wp.point, type, wp.frame);
  //     });
  //   }, 500);

  //   return () => clearTimeout(timer); // ??????????????????????
  // }, [grab, drop, waypoints, grabFrame, dropFrame]); // ??????????????

  useEffect(() => {
  const checkAndSend = (point, type, frame, isManual = false) => {
    // ???????????????????????????????isManual ? true????????
    if (isPointFilled(point) && isManual) {
      hardware.sendManualPoint(type, point, frame);
    }
  };

  const timer = setTimeout(() => {
    // 1. ???? Pick ????????????????? handlePointChange ?????ñ???
    // ???????????????? grab ???????????
    checkAndSend(grab, 'pick', grabFrame, grab.isManual);
    
    // 2. ???? Drop ??
    checkAndSend(drop, 'drop', dropFrame, drop.isManual);
    
    // 3. ???? Waypoints???????ô?????????? isManuallyEdited ????
    waypoints.forEach((wp, index) => {
      const type = index === 0 ? 'w1' : 'w2';
      checkAndSend(wp.point, type, wp.frame, wp.isManuallyEdited);
    });
  }, 500);

  return () => clearTimeout(timer);
}, [grab, drop, waypoints, grabFrame, dropFrame]);


  const triggerCollision = (type) => {
    setIsRunningPreview(false)
    setHasCollision(true)
    setShowCollisionToast(true)
    setShowWrongAnswerToast(false)
    setCollisionHintType(type)
    setCollisionHintStep(1)
    setSelectedCollisionOption(null)
  }

  const handleAddWaypoint = () => {
    if (waypoints.length >= MAX_WAYPOINTS) return
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
    setter((prev) => ({ ...prev, 
      [axis]: value,
      isManual: true //0330 ????û?????????????? true
     }))
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

  // const handleRecordPoint = (setter) => {
  //   setter(captureCurrentPoint())
  // }

  // //0324 ????
  // const handleRecordPoint = (setter, type) => {
  //   // ? ??????? hardware ??????ã??????????????????????????·
  //   if (hardware.recordPointWithSignal) {
  //     const point = hardware.recordPointWithSignal(type);
  //     setter(point);
  //   } else {
  //     console.error("recordPointWithSignal is not exported from hardware store!");
  //   }
  // }

  // AssemblyModelPage.jsx

// const handleRecordPoint = (setter, type) => {

//   // ???? store ?????????
//   // setter ???????????????????????
//   hardware.recordPointWithSignal(type, (newCoords) => {
//     setter(newCoords); // ?????????? setGrab(newCoords) ?? setDrop(newCoords)
//     // console.log(`[UI] ${type} point updated:`, newCoords);
//   });

//   // // 2. ????????????????????????????????????
//   // const unsubscribe = subscribeHardwareSignal((payload) => {
//   //   // ????????????µ??????
//   //   if (typeof payload === 'object' && payload.x) {
//   //     setter(payload); // ???????????????????????????? Pick/Drop ???
//   //     unsubscribe();   // ????????????????????????????????????
//   //   }
//   // });
// };
// 0328 ???? Pick Point (????) ??? Drop Point (?????) ??? RECORD ??????
  const handleRecordPoint = async (setter, type) => {
    // ????????????????????????????????????????????????????????????????
    const frame = type === 'pick' ? grabFrame : dropFrame;
    // ??????? 'A' (???????????? RECORD_START)??????????? 'B' (RECORD_END)
    const cmd = type === 'pick' ? 'RECORD_START' : 'RECORD_END'; 
    
    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 1. ????????????????????????? -> ???1??? -> ??? P/TP???
        await m.triggerAtomicRecord(cmd, frame);
        
        // 2. ??????????????????????????????? (400ms ?????????????????????????)
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint(); // ?????????????????????????????
          setter({ ...newCoords, isManual: false }); //0330
        }, 400);
      }
    });
  };

  // const handleRecordWaypoint = (id) => {
  //   const currentPoint = captureCurrentPoint()
  //   setWaypoints((prev) =>
  //     prev.map((waypoint) =>
  //       waypoint.id === id
  //         ? {
  //             ...waypoint,
  //             point: currentPoint,
  //             frame: jogFrame,
  //             isManuallyEdited: false,
  //           }
  //         : waypoint,
  //     ),
  //   )
  // }
// 0328 ???? WayPoint (??????) ??? RECORD ??????
  const handleRecordWaypoint = async (id) => {
    // 1. ??????????????????? id ???????????????????????????(index)
    const index = waypoints.findIndex(wp => wp.id === id);
    if (index === -1) {
        console.error("[UI] Waypoint ID not found:", id);
        return;
    }

    // 2. ??????????????????????
    const frame = waypoints[index].frame || 'Base'; 
    const cmd = index === 0 ? 'RECORD_W1' : 'RECORD_W2'; // ??? Bridge ?????? W ??? X
    
    console.log(`[UI] Recording Waypoint ${index + 1} (ID:${id}) -> CMD: ${cmd}, Frame: ${frame}`);

    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 3. ????????????????
        await m.triggerAtomicRecord(cmd, frame);
        
        // 4. ????? 400ms ???????? UI
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint();
          setWaypoints(prev => {
            const newWp = [...prev];
            // ??????????????????????????
            const targetIdx = newWp.findIndex(wp => wp.id === id);
            if (targetIdx !== -1) {
              //newWp[targetIdx] = { ...newWp[targetIdx], point: newCoords };
              //0330
              newWp[targetIdx] = { 
                ...newWp[targetIdx], 
                point: { ...newCoords, isManual: false },
                isManuallyEdited: false // ???????????
              };
            }
            return newWp;
          });
        }, 400);
      }
    });
  };

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
    waitingP2HardwareSignalRef.current = false
    waitingDirectionHardwareSignalRef.current = false
    waitingSingularityHardwareSignalRef.current = false
    if (hasSingularityWarning) {
      void resetMockRobotToHome()
      setHasSingularityWarning(false)
      setHasCollision(false)
      setShowCollisionToast(false)
      setShowWrongAnswerToast(false)
      setShowCollisionHintModal(false)
      setSelectedCollisionOption(null)
      setIsAutomaticReassemblyReady(true)
      return
    }

    setShowSuccessModal(false)
    setShowCollisionToast(false)
    setShowWrongAnswerToast(false)
    setShowCollisionHintModal(false)
    setSelectedCollisionOption(null)
    setIsRunningPreview(true)
    //startMockRun(ASSEMBLY_RUN_MS)
    // 0401 === ???????????????????????????????????????????????????????????? (????? O) ===
    const isObstacleRun = stage === 'second-block' && waypoints.length < 1;
    //startMockRun(ASSEMBLY_RUN_MS, isObstacleRun);
    // 0404=== ???????????????????????????????????????????????????????? ===
    // ????????????????????(2.5s) + ????(0.8s) + ????????(2.5s) + ??????(0.8s) ??? 6600ms -> ??????? 7000ms
    // ??????????????????? 2500ms
    const dynamicRunTimeMs = 7000 + (waypoints.length * 2500);
    
    startMockRun(dynamicRunTimeMs, isObstacleRun);

    if (runCompleteTimerRef.current !== null) {
      window.clearTimeout(runCompleteTimerRef.current)
    }
    if (collisionSignalTimerRef.current !== null) {
      window.clearTimeout(collisionSignalTimerRef.current)
    }

    const shouldTriggerWaypointCollision = stage === 'second-block' && waypoints.length < 1
    const isRealHardwarePath =
      hardware.source === 'hardware' && hardware.connection === 'connected'
    const shouldTriggerDirectionCollision = false
    const shouldTriggerSingularityCollision = false

    if (shouldTriggerWaypointCollision && isRealHardwarePath) {
      // P2 rule: in real hardware path, wait for the dedicated hardware signal.
      waitingP2HardwareSignalRef.current = true
      return
    }

    if (stage === 'second-block') {
      // Direction error is hardware-signal-driven in block 2.
      // In mock mode, signal can be injected via window.__ROBOT_DEBUG__.emitSignal(...)
      waitingDirectionHardwareSignalRef.current = true
    }

    if (stage === 'third-block' && !hasTriggeredSingularityCollision) {
      // Singularity is hardware-signal-driven in block 3.
      // In mock mode, signal can be injected via window.__ROBOT_DEBUG__.emitSignal(...)
      waitingSingularityHardwareSignalRef.current = true
    }

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
      waitingP2HardwareSignalRef.current = false
      waitingDirectionHardwareSignalRef.current = false
      waitingSingularityHardwareSignalRef.current = false
      setIsRunningPreview(false)
      setHasCollision(false)
      setShowSuccessModal(true)
    //}, ASSEMBLY_RUN_MS)
    }, dynamicRunTimeMs)
  }

  const handleNextBlock = () => {
    waitingP2HardwareSignalRef.current = false
    waitingDirectionHardwareSignalRef.current = false
    waitingSingularityHardwareSignalRef.current = false
    setShowSuccessModal(false)

    // 0331=== ????? 1???????????????????????????????????????????????????????????????????????? ===
    saveHardwarePath()

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
    setShowWrongAnswerToast(false)
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

    // 0401 === ????? 2????????????????????????????????????????????????????? ===
    clearAssemblyPoints()    // <--- ?????????????????????????????????????
    startAssemblyTeachMode()

  }

  const handleSuccessPrimaryAction = () => {
    setShowSuccessModal(false)
    if (stage === 'third-block' && isAutomaticReassemblyReady) {

      // 0331=== ???????????????????????????????????????????????????????????? ===
      saveHardwarePath()

      if (typeof onGoExecution === 'function') {
        onGoExecution()
      }
      return
    }
    // ???????? first ??? second block ?????????????????????????????
    handleNextBlock()
  }

  const handleTryAgainCurrentBlock = () => {
    waitingP2HardwareSignalRef.current = false
    waitingDirectionHardwareSignalRef.current = false
    waitingSingularityHardwareSignalRef.current = false
    setShowSuccessModal(false)
    setHasCollision(false)
    setShowCollisionToast(false)
    setShowWrongAnswerToast(false)
    setShowCollisionHintModal(false)
    setSelectedCollisionOption(null)
    // 0331=== ?????????????????????????????????????????????????????????????? ===
    startAssemblyTeachMode()
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
      showWrongAnswerToast={showWrongAnswerToast}
      showCollisionHintModal={showCollisionHintModal}
      selectedCollisionOption={selectedCollisionOption}
      collisionHintType={collisionHintType}
      collisionHintStep={collisionHintStep}
      showRelativeHintInfo={showRelativeHintInfo}
      showSuccessModal={showSuccessModal}
      successPrimaryLabel={
        stage === 'third-block' && isAutomaticReassemblyReady
          ? 'Automatic reassembly'
          : stage === 'third-block'
            ? 'Automatic run'
            : 'Next block'
      }
      successSubline={
        stage === 'third-block' && !isAutomaticReassemblyReady
          ? 'AUTOMATIC RUN READY!'
          : 'NEXT LEVEL UNLOCKED!'
      }
      jogFrame={jogFrame}
      hasSingularityWarning={hasSingularityWarning}
      connectionInfo={connectionInfo}
      onEnableTeach={() => {
        sendAssemblyTeachEnable()
      }}
      //onToggleMode={() => setMode((prev) => (prev === 'pick' ? 'drop' : 'pick'))}
      //0404
      onToggleMode={() => {
        setMode((prev) => {
          const nextMode = prev === 'pick' ? 'drop' : 'pick'
          
          // === ???????????????????????? Pick ????? Drop??????????????????? ===
          import('../../services/useHardwareStore.ts').then(m => {
            if (m.controlAssemblyMagnet) {
              // ??????? pick ????????????(true)????????? drop ????????????(false)
              m.controlAssemblyMagnet(nextMode === 'drop')
            }
          })
          
          return nextMode
        })
      }}
      onConfirmTest={handleConfirmTest}
      onNextBlock={handleNextBlock}
      onSuccessPrimaryAction={handleSuccessPrimaryAction}
      onTryAgainCurrentBlock={handleTryAgainCurrentBlock}
      onOpenCollisionHint={() => setShowCollisionHintModal(true)}
      onCloseCollisionHint={() => {
        setShowCollisionHintModal(false)
        setSelectedCollisionOption(null)
        if (collisionHintType === 'singularity') return
        setShowRelativeHintInfo(true)
      }}
      onSelectCollisionOption={setSelectedCollisionOption}
      // onConfirmCollisionHint={() => {
      //   if (collisionHintType === 'singularity') {
      //     if (selectedCollisionOption !== 'C') {
      //       setShowWrongAnswerToast(true)
      //       return
      //     }
      //     setShowCollisionHintModal(false)
      //     setSelectedCollisionOption(null)
      //     setHasCollision(false)
      //     setShowWrongAnswerToast(false)
      //     return
      //   }
      //   if (collisionHintType === 'direction' && collisionHintStep === 1) {
      //     if (selectedCollisionOption !== 'B') {
      //       setShowWrongAnswerToast(true)
      //       return
      //     }
      //     setCollisionHintStep(2)
      //     setSelectedCollisionOption(null)
      //     setShowWrongAnswerToast(false)
      //     return
      //   }
      //   if (collisionHintType === 'direction' && collisionHintStep === 2) {
      //     if (selectedCollisionOption !== 'A') {
      //       setShowWrongAnswerToast(true)
      //       return
      //     }
      //     setShowCollisionHintModal(false)
      //     setHasCollision(false)
      //     setSelectedCollisionOption(null)
      //     setShowRelativeHintInfo(true)
      //     setShowWrongAnswerToast(false)
      //     return
      //   }
      //   if (selectedCollisionOption !== 'B') {
      //     setShowWrongAnswerToast(true)
      //     return
      //   }
      //   setShowCollisionHintModal(false)
      //   setHasCollision(false)
      //   setSelectedCollisionOption(null)
      //   setShowRelativeHintInfo(true)
      //   setShowWrongAnswerToast(false)
      // }}

      //0404 ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
      onConfirmCollisionHint={() => {
        if (collisionHintType === 'singularity') {
          if (selectedCollisionOption !== 'C') {
            setShowWrongAnswerToast(true)
            return
          }
          setShowCollisionHintModal(false)
          setSelectedCollisionOption(null)
          setHasCollision(false)
          setShowWrongAnswerToast(false)
          // === ????? 1????????????????????????????????????? ===
          startAssemblyTeachMode() 
          return
        }
        if (collisionHintType === 'direction' && collisionHintStep === 1) {
          if (selectedCollisionOption !== 'B') {
            setShowWrongAnswerToast(true)
            return
          }
          setCollisionHintStep(2)
          setSelectedCollisionOption(null)
          setShowWrongAnswerToast(false)
          return
        }
        if (collisionHintType === 'direction' && collisionHintStep === 2) {
          if (selectedCollisionOption !== 'A') {
            setShowWrongAnswerToast(true)
            return
          }
          setShowCollisionHintModal(false)
          setHasCollision(false)
          setSelectedCollisionOption(null)
          setShowRelativeHintInfo(true)
          setShowWrongAnswerToast(false)
          // === ????? 2??????????????????????????????????????? ===
          startAssemblyTeachMode() 
          return
        }
        
        // ??????????????????????????????????????????????
        if (selectedCollisionOption !== 'B') {
          setShowWrongAnswerToast(true)
          return
        }
        setShowCollisionHintModal(false)
        setHasCollision(false)
        setSelectedCollisionOption(null)
        setShowRelativeHintInfo(true)
        setShowWrongAnswerToast(false)
        // === ????? 3??????????????????????????????????????????? ===
        startAssemblyTeachMode() 
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
      //onRecordGrab={() => handleRecordPoint(setGrab)}
      //oncordDrop={() => handleRecordPoint(setDrop)}
      //0324 ?? AssemblyModelPageView ?? props ???
      onRecordGrab={() => handleRecordPoint(setGrab, 'pick')}  // ???? 'pick'
      onRecordDrop={() => handleRecordPoint(setDrop, 'drop')}  // ???? 'drop'
      onRecordWaypoint={handleRecordWaypoint}
      showAddWaypoint={waypoints.length < MAX_WAYPOINTS}
    />
  )
}
