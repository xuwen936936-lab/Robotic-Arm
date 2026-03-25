import React, { useState } from 'react'
import InstallToolPage from './InstallToolPage.jsx'
import InstallCalibrationPage from './InstallCalibrationPage.jsx'
import TestToolPage from './TestToolPage.jsx'
import AssemblyModelPage from './AssemblyModelPage.jsx'
import ExecutionPage from './ExecutionPage.jsx'

export default function InstallFlowPage() {
  const [step, setStep] = useState('install')
  const [calibrationResult, setCalibrationResult] = useState({
    calibratedPayload: '2kg',
  })

  if (step === 'install') {
    return <InstallToolPage onInstalled={() => setStep('calibration')} />
  }

  if (step === 'calibration') {
    return (
      <InstallCalibrationPage
        onNext={(result) => {
          if (result?.calibratedPayload) {
            setCalibrationResult({
              calibratedPayload: result.calibratedPayload,
            })
          }
          setStep('test')
        }}
      />
    )
  }

  if (step === 'test') {
    return (
      <TestToolPage
        calibratedPayload={calibrationResult.calibratedPayload}
        onStartGame={() => setStep('assembly')}
      />
    )
  }

  if (step === 'assembly') {
    return <AssemblyModelPage onGoExecution={() => setStep('execution')} />
  }

  if (step === 'execution') {
    return <ExecutionPage onRestartGame={() => setStep('install')} />
  }

  return null
}

