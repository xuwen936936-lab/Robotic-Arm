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

// export default function TestToolPage({ onStartGame }) {
//   const hardware = useHardwareStore()
//   const [status, setStatus] = useState('idle')
//   const [showToast, setShowToast] = useState(false)
//   const [showHintModal, setShowHintModal] = useState(false)
//   const [selectedOption, setSelectedOption] = useState(null)
//   const [selectedTool, setSelectedTool] = useState('Flange')
//   const resultTimerRef = useRef(null)
//   const waitingHardwareResultRef = useRef(false)
//   const selectedToolRef = useRef(selectedTool)

//   //0327
//   useEffect(() => {
//     // ȷ��Ӳ��������������ʵ�����豸ģʽ
//     if (hardware.connection === 'connected' && hardware.source === 'hardware') {
//       console.log("[TestPage] Auto-triggering TOGGLE_COORD (K) on mount...");
      
//       // ��̬���� store ��ִ�з��� K ָ��ĺ���
//       import('../../services/useHardwareStore.ts').then(m => {
//         // ȷ�����Ѿ��� useHardwareStore.ts �е������������
//         if (m.triggerCoordinateFlow) {
//           m.triggerCoordinateFlow(); 
//         }
//       });
//     }
//     // �������������״̬��ȷ�����ӳɹ�˲�䴥�� 
//   }, [hardware.connection, hardware.source]);

//   const hasError = status === 'error'
//   const isSuccess = status === 'success'
//   const connectionInfo = `${
//     hardware.connection === 'connected'
//       ? 'Connected'
//       : hardware.connection === 'error'
//         ? 'Error'
//         : 'Disconnected'
//   } · ${hardware.source === 'hardware' ? 'Real' : 'Virtual'}`

//   useEffect(() => {
//     selectedToolRef.current = selectedTool
//   }, [selectedTool])

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
//     // 根据选中的工具决定走正确路径还是错误路径
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

//   return (
//     <TestToolPageView
//       coords={hardware.coords}
//       connectionInfo={connectionInfo}
//       isRunning={hardware.isRunning}
//       hasError={hasError}
//       isSuccess={isSuccess}
//       showToast={showToast}
//       showHintModal={showHintModal}
//       selectedOption={selectedOption}
//       selectedTool={selectedTool}
//       onSelectTool={setSelectedTool}
//       onSelectOption={setSelectedOption}
//       onPrimaryAction={
//         isSuccess && onStartGame ? onStartGame : handleTestClick
//       }
//       onOpenHintModal={() => setShowHintModal(true)}
//       onCloseHintModal={() => setShowHintModal(false)}
//       onConfirmHintModal={() => {
//         if (selectedOption !== 'C') return
//         setShowHintModal(false)
//         setSelectedOption(null)
//       }}
//     />
//   )
// }


//0328
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
  const [showHintWrongToast, setShowHintWrongToast] = useState(false)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedTool, setSelectedTool] = useState('Flange')
  const resultTimerRef = useRef(null)
  const waitingHardwareResultRef = useRef(false)
  const selectedToolRef = useRef(selectedTool)

  // 【已删除】原先在这里发送 K 指令 (TOGGLE_COORD) 的 useEffect 已经被移除

  const hasError = status === 'error'
  const isSuccess = status === 'success'
  const payloadValue = selectedTool === 'Tool 1' ? calibratedPayload : '0'
  // 这里的 connectionInfo 原封不动，保持了原有判断 real connect 的逻辑
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

      waitingHardwareResultRef.current = false
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
    if (hardware.isRunning) return

    setStatus('idle')
    setShowToast(false)
    setShowHintModal(false)
    waitingHardwareResultRef.current = false
    // 根据选中的工具决定走正路还是错路
    const isCorrectTool = selectedToolRef.current === 'Tool 1'
    startFixedMoveTest(RUN_DURATION_MS, isCorrectTool)

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
      if (selectedToolRef.current === 'Tool 1') {
        setStatus('success')
        return
      }

      setStatus('error')
      setShowToast(true)
    }, RUN_DURATION_MS)
  }

  // 【新增核心逻辑】根据当前下拉框选择的 Tool，直接生成强行写死的坐标传给视图
  let displayCoords = { x: '0.00', y: '0.00', z: '430.00', rx: '90.00' }
  if (selectedTool === 'Tool 1') {
    displayCoords = { x: '0.00', y: '0.00', z: '440.00', rx: '90.00' }
  } else if (selectedTool !== 'Flange') { // Gripper, Welder 等其他工具
    displayCoords = { x: '0.00', y: '0.00', z: '435.00', rx: '90.00' }
  }

  return (
    <TestToolPageView
      // 这里原本是 coords={hardware.coords}，现在替换为上面计算出的假数据 displayCoords
      coords={displayCoords}
      connectionInfo={connectionInfo}
      isRunning={hardware.isRunning}
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
