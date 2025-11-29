import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiExternalLink, FiCheckCircle, FiX } from 'react-icons/fi'

export function DownloadInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay avec backdrop blur */}
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Modal */}
            <Motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl border border-white/20 bg-gradient-to-br from-[#0b0b11] via-[#0f0f17] to-[#0b0b11] p-8 shadow-2xl"
              style={{
                boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
              }}
            >
              {/* Effet de brillance animé */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-600/20 via-transparent to-purple-600/20 opacity-0 animate-pulse" />
              
              {/* Bouton de fermeture */}
              <Motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                <FiX className="text-lg" />
              </Motion.button>

              {/* Icône de succès */}
              <Motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 shadow-lg"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-600/20 to-indigo-600/20 animate-pulse" />
                <FiExternalLink className="relative text-3xl text-purple-400 z-10" />
              </Motion.div>

              {/* Titre */}
              <Motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white text-center mb-4"
              >
                Lien ouvert dans le navigateur
              </Motion.h2>

              {/* Message principal */}
              <Motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/80 text-center mb-6 leading-relaxed"
              >
                Le lien de téléchargement a été ouvert dans votre navigateur.
              </Motion.p>

              {/* Instructions */}
              <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-purple-500/10 border border-purple-500/20 p-5 mb-6"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30">
                    <FiCheckCircle className="text-purple-400 text-lg" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/90 font-medium mb-1">Prochaines étapes :</p>
                    <p className="text-white/70 text-sm leading-relaxed">
                      Une fois les quêtes terminées, cliquez sur <span className="font-semibold text-purple-400">"Lancer le téléchargement"</span> pour continuer.
                    </p>
                  </div>
                </div>
              </Motion.div>

              {/* Bouton OK */}
              <Motion.button
                onClick={onClose}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 px-6 py-4 text-base font-semibold text-white shadow-xl transition-all duration-300"
                style={{
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                <span className="relative z-10">Compris</span>
              </Motion.button>
            </Motion.div>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

