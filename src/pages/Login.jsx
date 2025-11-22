import { useState, useEffect } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiUser, FiMail, FiLock, FiLogIn, FiUserPlus } from 'react-icons/fi'
import { FaDiscord } from 'react-icons/fa'

export function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [discordLoading, setDiscordLoading] = useState(false)
  const [error, setError] = useState('')

  // Gérer le callback Discord OAuth2 via IPC
  useEffect(() => {
    if (!window.electron || !window.electron.ipcRenderer) {
      return
    }

    const handleAuthCode = async (event, { code }) => {
      console.log('[Login] Discord auth code received:', code ? 'present' : 'missing')
      setDiscordLoading(true)
      setError('')

      try {
        if (!code) {
          throw new Error('Code d\'autorisation manquant')
        }

        if (!window.electron.discord) {
          throw new Error('Les fonctions Discord ne sont pas disponibles')
        }

        console.log('[Login] Authenticating with Discord...')
        const result = await window.electron.discord.authenticate(code)
        console.log('[Login] Discord authentication result:', result.success ? 'success' : 'failed')
        
        if (result.success && result.user && onLogin) {
          console.log('[Login] Logging in user:', result.user.username)
          onLogin(result.user)
        } else {
          throw new Error(result.error || 'Erreur lors de l\'authentification Discord')
        }
      } catch (err) {
        console.error('[Login] Erreur d\'authentification Discord:', err)
        setError(err.message || 'Une erreur est survenue lors de la connexion Discord')
      } finally {
        setDiscordLoading(false)
      }
    }

    const handleAuthError = (event, { error }) => {
      setDiscordLoading(false)
      setError('Erreur lors de l\'autorisation Discord: ' + error)
    }

    // Écouter les événements IPC Discord
    window.electron.ipcRenderer.on('discord:auth-code', handleAuthCode)
    window.electron.ipcRenderer.on('discord:auth-error', handleAuthError)

    // Nettoyer les listeners au démontage
    return () => {
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('discord:auth-code')
        window.electron.ipcRenderer.removeAllListeners('discord:auth-error')
      }
    }
  }, [onLogin])

  const handleDiscordLogin = async () => {
    setError('')
    setDiscordLoading(true)

    try {
      if (!window.electron || !window.electron.discord) {
        throw new Error('L\'application Electron n\'est pas disponible. Veuillez redémarrer l\'application.')
      }

      const authUrlResult = await window.electron.discord.getAuthUrl()
      // S'assurer que authUrl est une chaîne (au cas où getAuthUrl retourne un objet)
      const authUrl = typeof authUrlResult === 'string' ? authUrlResult : (authUrlResult?.url || String(authUrlResult))
      
      if (!authUrl || typeof authUrl !== 'string') {
        throw new Error('URL d\'authentification Discord invalide')
      }
      
      // Ouvrir l'URL Discord dans le navigateur externe
      if (window.electron.isElectron && window.electron.discord.openAuthUrl) {
        await window.electron.discord.openAuthUrl(authUrl)
      } else {
        // En développement web, ouvrir dans une nouvelle fenêtre
        window.open(authUrl, 'Discord Auth', 'width=600,height=700')
      }
    } catch (err) {
      console.error('Erreur lors de l\'ouverture de Discord:', err)
      setError(err.message || 'Une erreur est survenue lors de l\'ouverture de Discord')
      setDiscordLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Vérifier que window.electron est disponible
      if (!window.electron) {
        throw new Error('L\'application Electron n\'est pas disponible. Veuillez redémarrer l\'application.')
      }

      if (!window.electron.github) {
        throw new Error('Les fonctions GitHub ne sont pas disponibles. Veuillez redémarrer l\'application.')
      }

      if (isLogin) {
        // Connexion
        if (!email || !password) {
          throw new Error('Veuillez remplir tous les champs')
        }

        console.log('Tentative de connexion avec:', { email })
        
        const user = await window.electron.github.loginUser(email, password)
        
        console.log('Utilisateur connecté:', user)
        
        if (user && onLogin) {
          onLogin(user)
        } else {
          throw new Error('Erreur lors de la connexion')
        }
      } else {
        // Inscription
        if (!email || !username || !password) {
          throw new Error('Veuillez remplir tous les champs')
        }

        if (password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères')
        }

        console.log('Tentative d\'inscription avec:', { email, username })
        
        const user = await window.electron.github.createUser({
          email,
          username,
          password,
        })

        console.log('Utilisateur créé:', user)

        if (user && onLogin) {
          onLogin(user)
        } else {
          throw new Error('Erreur lors de l\'inscription')
        }
      }
    } catch (err) {
      console.error('Erreur de connexion/inscription:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="surface-card rounded-2xl border border-border/50 p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-white">
              {isLogin ? 'Connexion' : 'Inscription'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {isLogin
                ? 'Connectez-vous à votre compte ACTORIS'
                : 'Créez votre compte ACTORIS'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted">
                  Nom d'utilisateur
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Votre nom d'utilisateur"
                    className="w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-2.5 pl-10 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">
                E-mail
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-2.5 pl-10 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">
                Mot de passe
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border/50 bg-surface-muted px-4 py-2.5 pl-10 text-sm text-white transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>

            {error && (
              <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3"
              >
                <p className="text-sm text-red-400">{error}</p>
              </Motion.div>
            )}

            <Motion.button
              type="submit"
              disabled={loading || discordLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className="button-primary w-full justify-center"
            >
              {loading ? (
                <span>Chargement...</span>
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? (
                    <>
                      <FiLogIn />
                      Se connecter
                    </>
                  ) : (
                    <>
                      <FiUserPlus />
                      S'inscrire
                    </>
                  )}
                </span>
              )}
            </Motion.button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/30"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted">Ou</span>
              </div>
            </div>

            <Motion.button
              type="button"
              onClick={handleDiscordLogin}
              disabled={loading || discordLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className="mt-6 w-full rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 text-sm font-medium text-white transition-all hover:border-indigo-500/50 hover:from-indigo-500/20 hover:to-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {discordLoading ? (
                <span>Connexion en cours...</span>
              ) : (
                <>
                  <FaDiscord className="text-lg" />
                  Se connecter avec Discord
                </>
              )}
            </Motion.button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setEmail('')
                setUsername('')
                setPassword('')
              }}
              className="text-sm text-muted hover:text-white transition-colors"
            >
              {isLogin
                ? "Pas encore de compte ? S'inscrire"
                : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </div>
      </Motion.div>
    </div>
  )
}

