import { useState, useEffect, useRef } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiSend, FiMessageCircle, FiWifi, FiWifiOff, FiLoader, FiCheck, FiAlertCircle, FiClock, FiUser, FiHelpCircle, FiLink, FiUsers, FiFileText } from 'react-icons/fi'
import { authService } from '../services/auth'

// Catégories de tickets disponibles (4 catégories)
const TICKET_CATEGORIES = [
  { id: 'support', name: 'Support', icon: FiHelpCircle, description: 'Besoin d\'aide ? Notre équipe est là pour vous !' },
  { id: 'link_problem', name: 'Problème de liens', icon: FiLink, description: 'Signaler un problème avec les liens' },
  { id: 'partnership', name: 'Partenariat', icon: FiUsers, description: 'Demande de partenariat ou collaboration' },
  { id: 'application', name: 'Candidature', icon: FiFileText, description: 'Postuler pour rejoindre notre équipe' }
]

export function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const hasConnectedRef = useRef(false)
  const currentUser = authService.getCurrentUser()
  const staffAvatarFallback = 'https://cdn.discordapp.com/embed/avatars/0.png'

  // Scroll vers le bas quand de nouveaux messages arrivent
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const connectWebSocket = async () => {
    // Éviter les appels multiples
    if (isConnecting || isConnected) {
      console.log('[Support] Connexion déjà en cours ou déjà connecté')
      return
    }

    try {
      setIsConnecting(true)
      setError('')
      
      if (window.electron && window.electron.websocket) {
        // Vérifier d'abord si déjà connecté
        const isAlreadyConnected = await window.electron.websocket.isConnected()
        if (isAlreadyConnected) {
          setIsConnected(true)
          setIsConnecting(false)
          return
        }

        const result = await window.electron.websocket.connect()
        if (!result.success) {
          setError(result.error || 'Erreur de connexion')
          setIsConnecting(false)
        }
        // Note: isConnected sera mis à true via handleConnected
      } else {
        setError('Les fonctions WebSocket ne sont pas disponibles')
        setIsConnecting(false)
      }
    } catch (err) {
      console.error('[Support] Erreur de connexion:', err)
      setError(err.message || 'Erreur de connexion')
      setIsConnecting(false)
    }
  }

  // Connexion WebSocket au montage (une seule fois)
  useEffect(() => {
    // Ne connecter qu'une seule fois
    if (hasConnectedRef.current) {
      return
    }

    // Vérifier si déjà connecté avant de tenter une connexion
    const checkAndConnect = async () => {
      if (window.electron && window.electron.websocket) {
        const isConnected = await window.electron.websocket.isConnected()
        if (!isConnected) {
          hasConnectedRef.current = true
          connectWebSocket()
        } else {
          setIsConnected(true)
          setIsConnecting(false)
        }
      }
    }

    checkAndConnect()

    // Écouter les événements WebSocket
    if (window.electron && window.electron.ipcRenderer) {
      const handleMessage = (event, message) => {
        console.log('[Support] Message reçu:', message)
        
        if (message.type === 'discord_message') {
          // Filtrer les messages pour n'afficher que ceux du ticket de l'utilisateur actuel
          const expectedChannelName = currentUser ? `ticket-${currentUser.id}` : null
          
          if (expectedChannelName && message.channel === expectedChannelName) {
            // Ne pas afficher les messages de l'utilisateur lui-même (déjà affichés localement)
            if (message.authorId !== currentUser.id) {
              setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'staff',
                author: message.author,
                avatar: message.avatar || staffAvatarFallback,
                content: message.content,
                embeds: message.embeds || [],
                timestamp: message.timestamp || Date.now()
              }])
            }
          }
        } else if (message.type === 'welcome') {
          setSuccess('Connexion établie avec le serveur')
          setTimeout(() => setSuccess(''), 3000)
        }
      }

      const handleConnected = () => {
        setIsConnected(true)
        setIsConnecting(false)
        setError('')
        console.log('[Support] WebSocket connecté')
      }

      const handleDisconnected = () => {
        setIsConnected(false)
        console.log('[Support] WebSocket déconnecté')
      }

      const handleError = (event, errorMessage) => {
        setError(errorMessage)
        setIsConnecting(false)
        console.error('[Support] Erreur WebSocket:', errorMessage)
      }

      window.electron.ipcRenderer.on('websocket:message', handleMessage)
      window.electron.ipcRenderer.on('websocket:connected', handleConnected)
      window.electron.ipcRenderer.on('websocket:disconnected', handleDisconnected)
      window.electron.ipcRenderer.on('websocket:error', handleError)

      return () => {
        window.electron.ipcRenderer.removeAllListeners('websocket:message')
        window.electron.ipcRenderer.removeAllListeners('websocket:connected')
        window.electron.ipcRenderer.removeAllListeners('websocket:disconnected')
        window.electron.ipcRenderer.removeAllListeners('websocket:error')
        // Ne pas déconnecter le WebSocket si l'utilisateur change, seulement au démontage
      }
    }
  }, []) // Supprimer currentUser des dépendances pour éviter les reconnexions multiples

  const disconnectWebSocket = async () => {
    try {
      if (window.electron && window.electron.websocket) {
        await window.electron.websocket.disconnect()
        setIsConnected(false)
      }
    } catch (err) {
      console.error('[Support] Erreur de déconnexion:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return

    if (!currentUser || !currentUser.id) {
      setError('Vous devez être connecté avec Discord pour envoyer un message')
      return
    }

    if (!selectedCategory) {
      setError('Veuillez sélectionner une catégorie de ticket')
      return
    }

    try {
      setSending(true)
      setError('')
      setSuccess('')

      // Envoyer le message via l'API
      if (window.electron && window.electron.support) {
        const result = await window.electron.support.createTicket({
          discord_id: currentUser.id,
          username: currentUser.username || 'Utilisateur',
          message: inputMessage.trim(),
          category: selectedCategory
        })

        if (result.success) {
          // Ajouter le message à la liste locale
          setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'user',
            author: currentUser.username || 'Vous',
            avatar: currentUser.avatar || staffAvatarFallback,
            content: inputMessage.trim(),
            timestamp: Date.now()
          }])

          setInputMessage('')
          setSuccess('Message envoyé avec succès !')
          setTimeout(() => setSuccess(''), 3000)
        } else {
          setError(result.error || 'Erreur lors de l\'envoi du message')
        }
      } else {
        setError('Les fonctions de support ne sont pas disponibles')
      }
    } catch (err) {
      console.error('[Support] Erreur lors de l\'envoi:', err)
      setError(err.message || 'Erreur lors de l\'envoi du message')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* En-tête avec design amélioré */}
      <Motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-purple-500/10 border border-primary/30 shadow-lg shadow-primary/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl opacity-50 blur-xl" />
              <FiMessageCircle className="text-3xl text-primary relative z-10" />
            </Motion.div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                Support Client
              </h1>
              <p className="text-sm text-muted flex items-center gap-2">
                <FiClock className="text-xs" />
                Temps de réponse moyen : &lt; 5 minutes
              </p>
            </div>
          </div>
          
          {/* Statut de connexion amélioré */}
          <Motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3"
          >
            {isConnecting ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <FiLoader className="animate-spin text-yellow-400" />
                <span className="text-sm text-yellow-400 font-medium">Connexion...</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <FiWifi className="text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">En ligne</span>
              </div>
            ) : (
              <Motion.button
                onClick={connectWebSocket}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <FiWifiOff className="text-red-400" />
                <span className="text-sm text-red-400 font-medium">Hors ligne</span>
              </Motion.button>
            )}
          </Motion.div>
        </div>
      </Motion.div>

      {/* Messages d'erreur/succès avec animation améliorée */}
      {(error || success) && (
        <Motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className={`relative z-10 flex items-center gap-3 rounded-xl px-4 py-3 mb-4 backdrop-blur-sm ${
            error
              ? 'bg-red-500/10 border border-red-500/30 shadow-lg shadow-red-500/10'
              : 'bg-emerald-500/10 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
          }`}
        >
          {error ? (
            <>
              <div className="p-2 rounded-lg bg-red-500/20">
                <FiAlertCircle className="text-red-400 text-lg" />
              </div>
              <p className="text-sm text-red-400 font-medium flex-1">{error}</p>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <FiCheck className="text-emerald-400 text-lg" />
              </div>
              <p className="text-sm text-emerald-400 font-medium flex-1">{success}</p>
            </>
          )}
        </Motion.div>
      )}

      {/* Affichage des catégories ou du chat selon la sélection */}
      {!selectedCategory ? (
        // Vue de sélection de catégorie
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 flex-1 min-h-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TICKET_CATEGORIES.map((category) => {
              const Icon = category.icon
              return (
                <Motion.button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-start gap-4 p-6 rounded-2xl border border-border/50 bg-surface-muted/30 hover:bg-surface-muted/50 hover:border-primary/30 transition-all text-left group backdrop-blur-sm"
                >
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 group-hover:border-primary/40 transition-colors">
                    <Icon className="text-2xl text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
                    <p className="text-sm text-muted">{category.description}</p>
                  </div>
                </Motion.button>
              )
            })}
          </div>
        </Motion.div>
      ) : (
        // Zone de chat principale avec design moderne
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 flex-1 min-h-0 flex flex-col rounded-3xl border border-border/50 bg-gradient-to-br from-surface-muted/40 via-surface-muted/30 to-surface-muted/20 backdrop-blur-sm shadow-2xl overflow-hidden"
        >
          {/* Header du chat */}
          <div className="px-6 py-4 border-b border-border/50 bg-gradient-to-r from-surface-muted/50 to-transparent backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser && (
                  <>
                    <div className="w-10 h-10 rounded-full border-2 border-primary/30 overflow-hidden bg-surface shadow-lg">
                      <img
                        src={currentUser.avatar || staffAvatarFallback}
                        alt={currentUser.username}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.src = staffAvatarFallback }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <FiUser className="text-xs" />
                        {currentUser.username || 'Utilisateur'}
                      </p>
                      <p className="text-xs text-muted">
                        {TICKET_CATEGORIES.find(cat => cat.id === selectedCategory)?.name || 'Support'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <Motion.button
                onClick={() => {
                  setSelectedCategory(null)
                  setMessages([])
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-sm text-muted hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-surface-muted/50"
              >
                ← Retour
              </Motion.button>
            </div>
          </div>

        {/* Liste des messages avec design amélioré */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <Motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-12"
            >
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/30">
                  <FiMessageCircle className="text-5xl text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Aucun message</h3>
              <p className="text-sm text-muted max-w-md">
                Commencez la conversation en envoyant votre premier message. Notre équipe vous répondra rapidement !
              </p>
            </Motion.div>
          ) : (
            messages.map((message, index) => (
              <Motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`flex gap-4 ${message.type === 'user' ? 'justify-end flex-row-reverse' : 'justify-start'}`}
              >
                <Motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-12 h-12 rounded-full border-2 border-border/40 overflow-hidden bg-surface shadow-lg flex-shrink-0"
                >
                  <img
                    src={message.avatar || (message.type === 'user' ? currentUser?.avatar : staffAvatarFallback)}
                    alt={message.author}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = staffAvatarFallback }}
                  />
                </Motion.div>
                <div className="flex flex-col gap-2 max-w-[75%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      {message.type === 'user' ? 'Vous' : message.author}
                    </span>
                    {message.type !== 'user' && (
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                        Support
                      </span>
                    )}
                    <span className="text-xs text-muted flex items-center gap-1">
                      <FiClock className="text-[10px]" />
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  <Motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`rounded-2xl px-5 py-4 shadow-lg backdrop-blur-sm ${
                      message.type === 'user'
                        ? 'bg-gradient-to-br from-primary/40 via-primary/30 to-primary/20 border border-primary/50 text-white'
                        : 'bg-surface-muted/70 border border-border/50 text-white backdrop-blur-sm'
                    }`}
                  >
                    {message.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.embeds && message.embeds.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {message.embeds.map((embed, idx) => (
                          <div
                            key={`${message.id}-embed-${idx}`}
                            className="rounded-xl border border-primary/30 bg-primary/10 p-4 backdrop-blur-sm"
                          >
                            {embed.title && (
                              <p className="text-sm font-semibold text-primary mb-2">{embed.title}</p>
                            )}
                            {embed.description && (
                              <p className="text-sm text-muted whitespace-pre-wrap">{embed.description}</p>
                            )}
                            {embed.fields && embed.fields.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {embed.fields.map((field, fieldIdx) => (
                                  <div key={fieldIdx} className="rounded-lg bg-black/20 px-3 py-2">
                                    {field.name && (
                                      <p className="text-xs font-semibold text-muted mb-1">{field.name}</p>
                                    )}
                                    <p className="text-sm">{field.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {embed.footer && (
                              <p className="text-[11px] text-muted mt-3 italic">{embed.footer}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Motion.div>
                </div>
              </Motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Zone de saisie améliorée */}
        <div className="border-t border-border/50 p-5 bg-gradient-to-r from-surface-muted/60 via-surface-muted/50 to-surface-muted/60 backdrop-blur-sm">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Tapez votre message... (Appuyez sur Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"
                rows={3}
                className="w-full rounded-2xl border border-border/50 bg-surface-muted/80 backdrop-blur-sm px-5 py-4 text-sm text-white placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
              />
            </div>
            <Motion.button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || sending || !isConnected}
              whileHover={(!inputMessage.trim() || sending || !isConnected) ? {} : { scale: 1.05 }}
              whileTap={(!inputMessage.trim() || sending || !isConnected) ? {} : { scale: 0.95 }}
              className={`relative px-6 py-4 rounded-2xl font-medium transition-all ${
                (!inputMessage.trim() || sending || !isConnected)
                  ? 'opacity-50 cursor-not-allowed bg-surface-muted/50'
                  : 'bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white shadow-lg shadow-primary/30'
              }`}
            >
              {sending ? (
                <FiLoader className="animate-spin text-xl" />
              ) : (
                <div className="flex items-center gap-2">
                  <FiSend className="text-lg" />
                  <span>Envoyer</span>
                </div>
              )}
            </Motion.button>
          </div>
          {!isConnected && (
            <p className="text-xs text-muted mt-3 text-center flex items-center justify-center gap-2">
              <FiWifiOff className="text-xs" />
              Connectez-vous pour envoyer des messages
            </p>
          )}
        </div>
      </Motion.div>
      )}
    </div>
  )
}

