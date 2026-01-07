import { Motion } from './Motion'
import { FiMinimize2, FiMaximize2, FiX, FiSquare } from 'react-icons/fi'
import { useState, useEffect } from 'react'
import { ActorisLogo } from './ActorisLogo'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Vérifier l'état initial de la fenêtre
    if (window.electron?.window?.isMaximized) {
      window.electron.window.isMaximized().then(maximized => {
        setIsMaximized(maximized)
      })
    }

    // Écouter les changements d'état
    const handleMaximize = () => setIsMaximized(true)
    const handleUnmaximize = () => setIsMaximized(false)

    if (window.electron?.window?.onMaximize) {
      window.electron.window.onMaximize(handleMaximize)
      window.electron.window.onUnmaximize(handleUnmaximize)
    }

    return () => {
      if (window.electron?.window?.removeMaximizeListener) {
        window.electron.window.removeMaximizeListener(handleMaximize)
        window.electron.window.removeUnmaximizeListener(handleUnmaximize)
      }
    }
  }, [])

  const handleMinimize = () => {
    if (window.electron?.window?.minimize) {
      window.electron.window.minimize()
    }
  }

  const handleMaximize = () => {
    if (window.electron?.window?.maximize) {
      window.electron.window.maximize()
    }
  }

  const handleUnmaximize = () => {
    if (window.electron?.window?.unmaximize) {
      window.electron.window.unmaximize()
    }
  }

  const handleClose = () => {
    if (window.electron?.window?.close) {
      window.electron.window.close()
    }
  }

  // Ne pas afficher si on n'est pas dans Electron
  if (!window.electron?.isElectron) {
    return null
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 h-10 bg-gradient-to-r from-[#0a0a0f]/95 via-[#0f0f14]/95 to-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/10 z-[10000] flex items-center justify-between px-4 drag-region"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Logo Actoris à gauche */}
      <div className="flex items-center gap-2 no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
        <ActorisLogo size="small" showText={false} />
        <span className="text-white text-sm font-medium">Actoris</span>
      </div>

      {/* Contrôles de fenêtre à droite */}
      <div className="flex items-center no-drag bg-black/40 backdrop-blur-sm rounded-xl border border-white/10" style={{ WebkitAppRegion: 'no-drag' }}>
        <Motion.button
          whileHover={{ 
            backgroundColor: 'rgba(59, 130, 246, 0.3)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          onClick={handleMinimize}
          className="relative w-12 h-8 bg-transparent border-r border-white/10 last:border-r-0 flex items-center justify-center transition-all duration-300 ease-out overflow-hidden group first:rounded-l-xl last:rounded-r-xl"
          title="Minimiser"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <FiMinimize2 className="text-white text-xs relative z-10 group-hover:text-blue-300 transition-colors" />
        </Motion.button>
        
        <Motion.button
          whileHover={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.3)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation()
            if (isMaximized) {
              handleUnmaximize()
            } else {
              handleMaximize()
            }
          }}
          className="relative w-12 h-8 bg-transparent border-r border-white/10 last:border-r-0 flex items-center justify-center transition-all duration-300 ease-out overflow-hidden group first:rounded-l-xl last:rounded-r-xl"
          title={isMaximized ? 'Restaurer' : 'Agrandir'}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <FiSquare className="text-white text-xs relative z-10 group-hover:text-emerald-300 transition-colors" />
        </Motion.button>
        
        <Motion.button
          whileHover={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.4)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClose}
          className="relative w-12 h-8 bg-transparent border-r border-white/10 last:border-r-0 flex items-center justify-center transition-all duration-300 ease-out overflow-hidden group first:rounded-l-xl last:rounded-r-xl rounded-r-xl"
          title="Fermer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <FiX className="text-white text-xs relative z-10 group-hover:text-red-300 transition-colors" />
        </Motion.button>
      </div>
    </Motion.div>
  )
}

