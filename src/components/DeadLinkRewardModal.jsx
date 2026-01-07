import { useState } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { FiGift, FiX, FiCheckCircle } from 'react-icons/fi'

export function DeadLinkRewardModal({ isOpen, onClose, gameName, onClaimReward }) {
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const handleClaim = async () => {
    if (claiming || claimed) return
    
    setClaiming(true)
    try {
      // Appeler la fonction de réclamation de récompense
      if (onClaimReward) {
        await onClaimReward()
      }
      setClaimed(true)
      
      // Fermer la modal après 3 secondes
      setTimeout(() => {
        onClose()
        setClaimed(false)
        setClaiming(false)
      }, 3000)
    } catch (error) {
      console.error('[DeadLinkRewardModal] Erreur lors de la réclamation:', error)
      setClaiming(false)
      
      // Afficher un message d'erreur à l'utilisateur
      alert(error.message || 'Erreur lors de la réclamation de la clé gratuite')
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop - Ne pas fermer en cliquant dessus */}
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-gradient-to-br from-[#1a1a20] to-[#0f0f14] border border-cyan-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <FiX className="w-5 h-5" />
          </button>

          {!claimed ? (
            <>
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <Motion.div
                  animate={{ 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full border border-cyan-500/30"
                >
                  <FiGift className="w-12 h-12 text-cyan-400" />
                </Motion.div>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Récompense Spéciale ! 🎁
              </h2>

              {/* Message */}
              <div className="space-y-4 mb-6">
                <p className="text-gray-300 text-center leading-relaxed">
                  Merci d'avoir complété les publicités pour <span className="font-semibold text-cyan-400">{gameName}</span> !
                </p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm text-center">
                    ⚠️ Malheureusement, le lien de téléchargement ne fonctionne pas.
                  </p>
                </div>
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <p className="text-white font-semibold text-center mb-2">
                    🎉 En récompense de votre patience, nous vous offrons :
                  </p>
                  <p className="text-cyan-400 text-lg font-bold text-center">
                    Une clé gratuite pour n'importe quel jeu !
                  </p>
                </div>
              </div>

              {/* Claim button */}
              <Motion.button
                onClick={handleClaim}
                disabled={claiming}
                whileHover={{ scale: claiming ? 1 : 1.05 }}
                whileTap={{ scale: claiming ? 1 : 0.95 }}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {claiming ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Réclamation en cours...</span>
                  </>
                ) : (
                  <>
                    <FiGift className="w-5 h-5" />
                    <span>Réclamer ma clé gratuite</span>
                  </>
                )}
              </Motion.button>
            </>
          ) : (
            <>
              {/* Success state */}
              <div className="flex flex-col items-center text-center">
                <Motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="p-4 bg-green-500/20 rounded-full border border-green-500/30 mb-4"
                >
                  <FiCheckCircle className="w-16 h-16 text-green-400" />
                </Motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Clé réclamée avec succès ! ✅
                </h3>
                <p className="text-gray-400">
                  Votre clé gratuite vous sera envoyée prochainement.
                </p>
              </div>
            </>
          )}
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}
