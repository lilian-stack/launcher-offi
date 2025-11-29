import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { logger } from './utils/logger'

const log = logger.create('Main')

// Gestionnaire d'erreur global
window.addEventListener('error', (event) => {
  log.error('Global Error', event.error, event.message, `${event.filename}:${event.lineno}`)
})

window.addEventListener('unhandledrejection', (event) => {
  log.error('Unhandled Promise Rejection', event.reason)
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  log.error('Root element not found!')
  throw new Error('Root element not found')
}

const root = createRoot(rootElement)

try {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
  log.debug('Application rendered successfully')
} catch (error) {
  log.error('Error during render', error, error.stack)
}
