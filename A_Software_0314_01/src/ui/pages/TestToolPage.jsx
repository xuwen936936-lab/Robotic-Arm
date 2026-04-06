// //0328
// import React, { useEffect, useRef, useState } from 'react'
// import {
//   HARDWARE_SIGNALS,
//   initializeHardwareStore,
//   subscribeHardwareSignal,
//   startFixedMoveTest,
//   useHardwareStore,
// } from '../../services/useHardwareStore.ts'
// import { TestToolPageView } from './TestToolPageView.jsx'

// const RUN_DURATION_MS = 6000

// export default function TestToolPage({ onStartGame, calibratedPayload = '2kg' }) {
//   const hardware = useHardwareStore()
//   const [status, setStatus] = useState('idle')
//   const [showToast, setShowToast] = useState(false)
//   const [showHintModal, setShowHintModal] = useState(false)
//   const [showHintWrongToast, setShowHintWrongToast] = useState(false)
//   const [selectedOption, setSelectedOption] = useState(null)
//   const [selectedTool, setSelectedTool] = useState('Flange')
//   const resultTimerRef = useRef(null)
//   const waitingHardwareResultRef = useRef(false)
//   const selectedToolRef = useRef(selectedTool)

//   // 銆愬凡鍒犻櫎銆戝師鍏堝湪杩欓噷鍙戦�? K 鎸囦护 (TOGGLE_COORD) 鐨? useEffect 宸茬粡琚Щ闄?

//   const hasError = status === 'error'
//   const isSuccess = status === 'success'
//   const payloadValue = selectedTool === 'Tool 1' ? calibratedPayload : '0'
//   // 杩欓噷鐨? connectionInfo 鍘熷皝涓嶅姩锛屼繚鎸佷簡鍘熸湁鍒ゆ柇 real connect 鐨勯�昏緫
//   const connectionInfo = `${
//     hardware.connection === 'connected'
//       ? 'Connected'
//       : hardware.connection === 'error'
//         ? 'Error'
//         : 'Disconnected'
//   } 路 ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

//   useEffect(() => {
//     selectedToolRef.current = selectedTool
//   }, [selectedTool])

//   useEffect(() => {
//     if (!showHintWrongToast) return undefined
//     const toastTimerId = window.setTimeout(() => {
//       setShowHintWrongToast(false)
//     }, 3000)
//     return () => window.clearTimeout(toastTimerId)
//   }, [showHintWrongToast])

//   useEffect(() => {
//     const cleanupHardware = initializeHardwareStore()
//     const unsubscribeSignal = subscribeHardwareSignal((signal) => {
//       if (!waitingHardwareResultRef.current) return
//       if (signal !== HARDWARE_SIGNALS.TEST_TOOL_RUN_FINISHED) return

//       waitingHardwareResultRef.current = false
//       if (resultTimerRef.current !== null) {
//         window.clearTimeout(resultTimerRef.current)
//         resultTimerRef.current = null
//       }

//       if (selectedToolRef.current === 'Tool 1') {
//         setStatus('success')
//         return
//       }
//       setStatus('error')
//       setShowToast(true)
//     })

//     return () => {
//       cleanupHardware()
//       unsubscribeSignal()
//       waitingHardwareResultRef.current = false

//       if (resultTimerRef.current !== null) {
//         window.clearTimeout(resultTimerRef.current)
//       }
//     }
//   }, [])

//   useEffect(() => {
//     if (!showToast) return undefined

//     const toastTimerId = window.setTimeout(() => {
//       setShowToast(false)
//     }, 3000)

//     return () => window.clearTimeout(toastTimerId)
//   }, [showToast])

//   const handleTestClick = () => {
//     if (hardware.isRunning) return

//     setStatus('idle')
//     setShowToast(false)
//     setShowHintModal(false)
//     waitingHardwareResultRef.current = false
//     // 鏍规嵁閫変腑鐨勫伐鍏峰喅瀹氳蛋姝ｈ矾杩樻槸閿欒矾
//     const isCorrectTool = selectedToolRef.current === 'Tool 1'
//     startFixedMoveTest(RUN_DURATION_MS, isCorrectTool)

//     if (resultTimerRef.current !== null) {
//       window.clearTimeout(resultTimerRef.current)
//     }

//     const isRealHardwarePath =
//       hardware.source === 'hardware' && hardware.connection === 'connected'

//     if (isRealHardwarePath) {
//       // Real hardware path: prefer hardware completion signal.
//       waitingHardwareResultRef.current = true
//     }

//     resultTimerRef.current = window.setTimeout(() => {
//       resultTimerRef.current = null
//       // Fallback for mock mode, and also safety fallback if hardware signal is missing.
//       waitingHardwareResultRef.current = false
//       if (selectedToolRef.current === 'Tool 1') {
//         setStatus('success')
//         return
//       }

//       setStatus('error')
//       setShowToast(true)
//     }, RUN_DURATION_MS)
//   }

//   // 銆愭柊澧炴牳蹇冮�昏緫銆戞牴鎹綋鍓嶄笅鎷夋閫夋嫨鐨? Tool锛岀洿鎺ョ敓鎴愬己琛屽啓姝荤殑鍧愭爣浼犵粰瑙嗗浘
//   let displayCoords = { x: '0.00', y: '0.00', z: '430.00', rx: '90.00' }
//   if (selectedTool === 'Tool 1') {
//     displayCoords = { x: '0.00', y: '0.00', z: '440.00', rx: '90.00' }
//   } else if (selectedTool !== 'Flange') { // Gripper, Welder 绛夊叾浠栧伐鍏?
//     displayCoords = { x: '0.00', y: '0.00', z: '435.00', rx: '90.00' }
//   }

//   return (
//     <TestToolPageView
//       // 杩欓噷鍘熸湰鏄? coords={hardware.coords}锛岀幇鍦ㄦ浛鎹负涓婇潰璁＄畻鍑虹殑鍋囨暟鎹? displayCoords
//       coords={displayCoords}
//       connectionInfo={connectionInfo}
//       isRunning={hardware.isRunning}
//       hasError={hasError}
//       isSuccess={isSuccess}
//       showToast={showToast}
//       showHintModal={showHintModal}
//       showHintWrongToast={showHintWrongToast}
//       selectedOption={selectedOption}
//       selectedTool={selectedTool}
//       payloadValue={payloadValue}
//       onSelectTool={setSelectedTool}
//       onSelectOption={setSelectedOption}
//       onPrimaryAction={
//         isSuccess && onStartGame ? onStartGame : handleTestClick
//       }
//       onOpenHintModal={() => setShowHintModal(true)}
//       onCloseHintModal={() => setShowHintModal(false)}
//       onConfirmHintModal={() => {
//         if (selectedOption !== 'C') {
//           setShowHintWrongToast(true)
//           return
//         }
//         setShowHintModal(false)
//         setSelectedOption(null)
//       }}
//     />
//   )
// }


//0405
import React, { useEffect, useRef, useState } from 'react'
import {
  HARDWARE_SIGNALS,
  initializeHardwareStore,
  subscribeHardwareSignal,
  startFixedMoveTest,
  useHardwareStore,
} from '../../services/useHardwareStore.ts'
import { TestToolPageView } from './TestToolPageView.jsx'

export default function TestToolPage({ onStartGame, calibratedPayload = '2kg' }) {
  const hardware = useHardwareStore()
  const [status, setStatus] = useState('idle')
  const [showToast, setShowToast] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  const [showHintWrongToast, setShowHintWrongToast] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedTool, setSelectedTool] = useState('Flange')
  
  // === 核心修改 1：新增本地状态，彻底接管 UI 的 Loading 动画 ===
  const [isTesting, setIsTesting] = useState(false) 

  const resultTimerRef = useRef(null)
  const waitingHardwareResultRef = useRef(false)
  const selectedToolRef = useRef(selectedTool)

  const hasError = status === 'error'
  const isSuccess = status === 'success'
  const payloadValue = selectedTool === 'Tool 1' ? calibratedPayload : '0'
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
    if (!showHintWrongToast) return undefined
    const toastTimerId = window.setTimeout(() => {
      setShowHintWrongToast(false)
    }, 3000)
    return () => window.clearTimeout(toastTimerId)
  }, [showHintWrongToast])

  useEffect(() => {
    const cleanupHardware = initializeHardwareStore()
    const unsubscribeSignal = subscribeHardwareSignal((signal) => {
      if (!waitingHardwareResultRef.current) return
      if (signal !== HARDWARE_SIGNALS.TEST_TOOL_RUN_FINISHED) return

      // === 核心修改 2：只要一收到硬件信号，立刻结束 Loading 状态 (0 误差) ===
      waitingHardwareResultRef.current = false
      setIsTesting(false) 

      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current)
        resultTimerRef.current = null
      }

      if (selectedToolRef.current === 'Tool 1') {
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
    if (isTesting) return // 防止重复点击

    setStatus('idle')
    setShowToast(false)
    setShowHintModal(false)
    setIsTesting(true) // 开启 Loading
    waitingHardwareResultRef.current = false
    
    const isCorrectTool = selectedToolRef.current === 'Tool 1'
    
    // === 核心修改 3：给底层 store 传一个 30 秒的极限时间，防止它提前切断状态 ===
    startFixedMoveTest(30000, isCorrectTool) 

    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current)
    }

    const isRealHardwarePath =
      hardware.source === 'hardware' && hardware.connection === 'connected'

    if (isRealHardwarePath) {
      // 真实硬件模式：开启监听器，死等底层的 SIGNAL，只留一个 30 秒的防断联底线
      waitingHardwareResultRef.current = true
      resultTimerRef.current = window.setTimeout(() => {
        waitingHardwareResultRef.current = false
        setIsTesting(false)
        setStatus('error') // 如果 30 秒了硬件还没发信号，说明硬件死机了
      }, 30000)
    } else {
      // 虚拟环境模式（没连硬件时）：保留原来的 6 秒假动画
      resultTimerRef.current = window.setTimeout(() => {
        waitingHardwareResultRef.current = false
        setIsTesting(false)
        if (selectedToolRef.current === 'Tool 1') {
          setStatus('success')
        } else {
          setStatus('error')
          setShowToast(true)
        }
      }, 6000)
    }
  }

  let displayCoords = { x: '0.00', y: '0.00', z: '430.00', rx: '90.00' }
  if (selectedTool === 'Tool 1') {
    displayCoords = { x: '0.00', y: '0.00', z: '440.00', rx: '90.00' }
  } else if (selectedTool !== 'Flange') {
    displayCoords = { x: '0.00', y: '0.00', z: '435.00', rx: '90.00' }
  }

  return (
    <TestToolPageView
      coords={displayCoords}
      connectionInfo={connectionInfo}
      // === 核心修改 4：将 UI 的 isRunning 绑定到我们完全掌控的本地事件驱动状态 ===
      isRunning={isTesting}
      hasError={hasError}
      isSuccess={isSuccess}
      showToast={showToast}
      showHintModal={showHintModal}
      showHintWrongToast={showHintWrongToast}
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
        if (selectedOption !== 'C') {
          setShowHintWrongToast(true)
          return
        }
        setShowHintModal(false)
        setSelectedOption(null)
      }}
    />
  )
}
