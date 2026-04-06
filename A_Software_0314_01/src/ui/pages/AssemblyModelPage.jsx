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
  stopMockRun,        //0405 <--- ∫À–ƒ–¬‘ˆ£∫“˝»Î÷’÷π∫Ø ˝
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
  const waitingRunCompleteHardwareSignalRef = useRef(false) //0405 <--- –¬‘ˆ’‚––
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

      //0405 === ∫À–ƒ–ﬁ∏¥£∫’“ªÿŒÔ¿Ìº±Õ£µƒ¿πΩÿ¬ﬂº≠ ===
      // ÷ª”–‘⁄µ⁄∂˛πÿ (second-block) «“ÃÌº”¡À÷¡…Ÿ1∏ˆπ˝∂…µ„ (waypointCount >= 1)  ±£¨
      // ”√ªß∞¥œ¬µƒŒÔ¿Ìº±Õ££¨≤≈ª·±ª≈–∂®Œ™°∞∑ΩœÚ/◊¯±Íœµ¥ÌŒÛ°±µº÷¬µƒ¿πΩÿ°£
      if (
        signal === 'RAW_ESTOP_TRIGGERED' && 
        stageRef.current === 'second-block' && 
        waypointCountRef.current >= 1
      ) {
        signal = HARDWARE_SIGNALS.ASSEMBLY_ESTOP_BEFORE_TARGET;
      }

      //0405
      if (
        waitingP2HardwareSignalRef.current &&
        signal === HARDWARE_SIGNALS.ASSEMBLY_REACHED_SPECIFIED_POINT &&
        stageRef.current === 'second-block' &&
        waypointCountRef.current < 1
      ) {
        // ... «Â¿Ì∂® ±∆˜≤¢¥•∑¢µØ¥∞
        triggerCollision('waypoint'); 
        return;
      }

      // //0404 Â§?Áê?Â•?Âº???π‰ø°Âè∑Ô??‰ª???êÁ¨¨‰∏???≥Ô??
      // if (
      //   waitingSingularityHardwareSignalRef.current &&
      //   signal === HARDWARE_SIGNALS.ASSEMBLY_SINGULARITY_REACHED &&
      //   stageRef.current === 'third-block' // <--- ??≥È?ÆÔ??Á°Æ‰øùÂè™Â?®Á¨¨‰∏???≥Ëß¶Âè? 
      // ) {
      //   waitingSingularityHardwareSignalRef.current = false;
      //   // Ê∏?Áê???????ËøêË??‰∏≠Á??ÂÆ???∂Â??
      //   if (runCompleteTimerRef.current !== null) {
      //     window.clearTimeout(runCompleteTimerRef.current);
      //     runCompleteTimerRef.current = null;
      //   }
      //   setHasTriggeredSingularityCollision(true);
      //   setHasSingularityWarning(true);
      //   triggerCollision('singularity'); // ÂºπÂ?∫Â??Âº???πÊ?•È??ÂºπÁ?? [cite: 441]
      // }

      // 0404 Â§?Áê?Â•?Âº???π‰ø°Âè∑Ô??‰ª???êÁ¨¨‰∏???≥Ô????®Â§©??????Âê¨ÔºÅÔº?
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
        triggerCollision('singularity'); // ÂºπÂ?∫Â??Âº???πÊ?•È??ÂºπÁ??
        return; // Â§?Áê?ÂÆ???¥Ê?•Ë?????
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

      //0405 === ∫À–ƒ–¬‘ˆ£∫º‡Ã˝’˝≥£◊∞≈‰ÕÍ≥…–≈∫≈ ===
      if (
        waitingRunCompleteHardwareSignalRef.current &&
        signal === HARDWARE_SIGNALS.ASSEMBLY_RUN_FINISHED
      ) {
        waitingRunCompleteHardwareSignalRef.current = false;
        if (runCompleteTimerRef.current !== null) {
          window.clearTimeout(runCompleteTimerRef.current);
          runCompleteTimerRef.current = null;
        }
        stopMockRun(); //0405 <--- ∫À–ƒ–¬‘ˆ£∫ ’µΩπ˝πÿ–≈∫≈∫Û£¨≥πµ◊Ω‚≥˝ 60√Î À¯∂®
        setIsRunningPreview(false);
        setHasCollision(false);
        setShowSuccessModal(true);
        return;
      }
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

  //0401 Ëø?‰∏?Ê≠•Âº∫???Ôº???®Ë????•Á§∫???Ê®°Âºè??çÔ?????Âè? C ??Ω‰ª§ÂΩªÂ??Ê∏?Á©∫‰∏ªÊùøÈ??‰π???çÁ????π‰ΩçËÆ∞Â??Ôº?Á°Æ‰øùÊØèÊ¨°Ëø???•È?ΩÊ?ØÂπ≤????????∂Ê??
  // useEffect(() => {
  //   if (hardware.connection === 'connected' && hardware.source === 'hardware') {
  //     const timer = setTimeout(() => {
  //       console.log("[Assembly] 2s delayed: Entering teach mode (U)...");
  //       import('../../services/useHardwareStore.ts').then(m => {
  //         if (m.clearAssemblyPoints) m.clearAssemblyPoints(); // <--- ??∞Â??Ôº?Ê¥????‰∏?‰∏™È°µÈù¢Á??ËÆ∞Â??
  //         if (m.startAssemblyTeachMode) m.startAssemblyTeachMode();
  //       });
  //     }, 2000); 
  //     return () => clearTimeout(timer);
  //   }
  // }, [hardware.connection, hardware.source]);

  //0405
  useEffect(() => {
    if (hardware.connection === 'connected' && hardware.source === 'hardware') {
      const timer = setTimeout(() => {
        console.log("[Assembly] 2s delayed: Init R, C, U...");
        import('../../services/useHardwareStore.ts').then(m => {
          if (m.clearHardwareLibrary) m.clearHardwareLibrary(); // <--- –¬‘ˆ£∫∑¢ÀÕ R£¨«Âø’ 3 ∏ˆº«“‰≤€
          if (m.clearAssemblyPoints) m.clearAssemblyPoints();   // ∑¢ÀÕ C£¨«Âø’µ±«∞≤›∏Âµ„
          if (m.startAssemblyTeachMode) m.startAssemblyTeachMode(); // ∑¢ÀÕ U£¨–∂¡¶Ω¯»Î æΩÃ
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
    stopMockRun()     //0405 <--- ∫À–ƒ–¬‘ˆ£∫µØ≥ˆ¥ÌŒÛÃ· æ«∞£¨≥πµ◊Ω‚≥˝ 60√Î À¯∂®
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
// 0328 Â§?Áê? Pick Point (Ëµ∑Á??) Ôø?? Drop Point (Áª????) Ôø?? RECORD ??????
  const handleRecordPoint = async (setter, type) => {
    // ??§Ê?≠Â????çÁ?πÂ?ªÁ????ØËµ∑??πË????ØÁ????πÔ??Âπ∂Ë?∑Â??ÂØπÂ?????‰∏????Ê°?Âè????Á≥?
    const frame = type === 'pick' ? grabFrame : dropFrame;
    // Ëµ∑Á?πÂØπÂ∫? 'A' (??®Â????∏‰∏≠Ôø?? RECORD_START)Ôº?Áª???πÂØπÔø?? 'B' (RECORD_END)
    const cmd = type === 'pick' ? 'RECORD_START' : 'RECORD_END'; 
    
    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 1. Ëß¶Â?????Â≠êÂ????ç‰??Ôº?Âè????Ôø?? -> Ôø??1Ôø?? -> Ôø?? P/TPÔø??
        await m.triggerAtomicRecord(cmd, frame);
        
        // 2. Á≠?Âæ?‰∏≤Âè£???‰º†ÂùêÊ†?Âπ∂Ë¢´??çÁ´Ø??∂Ê?ÅÂ??Ëß£Ê?? (400ms ?????∂Ê?ÅÊ?¥Ê?∞Á????≤Ë∂≥Â§?‰∫?)
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint(); // ‰ª???∂Ê?ÅÊ?∫È?????Âè??????∞ÂùêÔø??
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
// 0328 Â§?Áê? WayPoint (Ëø?Ê∏°Ô???) Ôø?? RECORD ??????
  const handleRecordWaypoint = async (id) => {
    // 1. ??êÂ?≥È?Æ‰øÆÂ§ç„?????Ëø? id ??æÂ?∞Â????®Ê?∞Á??‰∏≠Á??ÂÆ????‰ΩçÁΩÆ(index)
    const index = waypoints.findIndex(wp => wp.id === id);
    if (index === -1) {
        console.error("[UI] Waypoint ID not found:", id);
        return;
    }

    // 2. Ê≠£Â∏∏??∑Â??Âè????Á≥ªÂ?????Ôø??
    const frame = waypoints[index].frame || 'Base'; 
    const cmd = index === 0 ? 'RECORD_W1' : 'RECORD_W2'; // ÂØπÂ?? Bridge ?????? W Ôø?? X
    
    console.log(`[UI] Recording Waypoint ${index + 1} (ID:${id}) -> CMD: ${cmd}, Frame: ${frame}`);

    import('../../services/useHardwareStore.ts').then(async (m) => {
      if (m.triggerAtomicRecord) {
        // 3. Ëß¶Â?????Â≠êÂ????çÔ???
        await m.triggerAtomicRecord(cmd, frame);
        
        // 4. Áº???? 400ms Âê???¥Ô??? UI
        setTimeout(() => {
          const newCoords = m.captureCurrentPoint();
          setWaypoints(prev => {
            const newWp = [...prev];
            // ??æÂ?∞ÂØπÂ∫???????Á¥†Âπ∂??¥Ê?∞ÂùêÊ†?
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

  // const handleConfirmTest = () => {
  //   if (isRunningPreview || hardware.isRunning) return
  //   if (!canConfirmNow) return
  //   waitingP2HardwareSignalRef.current = false
  //   waitingDirectionHardwareSignalRef.current = false
  //   waitingSingularityHardwareSignalRef.current = false
  //   if (hasSingularityWarning) {
  //     void resetMockRobotToHome()
  //     setHasSingularityWarning(false)
  //     setHasCollision(false)
  //     setShowCollisionToast(false)
  //     setShowWrongAnswerToast(false)
  //     setShowCollisionHintModal(false)
  //     setSelectedCollisionOption(null)
  //     setIsAutomaticReassemblyReady(true)
  //     return
  //   }

  //   setShowSuccessModal(false)
  //   setShowCollisionToast(false)
  //   setShowWrongAnswerToast(false)
  //   setShowCollisionHintModal(false)
  //   setSelectedCollisionOption(null)
  //   setIsRunningPreview(true)
  //   //startMockRun(ASSEMBLY_RUN_MS)
  //   // 0401 === ‰øÆÊ?πË?????Ôº?Â¶??????ØÂ?®Á¨¨‰∫???≥‰??Ê≤°Â?????ÁªèÁ?πÔ??Â∞±Â??ÂêØÁ¢∞??????Á¢çÁ?©Ê®°Âº? (Âè???? O) ===
  //   const isObstacleRun = stage === 'second-block' && waypoints.length < 1;
  //   //startMockRun(ASSEMBLY_RUN_MS, isObstacleRun);
  //   // 0404=== Ê†∏Â??‰øÆÂ§çÔº?Ê†πÊçÆ???Âæ???πÊ?∞È?èÂ?®Ê?ÅËÆ°ÁÆ???∫Ê¢∞?????????ÂÆ?ËøêË????∂È?? ===
  //   // ??∫Á????∂È?¥Ô????ªËµ∑???(2.5s) + Âê∏È??(0.8s) + ??ªÁ?????(2.5s) + ??????(0.8s) ??? 6600ms -> Âè???¥‰?? 7000ms
  //   // ÊØè‰∏™???Âæ???πÈ¢ùÂ§??????? 2500ms
  //   const dynamicRunTimeMs = 7000 + (waypoints.length * 2500);
    
  //   startMockRun(dynamicRunTimeMs, isObstacleRun);

  //   if (runCompleteTimerRef.current !== null) {
  //     window.clearTimeout(runCompleteTimerRef.current)
  //   }
  //   if (collisionSignalTimerRef.current !== null) {
  //     window.clearTimeout(collisionSignalTimerRef.current)
  //   }

  //   const shouldTriggerWaypointCollision = stage === 'second-block' && waypoints.length < 1
  //   const isRealHardwarePath =
  //     hardware.source === 'hardware' && hardware.connection === 'connected'
  //   const shouldTriggerDirectionCollision = false
  //   const shouldTriggerSingularityCollision = false

  //   if (shouldTriggerWaypointCollision && isRealHardwarePath) {
  //     // P2 rule: in real hardware path, wait for the dedicated hardware signal.
  //     waitingP2HardwareSignalRef.current = true
  //     return
  //   }

  //   if (stage === 'second-block') {
  //     // Direction error is hardware-signal-driven in block 2.
  //     // In mock mode, signal can be injected via window.__ROBOT_DEBUG__.emitSignal(...)
  //     waitingDirectionHardwareSignalRef.current = true
  //   }

  //   if (stage === 'third-block' && !hasTriggeredSingularityCollision) {
  //     // Singularity is hardware-signal-driven in block 3.
  //     // In mock mode, signal can be injected via window.__ROBOT_DEBUG__.emitSignal(...)
  //     waitingSingularityHardwareSignalRef.current = true
  //   }

  //   if (
  //     shouldTriggerWaypointCollision ||
  //     shouldTriggerDirectionCollision ||
  //     shouldTriggerSingularityCollision
  //   ) {
  //     collisionSignalTimerRef.current = window.setTimeout(() => {
  //       collisionSignalTimerRef.current = null
  //       if (shouldTriggerSingularityCollision) {
  //         setHasTriggeredSingularityCollision(true)
  //         setHasSingularityWarning(true)
  //         triggerCollision('singularity')
  //         return
  //       }
  //       if (shouldTriggerDirectionCollision) {
  //         setHasTriggeredDirectionCollision(true)
  //         triggerCollision('direction')
  //         return
  //       }
  //       triggerCollision('waypoint')
  //     }, shouldTriggerSingularityCollision ? SINGULARITY_SIGNAL_MS : COLLISION_SIGNAL_MS)
  //     return
  //   }

  //   runCompleteTimerRef.current = window.setTimeout(() => {
  //     runCompleteTimerRef.current = null
  //     waitingP2HardwareSignalRef.current = false
  //     waitingDirectionHardwareSignalRef.current = false
  //     waitingSingularityHardwareSignalRef.current = false
  //     setIsRunningPreview(false)
  //     setHasCollision(false)
  //     setShowSuccessModal(true)
  //   //}, ASSEMBLY_RUN_MS)
  //   }, dynamicRunTimeMs)
  // }

  //0405
  const handleConfirmTest = () => {
    if (isRunningPreview || hardware.isRunning) return
    if (!canConfirmNow) return
    
    // 1. ÷ÿ÷√À˘”–µ»¥˝–≈∫≈µƒ±Í÷æŒª
    waitingP2HardwareSignalRef.current = false
    waitingDirectionHardwareSignalRef.current = false
    waitingSingularityHardwareSignalRef.current = false
    waitingRunCompleteHardwareSignalRef.current = false // <--- –¬‘ˆ£∫÷ÿ÷√ÕÍ≥…–≈∫≈
    
    // »Áπ˚”–∆Ê“Ïµ„æØ∏Ê£¨µ„ª˜æÕ « Reset
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

    // 2. «Â¿Ì÷Æ«∞µƒµØ¥∞∫Õ◊¥Ã¨£¨◊º±∏ø™ º‘À––
    setShowSuccessModal(false)
    setShowCollisionToast(false)
    setShowWrongAnswerToast(false)
    setShowCollisionHintModal(false)
    setSelectedCollisionOption(null)
    setIsRunningPreview(true)
    
    // 3. º∆À„‘À–– ±º‰∫Õ≈–∂œ◊¥Ã¨
    const isObstacleRun = stage === 'second-block' && waypoints.length < 1;
    const dynamicRunTimeMs = 7000 + (waypoints.length * 2500);
    const isRealHardwarePath = hardware.source === 'hardware' && hardware.connection === 'connected';
    
    // === ∫À–ƒ–ﬁ∏ƒ 1£∫À´πÏ÷∆øÿ÷∆«∞∂À Loading ∂Øª≠ ±º‰ ===
    // »Áπ˚¡¨◊≈’Êª˙£¨∂Øª≠µπº∆ ±…ËŒ™ 60 √Î∑¿ø®À¿£ª√ª¡¨’Êª˙£¨∞¥º∆À„≥ˆ¿¥µƒºŸ ±º‰≈‹
    startMockRun(isRealHardwarePath ? 60000 : dynamicRunTimeMs, isObstacleRun);

    if (runCompleteTimerRef.current !== null) {
      window.clearTimeout(runCompleteTimerRef.current)
    }
    if (collisionSignalTimerRef.current !== null) {
      window.clearTimeout(collisionSignalTimerRef.current)
    }

    // 4. ≈ˆ◊≤–≈∫≈‘§æØ≈–∂®¬ﬂº≠£®±£≥÷‘≠—˘£©
    const shouldTriggerWaypointCollision = stage === 'second-block' && waypoints.length < 1
    const shouldTriggerDirectionCollision = false
    const shouldTriggerSingularityCollision = false

    if (shouldTriggerWaypointCollision && isRealHardwarePath) {
      waitingP2HardwareSignalRef.current = true
      return
    }

    if (stage === 'second-block') {
      waitingDirectionHardwareSignalRef.current = true
    }

    if (stage === 'third-block' && !hasTriggeredSingularityCollision) {
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

    // === ∫À–ƒ–ﬁ∏ƒ 2£∫≥πµ◊∏ƒŒ™À´πÏ÷∆µ»¥˝ ===
    if (isRealHardwarePath) {
      // ’Êª˙ƒ£ Ω£∫ø™∆Ù±Í÷æŒª£¨À¿µ»µ◊≤„¥Æø⁄∑¢–≈∫≈£¨∑¿∂œ¡™±£µ◊…ËŒ™ 60 √Î
      waitingRunCompleteHardwareSignalRef.current = true;
      runCompleteTimerRef.current = window.setTimeout(() => {
        runCompleteTimerRef.current = null;
        waitingRunCompleteHardwareSignalRef.current = false;
        stopMockRun(); //0405 <--- ∫À–ƒ–¬‘ˆ
        setIsRunningPreview(false);
        setHasCollision(false);
        setShowSuccessModal(true); // ±£µ◊≥¨ ±“≤ª·µØ¥∞£¨∑¿÷πÀ¿µ»
      }, 60000); 
    } else {
      // –Èƒ‚ª∑æ≥ƒ£ Ω£®Õ¯“≥µ•∂¿≤‚ ‘ ±£©£∫Œ¨≥÷‘≠±æµƒºŸ∂Øª≠µπº∆ ±
      runCompleteTimerRef.current = window.setTimeout(() => {
        runCompleteTimerRef.current = null;
        waitingP2HardwareSignalRef.current = false;
        waitingDirectionHardwareSignalRef.current = false;
        waitingSingularityHardwareSignalRef.current = false;
        stopMockRun(); //0405 <--- ∫À–ƒ–¬‘ˆ
        setIsRunningPreview(false);
        setHasCollision(false);
        setShowSuccessModal(true);
      }, dynamicRunTimeMs);
    }
  }

  const handleNextBlock = () => {
    waitingP2HardwareSignalRef.current = false
    waitingDirectionHardwareSignalRef.current = false
    waitingSingularityHardwareSignalRef.current = false
    setShowSuccessModal(false)

    // 0331=== ??∞Â?? 1Ôº???®Ë????•‰??‰∏???∂ÊÆµ??çÔ???????•‰∏ªÊùøÊ???????çË????????Ëø?Áª???π‰Ωç‰øùÂ????∞Á°¨‰ª∂Â??Â≠???? ===
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

    // 0401 === ??∞Â?? 2Ôº???∞ÊçÆÊ∏?Á©∫Â??ÊØ?Âê?Ôº?ËÆ©Ê?∫Ê¢∞?????çÊ?∞Âç∏???Ôº????Â§?‰∏?‰∏???≥Á§∫??? ===
    clearAssemblyPoints()    // <--- ??∞Â??Ôº??????•Á°¨‰ª∂Ê??‰∏?‰∏???≥Á????π‰ΩçÂø????
    startAssemblyTeachMode()

  }

  const handleSuccessPrimaryAction = () => {
    setShowSuccessModal(false)
    if (stage === 'third-block') {

      // 0331=== Áª???ÅË°•???Ôº???ªÊ??Áª???ßË????çÔ??Âø?È°ªÊ??Á¨¨‰??‰∏™È?∂ÊÆµ???Ë∑ØÂ??‰π?‰øùÂ??Ëø?‰∏ªÊùøÔº? ===
      saveHardwarePath()

      if (typeof onGoExecution === 'function') {
        onGoExecution()
      }
      return
    }
    // Â¶??????? first ??? second block ?????≥Ô??Ëµ∞Ë??‰∏™Ê≠£Â∏∏Á??‰∏?‰∏???≥È?ªË??
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
    // 0331=== ??∞Â??Ôº?ËÆ©Ê?∫Ê¢∞?????çÊ?∞Âç∏???Ôº???ÅËÆ∏??®Ê?∑Â?∫‰????∞Ê??ÂùêÊ??ÁªßÁª≠ÂæÆË???????? ===
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
        stage === 'third-block'
          ? 'Automatic reassembly'
          : 'Next block'
      }
      jogFrame={jogFrame}
      hasSingularityWarning={hasSingularityWarning}
      connectionInfo={connectionInfo}

      onEnableTeach={startAssemblyTeachMode}  //0405

      //onToggleMode={() => setMode((prev) => (prev === 'pick' ? 'drop' : 'pick'))}
      //0404
      onToggleMode={() => {
        setMode((prev) => {
          const nextMode = prev === 'pick' ? 'drop' : 'pick'
          
          // === ??∞Â??Ôº?Ê†πÊçÆÂΩ???çÈ??‰∏≠Á????? Pick Ëø???? DropÔº?ÂÆ???∂Â????≥Á?µÁ£Å??? ===
          import('../../services/useHardwareStore.ts').then(m => {
            if (m.controlAssemblyMagnet) {
              // ???Êç¢Â?? pick ??∂‰????µÂê∏???(true)Ôº????Êç¢Â?? drop ??∂Ê?≠Á?µÊùæÂº?(false)
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

      //0404 Ëø?‰∏?Ê≠•‰?????Ôº???®‰??‰∏™ÂºπÁ™????Á≠?ÂØπÂ????ΩËÆ©??∫Ê¢∞?????çÊ?∞Âç∏???Ôº???ÅËÆ∏??®Ê?∑Â?∫‰????∞Ê??ÂùêÊ??ÁªßÁª≠ÂæÆË???????ΩÔ?????‰∏çÊ?ØË¢´Ëø´Â?∑Ê?∞È°µÈù¢Â????∞Â?ùÂ????∂Ê??
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
          // === ??∞Â?? 1Ôº?Â•?Âº???πÂºπÁ™?Á≠?ÂØπÂ??Ôº?ËÆ©Ê?∫Ê¢∞?????çÊ?∞Âç∏??? ===
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
          // === ??∞Â?? 2Ôº???πÂ?????ËØØÂºπÁ™?Á≠?ÂØπÂ??Ôº?ËÆ©Ê?∫Ê¢∞?????çÊ?∞Âç∏??? ===
          startAssemblyTeachMode() 
          return
        }
        
        // ‰ª•‰????ØÈ??ËÆ§Á???????™Ê∑ª??†È??ÁªèÁ?π‚?ùÁ????§Ê?≠È?ªË??
        if (selectedCollisionOption !== 'B') {
          setShowWrongAnswerToast(true)
          return
        }
        setShowCollisionHintModal(false)
        setHasCollision(false)
        setSelectedCollisionOption(null)
        setShowRelativeHintInfo(true)
        setShowWrongAnswerToast(false)
        // === ??∞Â?? 3Ôº???™Â?†È??ÁªèÁ?πÂºπÁ™?Á≠?ÂØπÂ??Ôº?ËÆ©Ê?∫Ê¢∞?????çÊ?∞Âç∏??? ===
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
