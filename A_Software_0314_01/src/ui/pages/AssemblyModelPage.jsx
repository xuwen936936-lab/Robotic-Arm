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
  // ÷ª“™ÔøΩÔøΩÔøΩƒ∏ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ÷µÔøΩÔøΩÔøΩÔøΩŒ™ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ
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
  } ¬∑ ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

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
      // === Ê?∞Â¢?Ôº?Á??Âê¨Á??ÂÆ?Á?©Áê?Ê?•ÂÅ?Ê??È?ÆÔº?Â∞?ÂÆ?Âè?Ê?êÊ??‰ª¨È??Ë¶ÅÁ??Ê??Â≠¶‰ø°Âè∑ ===
      if (signal === 'RAW_ESTOP_TRIGGERED') {
        if (stageRef.current === 'second-block') {
          if (waypointCountRef.current < 1) {
            // Ê≤°È??ÁªèÁ?πË¢´Ê?•ÂÅ? -> ËΩ¨Â??‰∏∫„?êÊ?™Ê∑ªÂ?†È??ÁªèÁ?π„??Ê?•È??‰ø°Âè?
            signal = HARDWARE_SIGNALS.ASSEMBLY_REACHED_SPECIFIED_POINT;
          } else {
            // Ê??È??ÁªèÁ?πË¢´Ê?•ÂÅ? -> ËΩ¨Â??‰∏∫„?êÊ?πÂê?È??ËØØ„??Ê?•È??‰ø°Âè?
            signal = HARDWARE_SIGNALS.ASSEMBLY_ESTOP_BEFORE_TARGET;
          }
        }
      }

      // //0404 Â§?Áê?Â•?Âº?Á?π‰ø°Âè∑Ôº?‰ª?È?êÁ¨¨‰∏?Â?≥Ôº?
      // if (
      //   waitingSingularityHardwareSignalRef.current &&
      //   signal === HARDWARE_SIGNALS.ASSEMBLY_SINGULARITY_REACHED &&
      //   stageRef.current === 'third-block' // <--- Â?≥È?ÆÔº?Á°Æ‰øùÂè™Â?®Á¨¨‰∏?Â?≥Ëß¶Âè? 
      // ) {
      //   waitingSingularityHardwareSignalRef.current = false;
      //   // Ê∏?Áê?Ê??Ê??ËøêË°?‰∏≠Á??ÂÆ?Ê?∂Â?®
      //   if (runCompleteTimerRef.current !== null) {
      //     window.clearTimeout(runCompleteTimerRef.current);
      //     runCompleteTimerRef.current = null;
      //   }
      //   setHasTriggeredSingularityCollision(true);
      //   setHasSingularityWarning(true);
      //   triggerCollision('singularity'); // ÂºπÂ?∫Â•?Âº?Á?πÊ?•È??ÂºπÁ™? [cite: 441]
      // }

      // 0404 Â§?Áê?Â•?Âº?Á?π‰ø°Âè∑Ôº?‰ª?È?êÁ¨¨‰∏?Â?≥Ôº?Â?®Â§©Â??Á??Âê¨ÔºÅÔº?
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
        triggerCollision('singularity'); // ÂºπÂ?∫Â•?Âº?Á?πÊ?•È??ÂºπÁ™?
        return; // Â§?Áê?ÂÆ?Á?¥Ê?•Ëø?Â??
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
  

  // //0324  ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ“≥ÔøΩÔøΩÔøΩÔøΩ“ªÔøΩ–µÔøΩÔøΩÔøΩÔøΩÔøΩ”≥…πÔøΩÔøΩÛ£¨µ»¥Ôø??1sÔøΩŸ∑ÔøΩÔøΩÔøΩ÷∏ÔøΩÔøΩU
  // useEffect(() => {
  //   if (hardware.connection === 'connected' && hardware.source === 'hardware') {
  //     console.log("Detected Real Robot connection. Initializing with delay...");
      
  //     // ÔøΩÔøΩÔøΩÔøΩ“ªÔøΩÔøΩÔøΩÔøΩ ±ÔøΩÔøΩ»∑ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ¬∑ÔøΩÔøΩ»´ÔøΩ»πÔøΩ
  //     const initTimer = setTimeout(() => {
  //       import('../../services/useHardwareStore.ts').then(m => {
  //         m.startAssemblyTeachMode();
  //       });
  //     }, 1000); // ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ 1 ÔøΩÔøΩ

  //     return () => clearTimeout(initTimer);
  //   }
  // }, [hardware.connection, hardware.source]);

  // 0328 È°µÈù¢Â?ùÂß?Â??Ôº?Âª∂Ëø? 2 Áß?Âê?Ëø?Â?•Á∫ØÂ??Á??Á§∫Ê??Ê®°Ôø?? (Ôø?? UÔº?‰∏çÔø?? K)
  // useEffect(() => {
    // Âè™Ê??Â?®Á??Ê≠£Ëø?Ê?•‰∏?Á?©Áê?ËÆæÂ§?Ê?∂Ê?çËß¶Âè?
  //   if (hardware.connection === 'connected' && hardware.source === 'hardware') {
  //     const timer = setTimeout(() => {
  //       console.log("[Assembly] 2s delayed: Entering teach mode (U)...");
  //       // Â?®Ê?ÅÂº?Â?•Âπ∂Ë∞?Á?®Â??Â?® store È??Ê?∞Â??Á?? enterTeachMode
  //       import('../../services/useHardwareStore.ts').then(m => {
  //         if (m.startAssemblyTeachMode) m.startAssemblyTeachMode();
  //       });
  //     }, 2000); 

  //     return () => clearTimeout(timer);
  //   }
  // }, [hardware.connection, hardware.source]);

  //0401 Ëø?‰∏?Ê≠•Âº∫Â??Ôº?Â?®Ëø?Â?•Á§∫Ê??Ê®°ÂºèÂ?çÔº?Â??Âè? C Â?Ω‰ª§ÂΩªÂ∫?Ê∏?Á©∫‰∏ªÊùøÈ??‰π?Â?çÁ??Á?π‰ΩçËÆ∞Âø?Ôº?Á°Æ‰øùÊØèÊ¨°Ëø?Â?•È?ΩÊ?ØÂπ≤Â??Á??Á?∂Ê??
  useEffect(() => {
    if (hardware.connection === 'connected' && hardware.source === 'hardware') {
      const timer = setTimeout(() => {
        console.log("[Assembly] 2s delayed: Entering teach mode (U)...");
        import('../../services/useHardwareStore.ts').then(m => {
          if (m.clearAssemblyPoints) m.clearAssemblyPoints(); // <--- Ê?∞Â¢?Ôº?Ê¥?Ê??‰∏?‰∏™È°µÈù¢Á??ËÆ∞Âø?
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
    }, 3000)
    return () => window.clearTimeout(toastTimerId)
  }, [showWrongAnswerToast])

  //0330 ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ”ºÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔø?
  // useEffect(() => {
  //   // ÔøΩÔøΩÔøΩÔøΩŒªÔøΩ«∑ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÕµÔøΩÔøΩ⁄≤ÔøΩÔøΩÔøΩÔøΩÔøΩ
  //   const checkAndSend = (point, type, frame) => {
  //     if (isPointFilled(point)) {
  //       hardware.sendManualPoint(type, point, frame);
  //     }
  //   };

  //   // ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ√ªÔøΩÕ£÷πÔøΩÔøΩÔøΩÔøΩ 500ms ÔøΩÔøΩÔøΩŸ∑ÔøΩÔøΩÔøΩ
  //   const timer = setTimeout(() => {
  //     // ÔøΩÔøΩÔø? Pick ÔøΩÔøΩ
  //     checkAndSend(grab, 'pick', grabFrame);
      
  //     // ÔøΩÔøΩÔø? Drop ÔøΩÔøΩ
  //     checkAndSend(drop, 'drop', dropFrame);
      
  //     // ÔøΩÔøΩÔø? Waypoints
  //     waypoints.forEach((wp, index) => {
  //       const type = index === 0 ? 'w1' : 'w2';
  //       checkAndSend(wp.point, type, wp.frame);
  //     });
  //   }, 500);

  //   return () => clearTimeout(timer); // ÔøΩÔøΩÔøΩÔøΩÔøΩ ±ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÿ∏ÔøΩÔøΩÔøΩÔøΩÔø?
  // }, [grab, drop, waypoints, grabFrame, dropFrame]); // ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ–©ÔøΩÔøΩÔøΩÔøΩÔøΩƒ±‰ªØ

  useEffect(() => {
  const checkAndSend = (point, type, frame, isManual = false) => {
    // ÷ªÔøΩ–µÔøΩÔøΩÔøΩŒªÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ»∑ÔøΩÔøΩÔøΩÔøΩÔøΩ÷∂ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩisManual Œ™ trueÔøΩÔøΩ ±ÔøΩ≈∑ÔøΩÔøΩÔøΩ
    if (isPointFilled(point) && isManual) {
      hardware.sendManualPoint(type, point, frame);
    }
  };

  const timer = setTimeout(() => {
    // 1. ÔøΩÔøΩÔø? Pick ÔøΩ„£∫ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ“™ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔø? handlePointChange ÔøΩÔøΩÔøΩÔøΩÔøΩ√±ÔøΩÔø?
    // ÔøΩÔøΩÔøΩﬂºÔøΩÔøΩ–∂œ£ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ«? grab ÔøΩÔøΩÔøΩ÷∂ÔøΩÔøΩÔøΩÔøΩÔøΩÔø?
    checkAndSend(grab, 'pick', grabFrame, grab.isManual);
    
    // 2. ÔøΩÔøΩÔø? Drop ÔøΩÔøΩ
    checkAndSend(drop, 'drop', dropFrame, drop.isManual);
    
    // 3. ÔøΩÔøΩÔø? WaypointsÔøΩÔøΩ÷±ÔøΩÔøΩ πÔøΩ√¥ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ–µÔøΩ isManuallyEdited ÔøΩÔøΩÔøΩÔøΩ
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
      isManual: true //0330 ÔøΩÿµ„£∫ÔøΩ√ªÔøΩÔøΩ÷∂ÔøΩÔøΩÔøΩÔøΩ÷£ÔøΩÔøΩÔøΩÔøΩŒ? true
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

  // //0324 ÔøΩﬁ∏ƒ∫ÔøΩ
  // const handleRecordPoint = (setter, type) => {
  //   // ? ÔøΩÔøΩÔøΩÔøΩÕ®ÔøΩÔøΩ hardware  µÔøΩÔøΩÔøΩÔøΩÔøΩ√£ÔøΩÔøΩÔøΩÔøΩÔøΩ»∑ÔøΩÔøΩÔøΩﬂµÔøΩÔøΩ«°ÔøΩÔøΩÔøΩ µÔøΩÔøΩÔøΩ”°ÔøΩÔøΩÔøΩÔøΩÔøΩ¬∑
  //   if (hardware.recordPointWithSignal) {
  //     const point = hardware.recordPointWithSignal(type);
  //     setter(point);
  //   } else {
  //     console.error("recordPointWithSignal is not exported from hardware store!");
  //   }
  // }

  // AssemblyModelPage.jsx

// const handleRecordPoint = (setter, type) => {

//   // ÔøΩÔøΩÔøΩÔøΩ store ÔøΩ–µÔøΩÔøΩÏ≤ΩÔøΩÔøΩÔøΩÔøΩ
//   // setter ÔøΩÔøΩÔøΩÔøΩÔøΩ’µÔøΩ”≤ÔøΩÔøΩÔøΩÿ¥ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ÷¥ÔøΩÔø??
//   hardware.recordPointWithSignal(type, (newCoords) => {
//     setter(newCoords); // ÔøΩÔøΩÔøΩÔøΩÔøΩ÷¥ÔøΩÔø?? setGrab(newCoords) ÔøΩÔøΩ setDrop(newCoords)
//     // console.log(`[UI] ${type} point updated:`, newCoords);
//   });

//   // // 2. ÔøΩÔøΩÔøΩÔøΩ“ªÔøΩÔøΩÔøΩÔøΩ ±ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ◊®ÔøΩ≈µ»¥ÔøΩÔøΩÔøΩ“ªÔøΩŒµÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔø??
//   // const unsubscribe = subscribeHardwareSignal((payload) => {
//   //   // ÔøΩÔøΩÔøΩÔøΩ«∑ÔøΩÔøΩ’µÔøΩÔøΩÔøΩÔøΩ¬µÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ
//   //   if (typeof payload === 'object' && payload.x) {
//   //     setter(payload); // ÔøΩÔøΩ”≤ÔøΩÔøΩÔøΩÿ¥ÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ”¶ÔøΩÔø?? Pick/Drop ÔøΩÔøΩ∆¨
//   //     unsubscribe();   // ÔøΩ…πÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩŸºÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩ÷πÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔøΩÔø??
//   //   }
//   // });
// };
// 0328 Â§?Áê? Pick Point (Ëµ∑Á?π) Ôø?? Drop Point (Áª?Á?π) Ôø?? RECORD Ê??È?Æ
  const handleRecordPoint = async (setter, type) => {
    // Â?§Ê?≠ÂΩ?Â?çÁ?πÂ?ªÁ??Ê?ØËµ∑Á?πËø?Ê?ØÁª?Á?πÔº?Âπ∂Ë?∑Âè?ÂØπÂ∫?Á??‰∏?Ê??Ê°?Âè?Ë??Á≥ª
    const frame = type === 'pick' ? grabFrame : dropFrame;
    // Ëµ∑Á?πÂØπÂ∫? 'A' (Â?®Â≠?Â?∏‰∏≠Ôø?? RECORD_START)Ôº?Áª?Á?πÂØπÔø?? 'B' (RECORD_END)
    const cmd = type === 'pick' ? 'RECORD_START' : 'RECORD_END'; 
    
    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 1. Ëß¶Âè?Â??Â≠êÂ??Ê?ç‰Ω?Ôº?Âè?Ê??Ôø?? -> Ôø??1Ôø?? -> Ôø?? P/TPÔø??
        await m.triggerAtomicRecord(cmd, frame);
        
        // 2. Á≠?Âæ?‰∏≤Âè£Â??‰º†ÂùêÊ†?Âπ∂Ë¢´Â?çÁ´ØÁ?∂Ê?ÅÂ∫?Ëß£Ê?ê (400ms Á??Á?∂Ê?ÅÊ?¥Ê?∞Áº?Â?≤Ë∂≥Â§?‰∫?)
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint(); // ‰ª?Á?∂Ê?ÅÊ?∫È??Ê??Âè?Ê??Ê?∞ÂùêÔø??
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
// 0328 Â§?Áê? WayPoint (Ëø?Ê∏°Ôø??) Ôø?? RECORD Ê??È?Æ
  const handleRecordWaypoint = async (id) => {
    // 1. „?êÂ?≥È?Æ‰øÆÂ§ç„??È??Ëø? id Ê?æÂ?∞ÂÆ?Â?®Ê?∞Áª?‰∏≠Á??ÂÆ?È??‰ΩçÁΩÆ(index)
    const index = waypoints.findIndex(wp => wp.id === id);
    if (index === -1) {
        console.error("[UI] Waypoint ID not found:", id);
        return;
    }

    // 2. Ê≠£Â∏∏Ë?∑Âè?Âè?Ë??Á≥ªÂ??Ê??Ôø??
    const frame = waypoints[index].frame || 'Base'; 
    const cmd = index === 0 ? 'RECORD_W1' : 'RECORD_W2'; // ÂØπÂ∫? Bridge È??Á?? W Ôø?? X
    
    console.log(`[UI] Recording Waypoint ${index + 1} (ID:${id}) -> CMD: ${cmd}, Frame: ${frame}`);

    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 3. Ëß¶Âè?Â??Â≠êÂ??Ê?çÔø??
        await m.triggerAtomicRecord(cmd, frame);
        
        // 4. Áº?Â?≤ 400ms Âê?Ê?¥Ôø?? UI
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint();
          setWaypoints(prev => {
            const newWp = [...prev];
            // Ê?æÂ?∞ÂØπÂ∫?Á??Â??Á¥†Âπ∂Ê?¥Ê?∞ÂùêÊ†?
            const targetIdx = newWp.findIndex(wp => wp.id === id);
            if (targetIdx !== -1) {
              //newWp[targetIdx] = { ...newWp[targetIdx], point: newCoords };
              //0330
              newWp[targetIdx] = { 
                ...newWp[targetIdx], 
                point: { ...newCoords, isManual: false },
                isManuallyEdited: false // ÔøΩÔøΩÔøΩÔøΩÔøΩ‘∂ÔøΩÔøΩÔøΩÔøΩÔøΩ
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
    // 0401 === ‰øÆÊ?πËø?È??Ôº?Â¶?Ê??Ê?ØÂ?®Á¨¨‰∫?Â?≥‰∏?Ê≤°Â??È??ÁªèÁ?πÔº?Â∞±Âº?ÂêØÁ¢∞Ê??È??Á¢çÁ?©Ê®°Âºè (Âè?È?? O) ===
    const isObstacleRun = stage === 'second-block' && waypoints.length < 1;
    //startMockRun(ASSEMBLY_RUN_MS, isObstacleRun);
    // 0404=== Ê†∏Âø?‰øÆÂ§çÔº?Ê†πÊçÆÈ??Âæ?Á?πÊ?∞È?èÂ?®Ê?ÅËÆ°ÁÆ?Ê?∫Ê¢∞Ë??Á??Á??ÂÆ?ËøêË°?Ê?∂È?? ===
    // Â?∫Á°?Ê?∂È?¥Ôº?Â?ªËµ∑Á?π(2.5s) + Âê∏È??(0.8s) + Â?ªÁª?Á??(2.5s) + È??Ê?æ(0.8s) ‚?? 6600ms -> Âè?Ê?¥‰∏? 7000ms
    // ÊØè‰∏™È??Âæ?Á?πÈ¢ùÂ§?Ë??Ê?∂ 2500ms
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

    // 0331=== Ê?∞Â¢? 1Ôº?Â?®Ëø?Â?•‰∏?‰∏?È?∂ÊÆµÂ?çÔº?È??Á?•‰∏ªÊùøÊ??Â??Ê?çË∑?È??Á??Ëø?Áª?Á?π‰Ωç‰øùÂ≠?Â?∞Á°¨‰ª∂Â??Â≠?È?? ===
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

    // 0401 === Ê?∞Â¢? 2Ôº?Ê?∞ÊçÆÊ∏?Á©∫ÂÆ?ÊØ?Âê?Ôº?ËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â??Ôº?Â??Â§?‰∏?‰∏?Â?≥Á§∫Ê?? ===
    clearAssemblyPoints()    // <--- Ê?∞Â¢?Ôº?È??Á?•Á°¨‰ª∂Ê??‰∏?‰∏?Â?≥Á??Á?π‰ΩçÂø?Ê??
    startAssemblyTeachMode()

  }

  const handleSuccessPrimaryAction = () => {
    setShowSuccessModal(false)
    if (stage === 'third-block' && isAutomaticReassemblyReady) {

      // 0331=== Áª?Ê?ÅË°•Â??Ôº?Â?ªÊ??Áª?Ê?ßË°?Â?çÔº?Âø?È°ªÊ??Á¨¨‰∏?‰∏™È?∂ÊÆµÁ??Ë∑ØÂæ?‰π?‰øùÂ≠?Ëø?‰∏ªÊùøÔº? ===
      saveHardwarePath()

      if (typeof onGoExecution === 'function') {
        onGoExecution()
      }
      return
    }
    // Â¶?Ê??Ê?? first Ê?? second block È??Â?≥Ôº?Ëµ∞Ëø?‰∏™Ê≠£Â∏∏Á??‰∏?‰∏?Â?≥È?ªËæ?
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
    // 0331=== Ê?∞Â¢?Ôº?ËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â??Ôº?Â?ÅËÆ∏Á?®Ê?∑Â?∫‰∫?Á?∞Ê??ÂùêÊ†?ÁªßÁª≠ÂæÆË∞?Ê??Ê?Ω ===
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
          : 'Next block'
      }
      jogFrame={jogFrame}
      hasSingularityWarning={hasSingularityWarning}
      connectionInfo={connectionInfo}
      //onToggleMode={() => setMode((prev) => (prev === 'pick' ? 'drop' : 'pick'))}
      //0404
      onToggleMode={() => {
        setMode((prev) => {
          const nextMode = prev === 'pick' ? 'drop' : 'pick'
          
          // === Ê?∞Â¢?Ôº?Ê†πÊçÆÂΩ?Â?çÈ??‰∏≠Á??Ê?Ø Pick Ëø?Ê?Ø DropÔº?ÂÆ?Ê?∂Âº?Â?≥Á?µÁ£ÅÈ?Å ===
          import('../../services/useHardwareStore.ts').then(m => {
            if (m.controlAssemblyMagnet) {
              // Â??Êç¢Â?? pick Ê?∂‰∏?Á?µÂê∏È??(true)Ôº?Â??Êç¢Â?∞ drop Ê?∂Ê?≠Á?µÊùæÂº?(false)
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

      //0404 Ëø?‰∏?Ê≠•‰º?Â??Ôº?Â?®‰∏?‰∏™ÂºπÁ™?È??Á≠?ÂØπÂê?È?ΩËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â??Ôº?Â?ÅËÆ∏Á?®Ê?∑Â?∫‰∫?Á?∞Ê??ÂùêÊ†?ÁªßÁª≠ÂæÆË∞?Ê??Ê?ΩÔº?Ë??‰∏çÊ?ØË¢´Ëø´Â?∑Ê?∞È°µÈù¢Â??Â?∞Â?ùÂß?Á?∂Ê??
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
          // === Ê?∞Â¢? 1Ôº?Â•?Âº?Á?πÂºπÁ™?Á≠?ÂØπÂê?Ôº?ËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â?? ===
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
          // === Ê?∞Â¢? 2Ôº?Ê?πÂê?È??ËØØÂºπÁ™?Á≠?ÂØπÂê?Ôº?ËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â?? ===
          startAssemblyTeachMode() 
          return
        }
        
        // ‰ª•‰∏?Ê?ØÈª?ËÆ§Á??‚??Ê?™Ê∑ªÂ?†È??ÁªèÁ?π‚?ùÁ??Â?§Ê?≠È?ªËæ?
        if (selectedCollisionOption !== 'B') {
          setShowWrongAnswerToast(true)
          return
        }
        setShowCollisionHintModal(false)
        setHasCollision(false)
        setSelectedCollisionOption(null)
        setShowRelativeHintInfo(true)
        setShowWrongAnswerToast(false)
        // === Ê?∞Â¢? 3Ôº?Ê?™Â?†È??ÁªèÁ?πÂºπÁ™?Á≠?ÂØπÂê?Ôº?ËÆ©Ê?∫Ê¢∞Ë??È?çÊ?∞Âç∏Â?? ===
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
      //0324 ÔøΩÔøΩ AssemblyModelPageView ÔøΩÔøΩ props ◊¢ÔøΩÎ¥¶
      onRecordGrab={() => handleRecordPoint(setGrab, 'pick')}  // ÔøΩÔøΩÔøΩÔøΩ 'pick'
      onRecordDrop={() => handleRecordPoint(setDrop, 'drop')}  // ÔøΩÔøΩÔøΩÔøΩ 'drop'
      onRecordWaypoint={handleRecordWaypoint}
      showAddWaypoint={waypoints.length < MAX_WAYPOINTS}
    />
  )
}
