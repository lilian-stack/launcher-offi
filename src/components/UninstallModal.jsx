import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'
import { FiX, FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi'

export function UninstallModal({ 
  isOpen, 
  onClose, 
  gameName, 
  onConfirm, 
  isUninstalling = false,
  progress = 0,
  currentStep = '',
  error = null
}) {
  const [localStep, setLocalStep] = useState('')

  // Mettre à jour l'étape
  useEffect(() => {
    if (isUninstalling) {
      if (currentStep) {
        setLocalStep(currentStep)
      } else {
        setLocalStep('Suppression en cours...')
      }
    } else if (progress >= 100 && !error) {
      // Quand terminé à 100%
      setLocalStep('Finalisation...')
    } else if (!isUninstalling && progress < 100 && !error) {
      // Réinitialiser seulement si ce n'est pas un succès
      setLocalStep('')
    }
  }, [isUninstalling, progress, currentStep, error])

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
      }
  }

  const handleClose = () => {
    if (!isUninstalling) {
      onClose()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
        {/* Backdrop avec flou qui couvre TOUT, y compris sidebar et topbar */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/70"
          style={{
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            zIndex: 99999
          }}
        />

        {/* Modal */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-[#1a1a20] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/10"
          style={{ zIndex: 100000, position: 'relative' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500/20 to-red-600/20 border-b border-red-500/30 p-6 text-white relative">
          {!isUninstalling && (
              <Motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <FiX className="text-xl" />
              </Motion.button>
          )}
            <h2 className="text-2xl font-bold">Désinstallation</h2>
            <p className="text-red-300/80 mt-1">{gameName || 'Jeu'}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Afficher l'état initial seulement si pas en cours, pas d'erreur, et progression < 100 */}
            {!isUninstalling && !error && progress < 100 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <FiAlertCircle className="text-amber-400 flex-shrink-0 mt-0.5 text-xl" />
                  <div className="text-sm text-amber-300">
                    <p className="font-semibold mb-1">Attention</p>
                    <p>Toutes les données du jeu seront définitivement supprimées.</p>
                  </div>
            </div>

                <div className="flex gap-3">
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 border border-white/10 text-gray-300 rounded-xl hover:bg-white/5 transition-colors font-medium"
                  >
                    Annuler
                  </Motion.button>
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-lg shadow-red-500/20"
                  >
                    Désinstaller
                  </Motion.button>
                </div>
              </div>
            )}

            {isUninstalling && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[#0f0f14] via-red-950/20 to-[#0f0f14] p-8 rounded-xl border border-red-500/20">
                  <div className="flex items-center justify-center mb-6">
                    <div 
                      className="w-20 h-20 border-4 rounded-full"
                      style={{
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        borderTopColor: 'rgb(239, 68, 68)',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {localStep || 'Suppression en cours...'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Veuillez patienter, ne fermez pas cette fenêtre...
            </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                    <FiAlertCircle className="text-red-400 text-3xl" />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Erreur de désinstallation
                  </h3>
                  <p className="text-gray-400">
                    {error || 'Une erreur est survenue lors de la désinstallation.'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 border border-white/10 text-gray-300 rounded-xl hover:bg-white/5 transition-colors font-medium"
                  >
                    Fermer
                  </Motion.button>
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium"
                  >
                    Réessayer
                  </Motion.button>
                </div>
              </div>
            )}

            {!isUninstalling && !error && progress >= 100 && (
              <div className="space-y-4 text-center -m-6 -mt-0">
                <div className="bg-gradient-to-br from-[#0f0f14] via-green-950/20 to-[#0f0f14] p-8 rounded-xl border border-green-500/20">
                  <div className="flex justify-center mb-6">
                    <Motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                        <FiCheckCircle className="text-green-400 text-3xl" />
                      </div>
                    </Motion.div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Désinstallation réussie
                    </h3>
                    <p className="text-gray-300">
                      Le jeu a été complètement supprimé de votre système.
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="w-full px-4 py-3 bg-[#1a1a20] hover:bg-[#1f1f26] text-white rounded-xl transition-colors font-medium border border-white/10"
                  >
                    Fermer
                  </Motion.button>
            </div>
              </div>
            )}
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
