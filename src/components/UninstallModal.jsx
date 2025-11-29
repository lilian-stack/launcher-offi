import { useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiX, FiTrash2, FiAlertTriangle, FiLoader } from 'react-icons/fi'

export function UninstallModal({ isOpen, onClose, gameName, onConfirm }) {
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [error, setError] = useState('')

  const handleUninstall = async () => {
    setIsUninstalling(true)
    setError('')
    
    try {
      if (window.electron && window.electron.games && window.electron.games.uninstallGame) {
        const result = await window.electron.games.uninstallGame(gameName)
        if (result.success) {
          // Appeler onConfirm qui gère la mise à jour de l'état sans recharger la page
          onConfirm?.()
          onClose()
          // Ne plus recharger la page - laisser le composant parent gérer la mise à jour
        } else {
          setError(result.error || 'Erreur lors de la désinstallation')
          setIsUninstalling(false)
        }
      } else {
        setError('Fonction non disponible')
        setIsUninstalling(false)
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la désinstallation')
      setIsUninstalling(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0b0b11] p-6 shadow-2xl"
        >
          {/* Close button */}
          {!isUninstalling && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-muted hover:text-white transition-colors"
            >
              <FiX className="text-xl" />
            </button>
          )}

          {/* Content */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <FiAlertTriangle className="text-3xl text-red-400" />
            </div>

            <h2 className="mb-2 text-2xl font-bold text-white">
              Désinstaller {gameName} ?
            </h2>

            <p className="mb-6 text-muted">
              Cette action est <span className="text-red-400 font-semibold">irréversible</span> et supprimera tous les fichiers du jeu de votre ordinateur.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isUninstalling}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-all hover:bg-white/10 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUninstall}
                disabled={isUninstalling}
                className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 font-medium text-white transition-all hover:from-red-500 hover:to-red-600 disabled:opacity-50 flex items-center justify-center"
              >
                {isUninstalling ? (
                  <>
                    <FiLoader className="mr-2 animate-spin" />
                    Désinstallation...
                  </>
                ) : (
                  <>
                    <FiTrash2 className="mr-2" />
                    Désinstaller
                  </>
                )}
              </button>
            </div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}

