import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'  // Version complète avec sidebar
import { ThemeProvider } from './contexts/ThemeContext'
import { logger } from './utils/logger'

const log = logger.create('Main')

// Gestionnaire d'erreur global (optimisé pour ne pas bloquer le rendu)
window.addEventListener('error', (event) => {
  // Utiliser requestIdleCallback pour ne pas bloquer le rendu
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      log.error('Global Error', event.error, event.message, `${event.filename}:${event.lineno}`)
    })
  } else {
    setTimeout(() => {
  log.error('Global Error', event.error, event.message, `${event.filename}:${event.lineno}`)
    }, 0)
  }
})

window.addEventListener('unhandledrejection', (event) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      log.error('Unhandled Promise Rejection', event.reason)
    })
  } else {
    setTimeout(() => {
  log.error('Unhandled Promise Rejection', event.reason)
    }, 0)
  }
})

// Optimisation: Précharger les ressources critiques
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Précharger les polices et autres ressources non critiques
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
})
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  log.error('Root element not found!')
  throw new Error('Root element not found')
}

// Créer le root et rendre immédiatement (améliore FCP)
const root = createRoot(rootElement)

// Rendre avec un fallback immédiat pour améliorer le FCP
try {
  // Afficher un loader minimal pendant le chargement
  rootElement.innerHTML = '<div class="loading-spinner"></div>'
  
  // Rendre l'application
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
  rootElement.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444">Erreur de chargement</div>'
}
