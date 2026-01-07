import { useEffect, useState } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { FiX, FiDownload, FiRefreshCw, FiStar } from 'react-icons/fi'

const normalizeVersion = (version = '') => version.toString().trim().replace(/^v/i, '') || '0.0.0'
const compareVersions = (a, b) => {
  const pa = normalizeVersion(a).split('.').map((n) => parseInt(n, 10) || 0)
  const pb = normalizeVersion(b).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? normalizeVersion(__APP_VERSION__) : '0.0.0'
const CHECK_INTERVAL = 5 * 60 * 1000 // Vérifier toutes les 5 minutes
const STORAGE_KEY = 'lastUpdateCheck'

export function AutoUpdateNotification({ onOpenUpdateModal }) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Vérifier si on a déjà vérifié récemment (éviter trop de requêtes)
        const lastCheck = localStorage.getItem(STORAGE_KEY)
        const now = Date.now()
        if (lastCheck && (now - parseInt(lastCheck, 10)) < CHECK_INTERVAL) {
          return // Attendre avant de revérifier
        }

        localStorage.setItem(STORAGE_KEY, now.toString())

        const res = await fetch('https://api.github.com/repos/lilian-stack/launcher-offi/releases/latest', {
          headers: {
            Accept: 'application/vnd.github+json',
          },
        })

        if (res.status === 404) {
          return
        }

        if (!res.ok) {
          return
        }

        const data = await res.json()
        const remoteVersion = normalizeVersion(data.tag_name || data.name || '')
        
        if (compareVersions(remoteVersion, CURRENT_VERSION) > 0) {
          // Vérifier si l'utilisateur a déjà vu cette notification
          const dismissedVersion = localStorage.getItem('dismissedUpdateVersion')
          if (dismissedVersion !== remoteVersion) {
            setUpdateInfo(data)
            setUpdateAvailable(true)
            setIsVisible(true)
            setDismissed(false)
          }
        }
      } catch (error) {
      }
    }

    // Vérifier immédiatement au démarrage
    checkForUpdates()

    // Vérifier périodiquement
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  const handleDismiss = () => {
    if (updateInfo) {
      const version = normalizeVersion(updateInfo.tag_name || updateInfo.name || '')
      localStorage.setItem('dismissedUpdateVersion', version)
    }
    setIsVisible(false)
    setDismissed(true)
  }

  const handleDownload = () => {
    if (onOpenUpdateModal) {
      onOpenUpdateModal()
    }
    setIsVisible(false)
  }

  if (!updateAvailable || !isVisible || dismissed || !updateInfo) {
    return null
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <Motion.div
          initial={{ opacity: 0, y: -100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-4 right-4 z-[9999] max-w-md"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 backdrop-blur-xl shadow-2xl"
            style={{
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            {/* Effet de brillance animé */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
            
            <div className="relative p-5">
              {/* En-tête */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/20 flex items-center justify-center">
                  <FiStar className="text-2xl text-indigo-300 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                    <span>Nouvelle mise à jour disponible !</span>
                  </h3>
                  <p className="text-sm text-white/80">
                    Version <span className="font-semibold text-indigo-300">{normalizeVersion(updateInfo.tag_name || updateInfo.name || '')}</span> disponible
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    Version actuelle : {CURRENT_VERSION}
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Fermer"
                >
                  <FiX className="text-white/60 hover:text-white" />
                </button>
              </div>

              {/* Description */}
              {updateInfo.body && (
                <div className="mb-4 p-3 rounded-xl bg-black/20 border border-white/10">
                  <p className="text-xs text-white/70 line-clamp-2 whitespace-pre-wrap">
                    {updateInfo.body.substring(0, 150)}...
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Motion.button
                  onClick={handleDownload}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm shadow-lg hover:shadow-indigo-500/50 transition-all"
                >
                  <FiDownload className="text-base" />
                  <span>Télécharger</span>
                </Motion.button>
                <Motion.button
                  onClick={handleDismiss}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 font-medium text-sm transition-all"
                >
                  Plus tard
                </Motion.button>
              </div>
            </div>
          </div>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}

