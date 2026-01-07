import { useState, useEffect, useMemo } from 'react'
import { DiscordLoginModal } from '../components/DiscordLoginModal'

// Icônes
const IconSettings = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconZap = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const IconBell = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const IconUser = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const IconRefresh = ({ className }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const IconChart = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const IconDiscord = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

export function SettingsPage({ currentUser: propCurrentUser, onNavigate, onUserUpdate }) {
  // Force le fond sombre sur tout le document
  useEffect(() => {
    document.body.style.backgroundColor = '#0f0f14'
    document.documentElement.style.backgroundColor = '#0f0f14'
    return () => {
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  const [autoLaunch, setAutoLaunch] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [syncingRoles, setSyncingRoles] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [showDiscordLoginModal, setShowDiscordLoginModal] = useState(false)
  const [gameStats, setGameStats] = useState({
    totalPlayTime: '0h',
    gamesUsed: 0,
    gamesInstalled: 0
  })
  
  // Utiliser le currentUser passé en props ou null si invité
  const currentUser = propCurrentUser
  // Détecter le mode invité : soit pas de currentUser, soit isGuest est true, soit username est 'Invité' ou 'Non connecté'
  const isGuest = !currentUser || currentUser.isGuest === true || currentUser.username === 'Invité' || currentUser.username === 'Non connecté' || !currentUser.username

  // Calculer les vraies statistiques depuis SQLite
  useEffect(() => {
    const calculateStats = async () => {
      try {
        // Récupérer les statistiques depuis SQLite
        if (window.electron?.invoke) {
          const statsResult = await window.electron.invoke('sqlite-library:getStats', currentUser?.id)
          
          if (statsResult && statsResult.success && statsResult.stats) {
            const stats = statsResult.stats
            
            // Convertir le temps de jeu de minutes en heures
            const playTimeHours = Math.floor((stats.totalPlayTime || 0) / 60)
            const playTimeText = playTimeHours > 0 ? `${playTimeHours}h` : '0h'

            setGameStats({
              totalPlayTime: playTimeText,
              gamesUsed: stats.totalGames || 0, // Pour l'instant, on utilise le total des jeux
              gamesInstalled: stats.totalGames || 0 // Nombre total de jeux installés
            })
          } else {
            console.warn('[Settings] Erreur lors de la récupération des stats SQLite:', statsResult?.error)
            // Fallback avec des valeurs par défaut
            setGameStats({
              totalPlayTime: '0h',
              gamesUsed: 0,
              gamesInstalled: 0
            })
          }
        } else {
          console.warn('[Settings] window.electron.invoke non disponible')
          setGameStats({
            totalPlayTime: '0h',
            gamesUsed: 0,
            gamesInstalled: 0
          })
        }
      } catch (error) {
        console.error('[Settings] Erreur lors du calcul des statistiques:', error)
        setGameStats({
          totalPlayTime: '0h',
          gamesUsed: 0,
          gamesInstalled: 0
        })
      }
    }

    // Calculer les stats si l'utilisateur est VIP/Admin
    if (currentUser?.isVip || currentUser?.isAdmin) {
      calculateStats()
    }
  }, [currentUser])

  const handleSyncRoles = () => {
    setSyncingRoles(true)
    setSyncMessage(null)
    
    // Appeler la fonction de synchronisation Discord si disponible
    if (window.electron?.discord?.syncRoles) {
      window.electron.discord.syncRoles()
        .then(() => {
          setSyncingRoles(false)
          setSyncMessage({
            type: 'success',
            text: 'Rôles Discord synchronisés avec succès'
          })
          setTimeout(() => setSyncMessage(null), 5000)
        })
        .catch((error) => {
          setSyncingRoles(false)
          setSyncMessage({
            type: 'error',
            text: error.message || 'Erreur lors de la synchronisation'
          })
          setTimeout(() => setSyncMessage(null), 5000)
        })
    } else {
      // Fallback pour le développement
      setTimeout(() => {
        setSyncingRoles(false)
        setSyncMessage({
          type: 'success',
          text: 'Rôles Discord synchronisés avec succès'
        })
        setTimeout(() => setSyncMessage(null), 5000)
      }, 2000)
    }
  }

  const handleConnectDiscord = () => {
    // Afficher le modal de connexion Discord
    setShowDiscordLoginModal(true)
  }

  const handleDiscordLogin = (user, sessionToken) => {
    // L'utilisateur s'est connecté avec succès
    setShowDiscordLoginModal(false)
    // Le modal gère déjà la connexion, on peut juste fermer le modal
    // L'utilisateur sera mis à jour automatiquement via onUserUpdate dans App.jsx
  }

  const settingsSections = useMemo(() => [
    {
      title: 'Général',
      icon: IconZap,
      gradient: 'from-cyan-500 to-blue-500',
      items: [
        {
          label: 'Lancer au démarrage',
          description: 'Démarrer automatiquement au démarrage de Windows',
          value: autoLaunch,
          onChange: () => setAutoLaunch(!autoLaunch),
          icon: IconZap
        },
        {
          label: 'Notifications',
          description: 'Recevoir des notifications pour les mises à jour',
          value: notifications,
          onChange: () => setNotifications(!notifications),
          icon: IconBell
        }
      ]
    },
    {
      title: 'Compte',
      icon: IconUser,
      gradient: 'from-emerald-500 to-teal-500',
      items: [
        {
          label: 'Nom d\'utilisateur',
          value: isGuest ? 'Invité' : (currentUser?.username || 'Non connecté'),
          type: 'display'
        },
        {
          label: 'Statut',
          value: isGuest ? 'Invité' : (currentUser?.isAdmin ? 'Administrateur' : 
                 currentUser?.isVip ? 'VIP' : 
                 currentUser?.isBoost ? 'Boost' : 'Gratuit'),
          type: 'display',
          badge: isGuest ? 'free' : (currentUser?.isAdmin ? 'admin' :
                 currentUser?.isVip ? 'vip' :
                 currentUser?.isBoost ? 'boost' : 'free')
        },
        {
          label: isGuest ? 'Se connecter à Discord' : 'Synchroniser les rôles Discord',
          description: isGuest ? 'Connectez-vous avec Discord pour accéder à toutes les fonctionnalités' : 'Mettre à jour vos rôles Discord',
          type: 'button',
          onClick: isGuest ? handleConnectDiscord : handleSyncRoles,
          disabled: isGuest ? false : syncingRoles,
          icon: isGuest ? IconDiscord : IconRefresh,
          loading: syncingRoles,
          buttonText: isGuest ? 'Se connecter' : undefined // undefined pour utiliser la logique par défaut basée sur loading
        }
      ]
    }
  ], [isGuest, autoLaunch, notifications, syncingRoles, currentUser])

  return (
    <div className="h-full bg-[#0f0f14] overflow-hidden">
      {/* Background sombre subtil */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[#0f0f14]">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-950/20 to-blue-950/20 rounded-full blur-[100px] animate-pulse" 
             style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-950/20 to-purple-950/20 rounded-full blur-[100px] animate-pulse" 
             style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 h-full flex flex-col">
        {/* Header compact - avec marge pour éviter la sidebar et titlebar */}
        <div className="flex-shrink-0 px-6 py-4 ml-24 mt-16">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative p-2.5 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
                <IconSettings />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Paramètres
              </h1>
              <p className="text-gray-400 text-sm">Gérez vos préférences</p>
            </div>
          </div>
        </div>

        {/* Contenu principal - Grid layout pour optimiser l'espace */}
        <div className="flex-1 px-6 pb-6 overflow-hidden ml-24 mt-2">
          <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
            {settingsSections.map((section, sectionIndex) => (
              <div key={sectionIndex} 
                   className="group relative bg-[#1a1a24] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden
                            hover:bg-[#1e1e28] hover:border-white/15 transition-all duration-300 flex flex-col">
                
                {/* Glow effect subtil */}
                <div className={`absolute -inset-px bg-gradient-to-r ${section.gradient} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500`} />
                
                {/* Header section compact */}
                <div className="relative px-5 py-4 border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-gradient-to-br ${section.gradient} rounded-lg shadow-lg`}>
                      <section.icon />
                    </div>
                    <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                  </div>
                </div>

                {/* Items - Optimisé pour l'espace */}
                <div className="relative p-4 space-y-3 flex-1 overflow-y-auto scrollbar-simple">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex}
                         className="p-3 rounded-xl bg-[#1a1a24] border border-white/10
                                  hover:bg-[#1e1e28] hover:border-white/15 transition-all duration-200">
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {item.icon && (
                            <div className="p-1.5 bg-white/5 rounded-lg text-gray-400 flex-shrink-0 mt-0.5">
                              <item.icon />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <label className="text-white font-medium text-sm block mb-1">
                              {item.label}
                            </label>
                            {item.description && (
                              <p className="text-gray-400 text-xs leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Controls compacts */}
                        <div className="flex-shrink-0">
                          {item.type === 'display' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300 font-medium text-sm">{item.value}</span>
                              {item.badge && (
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                  item.badge === 'admin' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                  item.badge === 'vip' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                  item.badge === 'boost' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                  'bg-gray-700/30 text-gray-400 border border-gray-600/30'
                                }`}>
                                  {item.badge === 'admin' ? '👑 ADMIN' : 
                                   item.badge === 'vip' ? '⭐ VIP' : 
                                   item.badge === 'boost' ? '🚀 BOOST' : 'GRATUIT'}
                                </span>
                              )}
                            </div>
                          ) : item.type === 'button' ? (
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={item.onClick}
                                disabled={item.disabled}
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                                  item.disabled 
                                    ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700/30' 
                                    : 'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30 border border-cyan-400/20'
                                }`}
                              >
                                <item.icon className={item.loading ? 'animate-spin' : ''} />
                                <span className="text-xs font-semibold">
                                  {item.buttonText || (item.loading ? 'Sync...' : 'Sync')}
                                </span>
                              </button>
                              
                              {syncMessage && (
                                <div className={`px-2 py-1 rounded-md text-xs font-medium border ${
                                  syncMessage.type === 'success' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : syncMessage.type === 'error'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                }`}>
                                  {syncMessage.text}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => item.onChange(!item.value)}
                              disabled={item.disabled}
                              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                                item.value 
                                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30' 
                                  : 'bg-gray-700/50 border border-gray-600/50'
                              } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                            >
                              <div
                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                                  item.value ? 'left-6' : 'left-0.5'
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Stats card (VIP/Admin) - Optimisée pour l'espace */}
            {(currentUser?.isVip || currentUser?.isAdmin) && (
              <div className="group relative bg-[#1a1a24] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden
                            hover:bg-[#1e1e28] hover:border-white/15 transition-all duration-300 lg:col-span-2">
                
                <div className="absolute -inset-px bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500" />
                
                <div className="relative px-5 py-4 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
                        <IconChart />
                      </div>
                      <h2 className="text-lg font-semibold text-white">Statistiques Gaming</h2>
                    </div>
                    <span className="px-2 py-1 rounded-md text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ⭐ VIP
                    </span>
                  </div>
                </div>
                
                <div className="relative p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Temps de jeu', value: gameStats.totalPlayTime },
                      { label: 'Jeux utilisés', value: gameStats.gamesUsed.toString() },
                      { label: 'Jeux installés', value: gameStats.gamesInstalled.toString() }
                    ].map((stat, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[#16161f] border border-white/10 hover:bg-[#1a1a24] hover:border-white/15 transition-all duration-200 text-center">
                        <div className="text-xl font-bold text-white mb-1">{stat.value}</div>
                        <div className="text-xs text-gray-400">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de connexion Discord */}
      <DiscordLoginModal
        isOpen={showDiscordLoginModal}
        onClose={() => setShowDiscordLoginModal(false)}
        onLogin={handleDiscordLogin}
        onUserUpdate={onUserUpdate}
      />
    </div>
  )
}
