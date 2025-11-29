import { useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheck, FiLoader } from 'react-icons/fi'

export function ShortcutModal({ isOpen, onClose, gameName, exePath, onConfirm }) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleCreate = async () => {
    if (!exePath) {
      setError('Chemin de l\'exécutable non disponible')
      return
    }

    setIsCreating(true)
    setError('')
    
    try {
      if (window.electron && window.electron.games && window.electron.games.createDesktopShortcut) {
        const result = await window.electron.games.createDesktopShortcut(gameName, exePath)
        if (result.success) {
          setSuccess(true)
          setTimeout(() => {
            onConfirm?.()
            onClose()
          }, 1500)
        } else {
          setError(result.error || 'Erreur lors de la création du raccourci')
        }
      } else {
        setError('Fonction non disponible')
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du raccourci')
    } finally {
      setIsCreating(false)
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
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b11] p-6 shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-muted hover:text-white transition-colors"
          >
            <FiX className="text-xl" />
          </button>

          {/* Content */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500/20">
              <FiCheck className="text-3xl text-purple-400" />
            </div>

            <h2 className="mb-2 text-2xl font-bold text-white">
              Téléchargement terminé !
            </h2>

            <p className="mb-6 text-muted">
              Voulez-vous créer un raccourci sur le bureau pour <span className="text-white font-semibold">{gameName}</span> ?
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
                Raccourci créé avec succès !
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isCreating || success}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-all hover:bg-white/10 disabled:opacity-50"
              >
                Plus tard
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || success}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 font-medium text-white transition-all hover:from-purple-500 hover:to-purple-600 disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <FiLoader className="mr-2 inline animate-spin" />
                    Création...
                  </>
                ) : success ? (
                  <>
                    <FiCheck className="mr-2 inline" />
                    Créé !
                  </>
                ) : (
                  'Créer le raccourci'
                )}
              </button>
            </div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}

