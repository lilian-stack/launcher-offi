import { useState, useEffect, useCallback } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { FaDiscord } from 'react-icons/fa'
import { FiX } from 'react-icons/fi'
import { ActorisLogo } from '../components/ActorisLogo'

export function LoginPage({ onLogin }) {
  const [discordLoading, setDiscordLoading] = useState(false)
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  // Fonction pour traiter le code OAuth depuis l'URL
  const processAuthCode = useCallback(async (code) => {
    if (!code) return
    
    setDiscordLoading(true)
    setError('')

    try {
      // Attendre que window.electron soit disponible (jusqu'à 5 secondes)
      let attempts = 0
      const maxAttempts = 50 // 5 secondes (50 * 100ms)
      
      while (!window.electron?.discord && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (!window.electron?.discord) {
        console.error('[Login] window.electron.discord non disponible après', maxAttempts, 'tentatives')
        throw new Error('Les fonctions Discord ne sont pas disponibles. Veuillez redémarrer le launcher.')
      }

      console.log('[Login] Authentification avec le code OAuth...')
      const result = await window.electron.discord.authenticate(code)
      
      if (result.success && result.user && onLogin) {
        console.log('[Login] Authentification réussie!')
        onLogin(result.user)
        // Nettoyer l'URL après authentification réussie
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
      } else {
        throw new Error(result.error || 'Erreur lors de l\'authentification Discord')
      }
    } catch (err) {
      console.error('[Login] Erreur lors du traitement du code OAuth:', err)
      setError(err.message || 'Une erreur est survenue lors de la connexion Discord')
    } finally {
      setDiscordLoading(false)
    }
  }, [onLogin])

  // Vérifier si un code OAuth est présent dans l'URL au chargement
  useEffect(() => {
    const checkAndProcessCode = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const error = urlParams.get('error')

      if (error) {
        setError(`Erreur Discord: ${error}`)
        // Nettoyer l'URL
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
        return
      }

      if (code) {
        console.log('[Login] Code OAuth détecté dans l\'URL:', code.substring(0, 10) + '...')
        console.log('[Login] window.electron disponible?', typeof window.electron !== 'undefined')
        console.log('[Login] window.electron.discord disponible?', typeof window.electron?.discord !== 'undefined')
        
        // Si on est dans Electron, traiter le code directement
        if (window.electron?.isElectron) {
          // Attendre un peu pour que React soit complètement monté
          await new Promise(resolve => setTimeout(resolve, 200))
          await processAuthCode(code)
        } else {
          // Si on est dans le navigateur, afficher un message pour ouvrir le launcher
          setError('Veuillez ouvrir le launcher Electron pour compléter la connexion. Le code d\'autorisation a été copié dans le presse-papiers.')
          // Copier le code dans le presse-papiers si possible
          if (navigator.clipboard) {
            try {
              await navigator.clipboard.writeText(code)
              console.log('[Login] Code copié dans le presse-papiers')
            } catch (err) {
              console.error('[Login] Impossible de copier le code:', err)
            }
          }
        }
      }
    }

    checkAndProcessCode()
  }, [processAuthCode])

  // Gérer le callback Discord OAuth2 via IPC (optimisé)
  useEffect(() => {
    let mounted = true
    let cleanup = null

    const setupDiscordListeners = () => {
      if (!window.electron?.ipcRenderer) {
        return false
      }

      const handleAuthCode = async (event, { code }) => {
        if (!mounted) return
        setDiscordLoading(true)
        setError('')

        try {
          if (!code) {
            throw new Error('Code d\'autorisation manquant')
          }

          // Vérifier Discord une seule fois
          if (!window.electron.discord) {
            await new Promise(resolve => setTimeout(resolve, 50))
            if (!window.electron.discord) {
              throw new Error('Les fonctions Discord ne sont pas disponibles')
            }
          }

          const result = await window.electron.discord.authenticate(code)
          
          if (!mounted) return
          
          if (result.success && result.user && onLogin) {
            onLogin(result.user)
          } else {
            throw new Error(result.error || 'Erreur lors de l\'authentification Discord')
          }
        } catch (err) {
          if (!mounted) return
          setError(err.message || 'Une erreur est survenue lors de la connexion Discord')
        } finally {
          if (mounted) {
            setDiscordLoading(false)
          }
        }
      }

      const handleAuthError = (event, { error }) => {
        if (!mounted) return
        setDiscordLoading(false)
        setError('Erreur lors de l\'autorisation Discord: ' + error)
      }

      // Écouter les événements IPC Discord
      window.electron.ipcRenderer.on('discord:auth-code', handleAuthCode)
      window.electron.ipcRenderer.on('discord:auth-error', handleAuthError)
      
      // Retourner la fonction de nettoyage
      cleanup = () => {
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('discord:auth-code')
          window.electron.ipcRenderer.removeAllListeners('discord:auth-error')
        }
      }
      
      return true
    }

    // Essayer immédiatement
    if (setupDiscordListeners()) {
      return () => {
        mounted = false
        if (cleanup) cleanup()
      }
    }

    // Sinon, attendre que window.electron soit disponible (max 1 seconde, optimisé)
    let attempts = 0
    const maxAttempts = 10 // 1 seconde max (10 * 100ms)
    
    const checkInterval = setInterval(() => {
      attempts++
      if (setupDiscordListeners() || attempts >= maxAttempts) {
        clearInterval(checkInterval)
      }
    }, 100)

    // Nettoyer les listeners au démontage
    return () => {
      mounted = false
      clearInterval(checkInterval)
      if (cleanup) cleanup()
    }
  }, [onLogin])

  const handleDiscordLogin = async () => {
    setError('')
    setDiscordLoading(true)

    try {
      // Vérifier window.electron une seule fois (optimisé)
      if (!window.electron) {
        await new Promise(resolve => setTimeout(resolve, 50))
        if (!window.electron) {
          throw new Error('L\'application Electron n\'est pas disponible. Veuillez redémarrer l\'application.')
        }
      }

      // Attendre que Discord soit chargé (retry optimisé, max 5 tentatives)
      if (!window.electron.discord) {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 100))
          if (window.electron.discord) break
        }
      }

      if (!window.electron.discord) {
        throw new Error('Les fonctions Discord ne sont pas encore disponibles. Veuillez réessayer dans quelques instants.')
      }

      const authUrlResult = await window.electron.discord.getAuthUrl()
      const authUrl = typeof authUrlResult === 'string' ? authUrlResult : (authUrlResult?.url || String(authUrlResult))
      
      if (!authUrl || typeof authUrl !== 'string') {
        throw new Error('URL d\'authentification Discord invalide')
      }
      
      // Ouvrir l'URL Discord dans le navigateur externe
      if (window.electron.isElectron && window.electron.discord.openAuthUrl) {
        await window.electron.discord.openAuthUrl(authUrl)
      } else {
        window.open(authUrl, 'Discord Auth', 'width=600,height=700')
      }
    } catch (err) {
      setError(err.message || 'Une erreur est survenue lors de l\'ouverture de Discord')
      setDiscordLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center relative">
      {/* Fond minimaliste avec gradient subtil */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f]"></div>
      
      {/* Motif géométrique subtil */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(139,92,246,0.1)_50%,transparent_100%)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(0deg,transparent_0%,rgba(139,92,246,0.1)_50%,transparent_100%)]"></div>
      </div>

      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-lg px-8"
      >
        <div className="space-y-12">
          {/* Logo et branding */}
          <Motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center space-y-4"
          >
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/10 blur-3xl rounded-full"></div>
                <div className="relative">
                  <ActorisLogo className="w-16 h-16" />
                </div>
              </div>
            </div>
            
            <h1 className="text-5xl font-light tracking-tight text-white">
              ACTORIS
            </h1>
            
            <p className="text-muted text-base font-light tracking-wide">
              Connectez-vous pour accéder à votre bibliothèque
            </p>
          </Motion.div>

          {/* Carte de connexion */}
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="relative bg-surface/40 backdrop-blur-2xl border border-white/5 rounded-2xl p-8 shadow-2xl">
              {/* Bordure lumineuse subtile */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-50"></div>
              
              <div className="relative space-y-6">
                {/* Message d'erreur */}
                {error && (
                  <Motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3"
                  >
                    <p className="text-sm text-red-400 text-center">{error}</p>
                  </Motion.div>
                )}

                {/* Bouton Discord moderne */}
                <Motion.button
                  type="button"
                  onClick={handleDiscordLogin}
                  disabled={discordLoading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.2 }}
                  className="group relative w-full overflow-hidden rounded-xl bg-[#5865F2] px-6 py-4 text-white font-medium shadow-lg shadow-[#5865F2]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#5865F2]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Effet de brillance au survol */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                  
                  <span className="relative flex items-center justify-center gap-3">
                    {discordLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="text-base">Connexion...</span>
                      </>
                    ) : (
                      <>
                        <FaDiscord className="text-xl" />
                        <span className="text-base">Continuer avec Discord</span>
                      </>
                    )}
                  </span>
                </Motion.button>

                {/* Séparateur élégant */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-surface/40 px-4 text-xs text-muted/50 uppercase tracking-wider">
                      Sécurisé
                    </span>
                  </div>
                </div>

                {/* Informations légales minimalistes */}
                <p className="text-center text-xs text-muted/60 leading-relaxed">
                  En continuant, vous acceptez nos{' '}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setShowTerms(true)
                    }}
                    className="text-purple-400/80 hover:text-purple-400 transition-colors underline underline-offset-2"
                  >
                    conditions d'utilisation
                  </button>
                  {' '}et notre{' '}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      setShowPrivacy(true)
                    }}
                    className="text-purple-400/80 hover:text-purple-400 transition-colors underline underline-offset-2"
                  >
                    politique de confidentialité
                  </button>
                </p>
              </div>
            </div>
          </Motion.div>
        </div>
      </Motion.div>

      {/* Modal Conditions d'utilisation */}
      <AnimatePresence>
        {showTerms && (
          <Modal
            title="Conditions d'utilisation"
            onClose={() => setShowTerms(false)}
          >
            <div className="space-y-4 text-sm text-muted leading-relaxed">
              <section>
                <h3 className="text-white font-semibold mb-2">1. Acceptation des conditions</h3>
                <p>
                  En utilisant ACTORIS, vous acceptez d'être lié par ces conditions d'utilisation. 
                  Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre service.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">2. Utilisation du service</h3>
                <p>
                  ACTORIS est un launcher de jeux qui vous permet de télécharger et de gérer votre bibliothèque de jeux. 
                  Vous vous engagez à utiliser le service uniquement à des fins légales et conformément à ces conditions.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">3. Compte utilisateur</h3>
                <p>
                  Vous êtes responsable de maintenir la confidentialité de votre compte et de toutes les activités 
                  qui se produisent sous votre compte. Vous devez nous notifier immédiatement de toute utilisation 
                  non autorisée de votre compte.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">4. Contenu et propriété intellectuelle</h3>
                <p>
                  Tous les contenus disponibles sur ACTORIS, y compris mais sans s'y limiter, les textes, graphiques, 
                  logos, icônes, images, clips audio, téléchargements numériques, sont la propriété d'ACTORIS ou de 
                  ses fournisseurs de contenu et sont protégés par les lois sur le droit d'auteur.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">5. Limitations de responsabilité</h3>
                <p>
                  ACTORIS ne sera pas responsable des dommages directs, indirects, accessoires, spéciaux ou consécutifs 
                  résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">6. Modifications des conditions</h3>
                <p>
                  ACTORIS se réserve le droit de modifier ces conditions à tout moment. Les modifications entreront 
                  en vigueur dès leur publication. Votre utilisation continue du service après la publication des 
                  modifications constitue votre acceptation de ces modifications.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">7. Contact</h3>
                <p>
                  Pour toute question concernant ces conditions d'utilisation, veuillez nous contacter via notre 
                  serveur Discord ou notre site web.
                </p>
              </section>

              <p className="text-xs text-muted/50 pt-4 border-t border-white/5">
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal Politique de confidentialité */}
      <AnimatePresence>
        {showPrivacy && (
          <Modal
            title="Politique de confidentialité"
            onClose={() => setShowPrivacy(false)}
          >
            <div className="space-y-4 text-sm text-muted leading-relaxed">
              <section>
                <h3 className="text-white font-semibold mb-2">1. Collecte d'informations</h3>
                <p>
                  Lorsque vous vous connectez via Discord, nous collectons certaines informations de votre compte Discord, 
                  notamment votre nom d'utilisateur, votre email, votre avatar et vos rôles sur notre serveur Discord.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">2. Utilisation des informations</h3>
                <p>
                  Nous utilisons les informations collectées pour :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Fournir et améliorer nos services</li>
                  <li>Personnaliser votre expérience utilisateur</li>
                  <li>Gérer votre compte et vos préférences</li>
                  <li>Vous contacter concernant votre compte ou nos services</li>
                  <li>Respecter nos obligations légales</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">3. Partage des informations</h3>
                <p>
                  Nous ne vendons, n'échangeons ni ne louons vos informations personnelles à des tiers. Nous pouvons 
                  partager vos informations uniquement dans les cas suivants :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Avec votre consentement explicite</li>
                  <li>Pour se conformer à une obligation légale</li>
                  <li>Pour protéger nos droits et notre sécurité</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">4. Sécurité des données</h3>
                <p>
                  Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos informations personnelles 
                  contre l'accès non autorisé, la modification, la divulgation ou la destruction.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">5. Cookies et technologies similaires</h3>
                <p>
                  ACTORIS utilise des technologies de stockage local pour sauvegarder vos préférences et votre session. 
                  Ces données sont stockées localement sur votre appareil et ne sont pas partagées avec des tiers.
                </p>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">6. Vos droits</h3>
                <p>
                  Vous avez le droit de :
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Accéder à vos informations personnelles</li>
                  <li>Demander la correction de vos données</li>
                  <li>Demander la suppression de vos données</li>
                  <li>Vous opposer au traitement de vos données</li>
                </ul>
              </section>

              <section>
                <h3 className="text-white font-semibold mb-2">7. Modifications de la politique</h3>
                <p>
                  Nous pouvons modifier cette politique de confidentialité à tout moment. Les modifications seront 
                  publiées sur cette page avec une date de mise à jour révisée.
                </p>
              </section>

              <p className="text-xs text-muted/50 pt-4 border-t border-white/5">
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

// Composant Modal réutilisable
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay avec backdrop blur */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <Motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-2xl max-h-[80vh] bg-surface/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-muted hover:text-white transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </Motion.div>
    </div>
  )
}
