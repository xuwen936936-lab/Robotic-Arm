import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import InstallFlowPage from './ui/pages/InstallFlowPage.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InstallFlowPage />
  </StrictMode>,
)