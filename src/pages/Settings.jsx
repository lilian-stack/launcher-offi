import { useEffect, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiUser, FiMail, FiStar } from 'react-icons/fi'

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <Motion.div 
      className="group flex items-center justify-between py-4 px-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm hover:border-white/10 hover:bg-white/8 transition-all duration-300 last:border-0"
      whileHover={{ scale: 1.01, x: 4 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-muted mt-1">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-14 h-7 rounded-full transition-all duration-300 shadow-lg ${
          enabled 
            ? 'bg-gradient-to-r from-primary to-purple-500 shadow-primary/30' 
            : 'bg-white/10 shadow-black/20'
        }`}
      >
        <Motion.div
          className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md"
          animate={{ x: enabled ? 28 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </Motion.div>
  )
}

function InputRow({ label, value, icon: Icon }) {
  return (
    <Motion.div 
      className="space-y-3 group"
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <label className="text-xs font-semibold text-muted uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="text-primary text-sm" />
        </div>
        <input
          type="text"
          value={value}
          readOnly
          className="w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 pl-12 text-sm text-white focus:border-primary/50 focus:outline-none transition-all hover:border-white/20 hover:bg-white/8"
        />
      </div>
    </Motion.div>
  )
}

export function SettingsPage({ currentUser }) {
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [isUpdatingAutoLaunch, setIsUpdatingAutoLaunch] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchAutoLaunch = async () => {
      if (!window.electron?.autostart) return
      try {
        const result = await window.electron.autostart.getStatus()
        if (isMounted && result?.success) {
          setAutoLaunch(!!result.enabled)
        }
      } catch (error) {
        console.warn('[Settings] Impossible de récupérer le statut autostart:', error)
      }
    }
    fetchAutoLaunch()
    return () => {
      isMounted = false
    }
  }, [])

  const handleAutoLaunchToggle = async () => {
    if (!window.electron?.autostart || isUpdatingAutoLaunch) {
      setAutoLaunch((prev) => !prev)
      return
    }
    const nextValue = !autoLaunch
    setAutoLaunch(nextValue)
    setIsUpdatingAutoLaunch(true)
    try {
      const result = await window.electron.autostart.setStatus(nextValue)
      if (!result?.success) {
        throw new Error(result?.error || 'Impossible de mettre à jour le démarrage automatique')
      }
      setAutoLaunch(!!result.enabled)
    } catch (error) {
      console.error('[Settings] Mise à jour autostart échouée:', error)
      setAutoLaunch((prev) => !prev)
    } finally {
      setIsUpdatingAutoLaunch(false)
    }
  }

  const username = currentUser?.username || ''
  const email = currentUser?.email || ''
  const avatarInitial = username ? username.charAt(0).toUpperCase() : 'A'

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <div className="space-y-6">
        <Motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="group relative overflow-hidden space-y-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl transition-all duration-500 hover:border-white/20 hover:shadow-primary/20"
          style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
          }}
        >
          {/* Glow effects */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl -z-10" />
          
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                <FiStar className="text-primary text-sm" />
              </div>
              Général
            </h2>
            <p className="text-sm text-muted mt-2 ml-12">
              Ajustez l'apparence et le comportement du launcher.
            </p>
          </div>

          <div className="space-y-0">
            <ToggleRow
              label="Démarrage automatique"
              description="Lancer au démarrage de Windows"
              enabled={autoLaunch}
              onToggle={handleAutoLaunchToggle}
            />
            <ToggleRow
              label="Notifications"
              description="Recevoir des notifications"
              enabled={notifications}
              onToggle={() => setNotifications((prev) => !prev)}
            />
          </div>
        </Motion.section>
      </div>

      <div className="space-y-6">
        <Motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="group relative overflow-hidden space-y-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl transition-all duration-500 hover:border-white/20 hover:shadow-primary/20"
          style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
          }}
        >
          {/* Glow effects */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl -z-10" />
          
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                <FiUser className="text-primary text-sm" />
              </div>
              Compte
            </h2>
            <p className="text-sm text-muted mt-2 ml-12">
              Gérez votre profil utilisateur et vos informations.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Motion.div 
              className="relative group/avatar"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-purple-500/20 border-2 border-primary/30 shadow-xl shadow-primary/20">
                {currentUser?.avatar ? (
                  <img 
                    src={currentUser.avatar} 
                    alt={username}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-primary">{avatarInitial}</span>
                )}
              </div>
            </Motion.div>
          </div>

          <div className="space-y-4">
            <div className="space-y-3 group">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">
                Nom d'utilisateur
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <FiUser className="text-primary text-sm" />
                </div>
                <div className="flex items-center gap-2 w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 pl-12 text-sm text-white">
                  <span>{username}</span>
                  {currentUser?.isVip && (
                    <img 
                      src="/badge-vip.png" 
                      alt="VIP Badge" 
                      className="w-7 h-7 object-contain"
                      style={{ 
                        mixBlendMode: 'screen',
                        filter: 'brightness(1.1)'
                      }}
                    />
                  )}
                  {currentUser?.isBoost && !currentUser?.isVip && (
                    <img 
                      src="/badge-premium.png" 
                      alt="Premium Badge" 
                      className="w-7 h-7 object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
            <InputRow 
              label="E-mail" 
              value={email}
              icon={FiMail}
            />
          </div>
        </Motion.section>
      </div>
    </div>
  )
}
