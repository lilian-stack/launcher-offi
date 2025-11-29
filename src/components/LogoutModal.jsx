import { useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FiX, FiLogOut, FiShield } from 'react-icons/fi'

export function LogoutModal({ isOpen, onClose, onConfirm, username }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setTimeout(() => {
      onConfirm?.()
      onClose()
    }, 300)
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
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal */}
        <Motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f0f1a] via-[#0b0b11] to-[#0f0f1a] p-8 shadow-2xl"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
          }}
        >
          {/* Close button */}
          {!isLoggingOut && (
            <Motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-white/60 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white"
            >
              <FiX className="text-lg" />
            </Motion.button>
          )}

          {/* Content */}
          <div className="space-y-6">
            {/* Icon */}
            <Motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 via-purple-600/15 to-transparent border border-purple-500/20"
            >
              <FiLogOut className="text-3xl text-purple-400" />
            </Motion.div>

            {/* Title */}
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-2"
            >
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
                Déconnexion
              </h2>
              <p className="text-white/60 text-base font-light">
                Vous êtes sur le point de vous déconnecter
              </p>
            </Motion.div>

            {/* User info */}
            {username && (
              <Motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/30">
                    <span className="text-lg font-bold text-purple-300">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/50 font-medium">Compte</p>
                    <p className="text-white font-semibold truncate">{username}</p>
                  </div>
                </div>
              </Motion.div>
            )}

            {/* Info message */}
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-start gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4"
            >
              <FiShield className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-300/90 font-medium leading-relaxed">
                  Vos données locales seront conservées. Vous pourrez vous reconnecter à tout moment.
                </p>
              </div>
            </Motion.div>

            {/* Actions */}
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-3 pt-2"
            >
              <Motion.button
                onClick={onClose}
                disabled={isLoggingOut}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-3.5 font-medium text-white/90 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </Motion.button>
              
              <Motion.button
                onClick={handleLogout}
                disabled={isLoggingOut}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 px-6 py-3.5 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
                }}
              >
                {/* Animated gradient */}
                <Motion.div
                  className="absolute inset-0 bg-gradient-to-r from-purple-400 via-purple-300 to-purple-400 opacity-0 group-hover:opacity-100"
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{ backgroundSize: '200% 100%' }}
                />
                
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                
                {/* Content */}
                <div className="relative flex items-center justify-center gap-2.5 z-10">
                  {isLoggingOut ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      <span className="font-medium">Déconnexion...</span>
                    </>
                  ) : (
                    <>
                      <FiLogOut className="text-lg" />
                      <span className="font-semibold">Se déconnecter</span>
                    </>
                  )}
                </div>
              </Motion.button>
            </Motion.div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>
  )
}

