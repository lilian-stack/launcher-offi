import { Motion, AnimatePresence } from './Motion'
import { FiAlertTriangle, FiX, FiInfo } from 'react-icons/fi'

export function DeadLinkNotificationModal({ isOpen, onClose, gameName, errorMessage }) {
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
          className="relative bg-gradient-to-br from-[#1a1a20] to-[#0f0f14] border border-red-500/30 rounded-2xl shadow-2xl max-w-md w-full p-8 z-10"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <FiX className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <Motion.div
              animate={{ 
                rotate: [0, -10, 10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="p-4 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full border border-red-500/30"
            >
              <FiAlertTriangle className="w-12 h-12 text-red-400" />
            </Motion.div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-center mb-4 bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            Lien de Téléchargement Invalide
          </h2>

          {/* Message */}
          <div className="space-y-4 mb-6">
            <p className="text-gray-300 text-center leading-relaxed">
              Le téléchargement de <span className="font-semibold text-red-400">{gameName}</span> a été interrompu.
            </p>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FiInfo className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-400 font-semibold mb-2">
                    Pourquoi le téléchargement s'est arrêté ?
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    Le lien de téléchargement est invalide ou inaccessible. Cela peut être dû à :
                  </p>
                  <ul className="mt-2 space-y-1 text-gray-400 text-sm list-disc list-inside">
                    <li>Le fichier a été supprimé du serveur</li>
                    <li>Le lien a expiré</li>
                    <li>Un problème de connexion réseau</li>
                    <li>Le serveur hébergeur est temporairement indisponible</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400 text-sm text-center">
                <span className="font-semibold">⚡ Action prise :</span> Notre équipe a été automatiquement notifiée et travaillera à corriger ce problème dans les plus brefs délais.
              </p>
            </div>
          </div>

          {/* Close button */}
          <Motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-lg shadow-lg transition-all"
          >
            J'ai compris
          </Motion.button>
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}

