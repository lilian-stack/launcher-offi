import { useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiUpload, FiCheckCircle, FiUser, FiMail } from 'react-icons/fi'

export function SettingsPage({ currentUser }) {
  const [autoLaunch, setAutoLaunch] = useState(true)
  const [notifications, setNotifications] = useState(true)

  // Récupérer les informations de l'utilisateur
  const username = currentUser?.username || ''
  const email = currentUser?.email || ''
  const isAdmin = currentUser?.isAdmin || currentUser?.isVip || false
  const avatarInitial = username ? username.charAt(0).toUpperCase() : 'A'

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <div className="space-y-6">
        <Motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="surface-card space-y-6 rounded-2xl border border-border/50 p-6 bg-[#0a0a0f]"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Général</h2>
            <p className="text-sm text-muted mt-1">
              Ajustez l'apparence et le comportement du launcher.
            </p>
          </div>

          <div className="space-y-3">
            <ToggleRow
              label="Démarrage automatique"
              description="Lancer au démarrage de Windows"
              enabled={autoLaunch}
              onToggle={() => setAutoLaunch((prev) => !prev)}
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
          className="surface-card space-y-6 rounded-2xl border border-border/50 p-6 bg-[#0a0a0f]"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Compte</h2>
            <p className="text-sm text-muted mt-1">
              Gérez votre profil utilisateur et vos informations.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20">
                {currentUser?.avatar ? (
                  <img 
                    src={currentUser.avatar} 
                    alt={username}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-primary">{avatarInitial}</span>
                )}
              </div>
              <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary border-2 border-background hover:bg-primary/90 transition-colors">
                <FiUpload className="text-xs text-white" />
              </button>
            </div>
            <button className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-muted px-4 py-2 text-sm font-medium text-white transition-colors hover:border-border hover:bg-surface-muted/80">
              <FiUpload className="text-sm" />
              Ajouter une photo
            </button>
            <span className="text-xs text-muted">JPG, PNG ou GIF (max 2MB)</span>
          </div>

          <div className="space-y-4">
            <InputRow 
              label="Nom d'utilisateur" 
              value={username}
              icon={FiUser}
            />
            <InputRow 
              label="E-mail" 
              value={email}
              icon={FiMail}
            />
          </div>

          <div className="space-y-2">
            {currentUser?.isAdmin ? (
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400/20 to-yellow-500/20 border border-amber-500/30 px-3 py-2.5">
                <FiCheckCircle className="text-sm text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Statut Admin</span>
              </div>
            ) : currentUser?.isVip ? (
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400/20 to-yellow-500/20 border border-amber-500/30 px-3 py-2.5">
                <FiCheckCircle className="text-sm text-amber-400" />
                <span className="text-sm font-medium text-amber-400">Statut VIP</span>
              </div>
            ) : currentUser?.isBoost ? (
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 px-3 py-2.5">
                <FiCheckCircle className="text-sm text-indigo-400" />
                <span className="text-sm font-medium text-indigo-400">Statut Boost</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-surface-muted border border-border/50 px-3 py-2.5">
                <FiCheckCircle className="text-sm text-muted" />
                <span className="text-sm font-medium text-muted">Statut Gratuit</span>
              </div>
            )}
          </div>

          <Motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="button-primary mt-4 w-full justify-center"
          >
            <span>Sauvegarder</span>
          </Motion.button>
        </Motion.section>
      </div>
    </div>
  )
}

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/40 bg-surface-muted px-4 py-3.5 transition-colors hover:border-border/60">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <Motion.button
        onClick={onToggle}
        className={`toggle-track ${enabled ? 'bg-primary/80' : ''}`}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <Motion.span
          className={`toggle-thumb ${
            enabled ? 'bg-white shadow-md' : ''
          }`}
          animate={{ x: enabled ? 20 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </Motion.button>
    </div>
  )
}

function InputRow({ label, value, icon: Icon }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon className="text-sm" />
          </div>
        )}
        <input
          type="text"
          value={value}
          readOnly
          className={`w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-2.5 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 ${
            Icon ? 'pl-10' : ''
          }`}
        />
      </div>
    </div>
  )
}


