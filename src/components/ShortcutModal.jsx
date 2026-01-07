import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'
import { FiX, FiCheck, FiLoader, FiLink2, FiAlertCircle } from 'react-icons/fi'

export function ShortcutModal({ isOpen, onClose, gameName, exePath, onConfirm }) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [alreadyExists, setAlreadyExists] = useState(false)

  const checkIfShortcutExists = useCallback(async () => {
    try {
      if (window.electron?.games?.checkShortcutExists) {
        const result = await window.electron.games.checkShortcutExists(gameName)
        setAlreadyExists(result?.exists === true)
      }
    } catch (err) {
      console.error('[ShortcutModal] Erreur lors de la vérification:', err)
      setAlreadyExists(false)
    }
  }, [gameName])

  // Vérifier si le raccourci existe déjà quand le modal s'ouvre
  useEffect(() => {
    if (isOpen && gameName) {
      checkIfShortcutExists()
      setIsCreating(false)
      setError('')
      setSuccess(false)
    }
  }, [isOpen, gameName, checkIfShortcutExists])

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
          setIsCreating(false)
          setSuccess(true)
          setTimeout(() => {
            onConfirm?.()
            setTimeout(() => {
            onClose()
            }, 1000)
          }, 1500)
        } else {
          setIsCreating(false)
          setError(result.error || 'Erreur lors de la création du raccourci')
        }
      } else {
        setIsCreating(false)
        setError('Fonction non disponible')
      }
    } catch (err) {
      setIsCreating(false)
      setError(err.message || 'Erreur lors de la création du raccourci')
    }
  }

  const handleClose = () => {
    if (!isCreating && !success) {
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
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border-b border-cyan-500/30 p-6 text-white relative">
            {!isCreating && !success && !alreadyExists && (
              <Motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <FiX className="text-xl" />
              </Motion.button>
            )}
            <h2 className="text-2xl font-bold">
              {alreadyExists ? 'Raccourci existant' : 'Créer un raccourci'}
            </h2>
            <p className="text-cyan-300/80 mt-1">{gameName || 'Jeu'}</p>
          </div>

          {/* Content */}
          <div className="p-6">
            {alreadyExists && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                    <FiLink2 className="text-cyan-400 text-4xl" />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Raccourci déjà créé
                  </h3>
                  <p className="text-gray-300">
                    Le raccourci pour <span className="font-semibold text-white">{gameName}</span> existe déjà sur votre bureau.
                  </p>
            </div>

                <div className="p-6 pt-0">
                  <Motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onClose()}
                    className="w-full px-4 py-3 bg-[#1a1a20] hover:bg-[#1f1f26] text-white rounded-xl transition-colors font-medium border border-white/10"
                  >
                    D'accord
                  </Motion.button>
                </div>
              </div>
            )}

            {!isCreating && !success && !error && !alreadyExists && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/30 flex items-center justify-center mb-4">
                    <FiLink2 className="text-4xl text-cyan-400" />
                  </div>

                  <p className="text-gray-300 text-base leading-relaxed">
                    Voulez-vous créer un raccourci sur le bureau pour lancer{' '}
                    <span className="font-semibold text-white">{gameName}</span> rapidement ?
            </p>

                  <div className="w-full mt-4 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <FiLink2 className="text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-cyan-300/90">
                        <p className="font-medium mb-1">Avantages du raccourci :</p>
                        <ul className="list-disc list-inside space-y-1 text-cyan-200/70">
                          <li>Accès rapide depuis le bureau</li>
                          <li>Lancement direct du jeu</li>
                        </ul>
                      </div>
                    </div>
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
                    onClick={handleCreate}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all font-medium shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                  >
                    <FiLink2 className="w-4 h-4" />
                    Créer le raccourci
                  </Motion.button>
                </div>
              </div>
            )}

            {isCreating && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-[#0f0f14] via-cyan-950/20 to-[#0f0f14] p-8 rounded-xl border border-cyan-500/20">
                  <div className="flex items-center justify-center mb-6">
                    <Motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <FiLoader className="text-cyan-400 text-5xl" />
                    </Motion.div>
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-white mb-2">
                      Création du raccourci...
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Veuillez patienter un instant
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
                    Erreur
                  </h3>
                  <p className="text-gray-400">
                    {error || 'Une erreur est survenue lors de la création du raccourci.'}
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
                onClick={handleCreate}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all font-medium"
                  >
                    Réessayer
                  </Motion.button>
                </div>
              </div>
            )}

            {success && (
              <div className="space-y-4 text-center -m-6 -mt-0">
                <div className="bg-gradient-to-br from-[#0f0f14] via-green-950/20 to-[#0f0f14] p-8 rounded-xl border border-green-500/20">
                  <div className="flex justify-center mb-6">
                    <Motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                        <FiCheck className="text-green-400 text-4xl" />
                      </div>
                    </Motion.div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Raccourci créé avec succès !
                    </h3>
                    <p className="text-gray-300">
                      Le raccourci pour <span className="font-semibold text-white">{gameName}</span> a été créé sur votre bureau.
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
                    Parfait !
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
