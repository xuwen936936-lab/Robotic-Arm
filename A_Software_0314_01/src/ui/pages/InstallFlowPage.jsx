import React, { useState } from 'react'
import InstallToolPage from './InstallToolPage.jsx'
import InstallCalibrationPage from './InstallCalibrationPage.jsx'
import TestToolPage from './TestToolPage.jsx'
import AssemblyModelPage from './AssemblyModelPage.jsx'
import ExecutionPage from './ExecutionPage.jsx'

export default function InstallFlowPage() {
  const [step, setStep] = useState('install')

  if (step === 'install') {
    return <InstallToolPage onInstalled={() => setStep('calibration')} />
  }

  if (step === 'calibration') {
    return <InstallCalibrationPage onNext={() => setStep('test')} />
  }

  if (step === 'test') {
    return <TestToolPage onStartGame={() => setStep('assembly')} />
  }

  if (step === 'assembly') {
    return <AssemblyModelPage onGoExecution={() => setStep('execution')} />
  }

  if (step === 'execution') {
    return <ExecutionPage onRestartGame={() => setStep('install')} />
  }

  return null
}

