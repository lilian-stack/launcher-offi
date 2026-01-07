import { useState, useCallback, useEffect } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { fetchWithBackendCheck } from '../utils/backend'
import { 
  FiSend, 
  FiCheck, 
  FiX, 
  FiPackage, 
  FiUser, 
  FiFileText, 
  FiLink, 
  FiLoader, 
  FiWifi, 
  FiWifiOff, 
  FiStar,
  FiInfo,
  FiArrowRight,
  FiTrendingUp,
  FiLock
} from 'react-icons/fi'

export function GameSuggestion({ currentUser }) {
  const [formData, setFormData] = useState({
    gameName: '',
    username: currentUser?.username || '',
    description: '',
    gameUrl: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [botStatus, setBotStatus] = useState(null)
  const [focusedField, setFocusedField] = useState(null)
  
  // Vérifier l'état du bot au chargement et périodiquement
  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const response = await fetchWithBackendCheck('/api/discord/bot-status')
        if (response.ok) {
          const status = await response.json()
          setBotStatus(status)
        }
      } catch (error) {
        console.error('[GameSuggestion] Erreur lors de la vérification du bot:', error)
        setBotStatus({ available: false, ready: false, status: 'error' })
      }
    }
    
    // Attendre un peu avant la première vérification pour laisser le backend démarrer
    setTimeout(() => {
    checkBotStatus()
    }, 2000)
    
    const interval = setInterval(checkBotStatus, 10000)
    
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formData.gameName.trim() || !formData.username.trim() || !formData.description.trim()) {
      setSubmitStatus('error')
      setErrorMessage('Veuillez remplir tous les champs obligatoires.')
      setTimeout(() => {
        setSubmitStatus(null)
        setErrorMessage(null)
      }, 5000)
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)
    setErrorMessage(null)

    try {
      if (window.electron?.support?.submitGameSuggestion) {
        const result = await window.electron.support.submitGameSuggestion({
          gameName: formData.gameName.trim(),
          username: formData.username.trim(),
          description: formData.description.trim(),
          gameUrl: formData.gameUrl.trim() || null,
          userId: currentUser?.id || null,
          timestamp: new Date().toISOString()
        })

        if (result?.success) {
          setSubmitStatus('success')
          setErrorMessage(null)
          setFormData({
            gameName: '',
            username: currentUser?.username || '',
            description: '',
            gameUrl: ''
          })
          setTimeout(() => setSubmitStatus(null), 5000)
        } else {
          setSubmitStatus('error')
          const serverError = result?.error || 'Erreur lors de l\'envoi de la suggestion'
          setErrorMessage(serverError)
          
          if (serverError.includes('Bot Discord') || serverError.includes('non disponible') || serverError.includes('non prêt')) {
            setErrorMessage('Le bot Discord n\'est pas disponible. Veuillez redémarrer le serveur backend et réessayer.')
          }
          
          setTimeout(() => {
            setSubmitStatus(null)
            setErrorMessage(null)
          }, 8000)
        }
      } else {
        if (window.electron?.websocket?.send) {
          await window.electron.websocket.send({
            type: 'game-suggestion',
            data: {
              gameName: formData.gameName.trim(),
              username: formData.username.trim(),
              description: formData.description.trim(),
              gameUrl: formData.gameUrl.trim() || null,
              userId: currentUser?.id || null,
              timestamp: new Date().toISOString()
            }
          })
          setSubmitStatus('success')
          setFormData({
            gameName: '',
            username: currentUser?.username || '',
            description: '',
            gameUrl: ''
          })
          setTimeout(() => setSubmitStatus(null), 5000)
        } else {
          throw new Error('Service de suggestion non disponible')
        }
      }
    } catch (error) {
      console.error('[GameSuggestion] Erreur lors de l\'envoi:', error)
      setSubmitStatus('error')
      const errorMsg = error?.message || error?.toString() || 'Erreur inconnue lors de l\'envoi'
      setErrorMessage(errorMsg)
      
      if (errorMsg.includes('Bot Discord') || errorMsg.includes('non disponible') || errorMsg.includes('non prêt')) {
        setErrorMessage('Le bot Discord n\'est pas disponible. Veuillez redémarrer le serveur backend et réessayer.')
      }
      
      setTimeout(() => {
        setSubmitStatus(null)
        setErrorMessage(null)
      }, 8000)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, currentUser])

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit()
    }
  }, [handleSubmit])

  const isFormValid = formData.gameName.trim() && formData.username.trim() && formData.description.trim()
  const isGuest = currentUser?.isGuest === true

  return (
    <div className="space-y-6 relative">
      {/* Overlay pour les invités */}
      {isGuest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            margin: 0,
            padding: 0
          }}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-[#1a1a20] rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-amber-500/30 overflow-hidden"
            style={{ margin: '1rem' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/30 p-6 text-white relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <FiLock className="text-2xl text-amber-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Accès restreint</h2>
                  <p className="text-amber-300/80 text-sm mt-1">Connexion requise</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <FiUser className="text-amber-400 flex-shrink-0 mt-0.5 text-xl" />
                <div className="text-sm text-amber-300">
                  <p className="font-semibold mb-2">Vous devez vous connecter via Discord</p>
                  <p className="text-amber-200/90">
                    Pour suggérer des jeux et interagir avec la communauté, vous devez vous connecter avec votre compte Discord.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-sm text-gray-400 text-center mb-4">
                  Vous pouvez consulter le formulaire ci-dessous, mais l'accès complet nécessite une connexion.
                </p>
              </div>
            </div>
          </Motion.div>
        </div>
      )}
      {/* Hero Section */}
      <Motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] rounded-xl blur-xl opacity-40 animate-pulse" />
              <Motion.div
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative p-3 bg-gradient-to-br from-[#06b6d4]/30 to-[#3b82f6]/30 rounded-xl border border-[#06b6d4]/40 backdrop-blur-sm"
              >
                <FiStar className="text-2xl text-[#06b6d4]" />
              </Motion.div>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-1 bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent">
                Suggérer un Jeu
              </h2>
              <p className="text-gray-400 text-sm">Partagez vos jeux favoris avec la communauté</p>
            </div>
          </div>
          
          {/* Statut du bot avec animation */}
          {botStatus && (
            <Motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                botStatus.ready 
                  ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/40 shadow-lg shadow-green-500/20' 
                  : 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/40 shadow-lg shadow-yellow-500/20'
              }`}
            >
              {botStatus.ready ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-400 rounded-full blur-md opacity-50 animate-pulse" />
                    <FiWifi className="relative text-green-400 text-base" />
                  </div>
                  <div>
                    <p className="text-green-400 font-bold text-xs">Bot connecté</p>
                    <p className="text-green-300/70 text-[10px]">Prêt à recevoir</p>
                  </div>
                </>
              ) : (
                <>
                  <FiWifiOff className="text-yellow-400 text-base" />
                  <div>
                    <p className="text-yellow-400 font-bold text-xs">
                      {botStatus.status === 'connecting' ? 'Connexion...' : 'Bot non disponible'}
                    </p>
                    <p className="text-yellow-300/70 text-[10px]">Vérification...</p>
                  </div>
                </>
              )}
            </Motion.div>
          )}
        </div>
      </Motion.div>

      {/* Formulaire principal */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative"
        style={{ pointerEvents: isGuest ? 'none' : 'auto', opacity: isGuest ? 0.6 : 1 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#06b6d4]/10 via-[#3b82f6]/5 to-transparent rounded-2xl blur-3xl" />
        <div className="relative bg-gradient-to-br from-[#1a1a20] via-[#1a1a20] to-[#0f0f14] rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
          
          {/* Nom du jeu */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[#06b6d4] font-semibold text-sm">
              <div className="p-1.5 bg-[#06b6d4]/20 rounded-lg border border-[#06b6d4]/30">
                <FiPackage className="w-4 h-4" />
              </div>
              Nom du Jeu <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.gameName}
                onChange={(e) => setFormData({...formData, gameName: e.target.value})}
                onFocus={() => setFocusedField('gameName')}
                onBlur={() => setFocusedField(null)}
                placeholder="Ex: Minecraft, Valorant, Among Us..."
                className={`w-full px-4 py-3 bg-[#0f0f14] border rounded-lg text-white placeholder-gray-500 transition-all text-sm font-medium ${
                  focusedField === 'gameName'
                    ? 'border-[#06b6d4] ring-2 ring-[#06b6d4]/20 shadow-lg shadow-[#06b6d4]/20'
                    : 'border-white/10 hover:border-[#06b6d4]/30'
                } disabled:opacity-50`}
                disabled={isSubmitting || isGuest}
              />
            </div>
          </div>

          {/* Pseudo */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[#06b6d4] font-semibold text-sm">
              <div className="p-1.5 bg-[#06b6d4]/20 rounded-lg border border-[#06b6d4]/30">
                <FiUser className="w-4 h-4" />
              </div>
              Votre Pseudo <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                placeholder="Votre nom d'utilisateur"
                className={`w-full px-4 py-3 bg-[#0f0f14] border rounded-lg text-white placeholder-gray-500 transition-all text-sm font-medium ${
                  focusedField === 'username'
                    ? 'border-[#06b6d4] ring-2 ring-[#06b6d4]/20 shadow-lg shadow-[#06b6d4]/20'
                    : 'border-white/10 hover:border-[#06b6d4]/30'
                } disabled:opacity-50`}
                disabled={isSubmitting || isGuest}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[#06b6d4] font-semibold text-sm">
              <div className="p-1.5 bg-[#06b6d4]/20 rounded-lg border border-[#06b6d4]/30">
                <FiFileText className="w-4 h-4" />
              </div>
              Description <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                onFocus={() => setFocusedField('description')}
                onBlur={() => setFocusedField(null)}
                placeholder="Pourquoi ce jeu serait génial pour la communauté ? Décrivez ses points forts, son gameplay..."
                rows="5"
                className={`w-full px-4 py-3 bg-[#0f0f14] border rounded-lg text-white placeholder-gray-500 transition-all resize-none text-sm font-medium ${
                  focusedField === 'description'
                    ? 'border-[#06b6d4] ring-2 ring-[#06b6d4]/20 shadow-lg shadow-[#06b6d4]/20'
                    : 'border-white/10 hover:border-[#06b6d4]/30'
                } disabled:opacity-50`}
                disabled={isSubmitting || isGuest}
                onKeyPress={handleKeyPress}
              />
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
                <kbd className="px-1.5 py-0.5 bg-[#1a1a20] border border-white/10 rounded font-mono text-[10px]">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 bg-[#1a1a20] border border-white/10 rounded font-mono text-[10px]">Entrée</kbd>
                <span>pour envoyer</span>
              </div>
            </div>
          </div>

          {/* Lien (optionnel) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[#06b6d4] font-semibold text-sm">
              <div className="p-1.5 bg-[#06b6d4]/20 rounded-lg border border-[#06b6d4]/30">
                <FiLink className="w-4 h-4" />
              </div>
              Lien du Jeu <span className="text-gray-500 text-xs font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <input
                type="url"
                value={formData.gameUrl}
                onChange={(e) => setFormData({...formData, gameUrl: e.target.value})}
                onFocus={() => setFocusedField('gameUrl')}
                onBlur={() => setFocusedField(null)}
                placeholder="https://store.steampowered.com/app/..."
                className={`w-full px-4 py-3 bg-[#0f0f14] border rounded-lg text-white placeholder-gray-500 transition-all text-sm font-medium ${
                  focusedField === 'gameUrl'
                    ? 'border-[#06b6d4] ring-2 ring-[#06b6d4]/20 shadow-lg shadow-[#06b6d4]/20'
                    : 'border-white/10 hover:border-[#06b6d4]/30'
                } disabled:opacity-50`}
                disabled={isSubmitting || isGuest}
              />
            </div>
          </div>

          {/* Bouton d'envoi */}
          <Motion.button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting || isGuest}
            whileHover={isFormValid && !isSubmitting && !isGuest ? { scale: 1.01, y: -1 } : {}}
            whileTap={isFormValid && !isSubmitting && !isGuest ? { scale: 0.99 } : {}}
            className={`w-full relative overflow-hidden rounded-lg py-3.5 font-semibold text-sm transition-all ${
              isFormValid && !isSubmitting
                ? 'bg-gradient-to-r from-[#06b6d4] via-[#3b82f6] to-[#06b6d4] text-white shadow-lg shadow-[#06b6d4]/30 hover:shadow-[#06b6d4]/50'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isFormValid && !isSubmitting && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            )}
            <div className="relative flex items-center justify-center gap-2">
              {isSubmitting ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <FiSend className="w-4 h-4" />
                  <span>Envoyer vers Discord</span>
                  <FiArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </div>
          </Motion.button>

          {/* Notifications de statut */}
          <AnimatePresence>
            {submitStatus === 'success' && (
              <Motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border border-green-500/40 rounded-lg shadow-lg"
              >
                <div className="p-2 bg-green-500/30 rounded-lg border border-green-500/50 flex-shrink-0">
                  <FiCheck className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-green-400 font-bold text-base mb-1">Suggestion envoyée avec succès !</p>
                  <p className="text-green-300 text-sm mb-3">Votre suggestion a été transmise aux administrateurs sur Discord.</p>
                  <a
                    href="https://discord.com/channels/1332072935682478202/1407780886497464471"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 rounded-lg text-green-400 hover:text-green-300 font-medium text-xs transition-all"
                  >
                    <FiLink className="w-3 h-3" />
                    Voir sur Discord
                  </a>
                </div>
              </Motion.div>
            )}

            {submitStatus === 'error' && (
              <Motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="flex items-start gap-3 p-4 bg-gradient-to-r from-red-500/20 via-rose-500/20 to-red-500/20 border border-red-500/40 rounded-lg shadow-lg"
              >
                <div className="p-2 bg-red-500/30 rounded-lg border border-red-500/50 flex-shrink-0">
                  <FiX className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-red-400 font-bold text-base mb-1">Erreur lors de l'envoi</p>
                  <p className="text-red-300 text-sm mb-2">
                    {errorMessage || 'Une erreur est survenue lors de l\'envoi de votre suggestion. Veuillez réessayer.'}
                  </p>
                  {(errorMessage && errorMessage.includes('Bot Discord')) && (
                    <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                      <p className="text-xs text-red-300 font-semibold mb-1">💡 Solution :</p>
                      <p className="text-xs text-red-300">
                        Le bot Discord doit être connecté. Vérifiez que le serveur backend est démarré et que le token Discord est correct.
                      </p>
                    </div>
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </Motion.div>

      {/* Guide étape par étape */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="bg-gradient-to-br from-[#1a1a20] to-[#0f0f14] rounded-2xl p-6 border border-[#06b6d4]/20 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#06b6d4]/20 rounded-lg border border-[#06b6d4]/30">
            <FiInfo className="w-4 h-4 text-[#06b6d4]" />
          </div>
          <h3 className="text-lg font-bold text-white">Comment ça marche ?</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { num: 1, text: 'Remplissez le formulaire avec les informations du jeu que vous souhaitez suggérer', icon: FiFileText },
            { num: 2, text: 'Votre suggestion sera envoyée dans le channel Discord dédié aux suggestions', icon: FiSend },
            { num: 3, text: 'Les administrateurs examineront votre suggestion et décideront de l\'ajouter au launcher', icon: FiTrendingUp }
          ].map((step, index) => (
            <Motion.div
              key={step.num}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="relative p-4 bg-[#0f0f14] rounded-lg border border-white/5 hover:border-[#06b6d4]/30 transition-all group"
            >
              <div className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] rounded-lg flex items-center justify-center text-white font-extrabold text-sm shadow-lg border border-white/20">
                {step.num}
              </div>
              <div className="mt-3 mb-3">
                <step.icon className="w-5 h-5 text-[#06b6d4] group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-gray-300 text-xs leading-relaxed">{step.text}</p>
            </Motion.div>
          ))}
        </div>
      </Motion.div>
    </div>
  )
}