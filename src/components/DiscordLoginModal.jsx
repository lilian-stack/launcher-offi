import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'

export function DiscordLoginModal({ isOpen, onClose, onLogin, onUserUpdate }) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const processAuthCode = async (code) => {
    try {
      if (!window.electron?.discord) {
        throw new Error('Les fonctions Discord ne sont pas disponibles.')
      }

      const result = await window.electron.discord.authenticate(code)
      
      if (result.success && result.user && result.sessionToken) {
        // Mettre à jour l'utilisateur
        if (onUserUpdate) {
          onUserUpdate(result.user, result.sessionToken)
        }
        if (onLogin) {
          onLogin(result.user, result.sessionToken)
        }
        onClose()
        return true
      } else {
        const errorCode = result.errorCode
        let errorMessage = result.user_message || result.message || result.error || 'Erreur lors de l\'authentification Discord'
        
        if (errorCode === 'RATE_LIMITED' || result.error === 'rate_limited') {
          const retryAfter = result.retry_after || 60
          errorMessage = `Trop de tentatives de connexion. Veuillez patienter ${retryAfter} secondes avant de réessayer.`
        } else if (errorCode === 'INVALID_CLIENT') {
          errorMessage = result.user_message || result.message || 'Configuration Discord invalide.'
        } else if (errorCode === 'INVALID_GRANT') {
          errorMessage = result.user_message || result.message || 'Code d\'autorisation invalide ou expiré.'
        } else if (errorCode === 'INVALID_REDIRECT_URI') {
          errorMessage = result.user_message || result.message || 'URL de redirection invalide.'
        }
        
        setError(errorMessage)
        setIsConnecting(false)
        return false
      }
    } catch (err) {
      let userFriendlyMessage = err.message || 'Une erreur est survenue lors de la connexion Discord'
      setError(userFriendlyMessage)
      setIsConnecting(false)
      return false
    }
  }

  const handleDiscordLogin = async () => {
    setError(null)
    setIsConnecting(true)

    try {
      if (!window.electron?.discord) {
        throw new Error('Les fonctions Discord ne sont pas disponibles.')
      }

      // Obtenir l'URL d'autorisation
      const authUrl = await window.electron.discord.getAuthUrl()
      
      if (authUrl) {
        // Ouvrir l'URL d'autorisation et attendre le callback
        const result = await window.electron.discord.openAuthUrl(authUrl)
        
        if (result && result.success && result.code) {
          // Traiter le code d'autorisation
          await processAuthCode(result.code)
        } else if (result && result.error) {
          let errorMessage = result.error
          if (errorMessage === 'access_denied') {
            errorMessage = 'Accès refusé. Vous avez annulé l\'autorisation Discord.'
          }
          setError(errorMessage)
          setIsConnecting(false)
        } else {
          setIsConnecting(false)
        }
      } else {
        throw new Error('Impossible d\'obtenir l\'URL d\'autorisation Discord.')
      }
    } catch (error) {
      console.error('[DiscordLoginModal] Erreur lors de la connexion:', error)
      setError(error.message || 'Erreur lors de la connexion Discord')
      setIsConnecting(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background effects */}
          <div className="background-effects" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}>
            <div className="bg-blur bg-blur-1" style={{
              position: 'absolute',
              top: '10%',
              left: '15%',
              width: '600px',
              height: '600px',
              background: 'linear-gradient(135deg, #5865f2, #4752c4)',
              opacity: 0.12,
              borderRadius: '50%',
              filter: 'blur(120px)',
              animation: 'pulseFloat 10s ease-in-out infinite'
            }} />
            <div className="bg-blur bg-blur-2" style={{
              position: 'absolute',
              bottom: '10%',
              right: '15%',
              width: '700px',
              height: '700px',
              background: 'linear-gradient(135deg, #7289da, #5865f2)',
              opacity: 0.1,
              borderRadius: '50%',
              filter: 'blur(120px)',
              animation: 'pulseFloat 10s ease-in-out infinite',
              animationDelay: '3s'
            }} />
          </div>

          {/* Overlay */}
          <div 
            className="overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
              animation: 'fadeIn 0.3s ease-out'
            }}
            onClick={onClose}
          >
            <Motion.div
              initial={{ opacity: 0, y: 40, scale: 0.93 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.93 }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 300
              }}
              onClick={(e) => e.stopPropagation()}
              className="modal"
              style={{
                background: 'linear-gradient(145deg, #1a1a24 0%, #16161f 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                borderRadius: '28px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="close-btn"
                style={{
                  position: 'absolute',
                  top: '24px',
                  right: '24px',
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '12px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 10
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                ×
              </button>

              {/* Content */}
              <div className="modal-content" style={{
                padding: '48px 40px',
                textAlign: 'center'
              }}>
                {/* Discord Logo */}
                <div className="discord-logo" style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 32px',
                  background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
                  borderRadius: '20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 12px 32px rgba(88, 101, 242, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  position: 'relative',
                  animation: 'iconBounce 2s ease-in-out infinite'
                }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '44px', height: '44px', color: 'white' }}>
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>

                {/* Title */}
                <h1 className="title" style={{
                  fontSize: '32px',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginBottom: '12px',
                  letterSpacing: '-0.5px'
                }}>
                  Connexion requise
                </h1>
                <p className="subtitle" style={{
                  fontSize: '16px',
                  color: '#9ca3af',
                  lineHeight: 1.6,
                  marginBottom: '40px'
                }}>
                  Connectez-vous avec Discord pour accéder à toutes les fonctionnalités et rejoindre notre communauté
                </p>

                {/* Login Button */}
                <button
                  onClick={handleDiscordLogin}
                  className="discord-button"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '14px',
                    padding: '18px 32px',
                    background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
                    color: 'white',
                    fontSize: '17px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 8px 28px rgba(88, 101, 242, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    position: 'relative',
                    overflow: 'hidden',
                    letterSpacing: '-0.2px',
                    opacity: isConnecting ? 0.7 : 1,
                    cursor: isConnecting ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isConnecting) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #6b76f9 0%, #5865f2 100%)'
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = '0 16px 40px rgba(88, 101, 242, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 8px 28px rgba(88, 101, 242, 0.4)'
                  }}
                >
                  <span className="discord-button-content" style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                  }}>
                    {isConnecting ? (
                      <>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          border: '2px solid rgba(255, 255, 255, 0.3)',
                          borderTopColor: 'white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Connexion...
                      </>
                    ) : (
                      <>
                        <svg className="discord-button-icon" viewBox="0 0 24 24" fill="currentColor" style={{ width: '26px', height: '26px' }}>
                          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Se connecter avec Discord
                      </>
                    )}
                  </span>
                </button>

                {/* Footer Notice */}
                <div className="footer-notice" style={{
                  marginTop: '32px',
                  padding: '16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <p style={{
                    color: '#6b7280',
                    fontSize: '13px',
                    lineHeight: 1.6
                  }}>
                    En vous connectant, vous acceptez nos{' '}
                    <a href="#" style={{
                      color: '#5865f2',
                      textDecoration: 'none',
                      fontWeight: 500,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#6b76f9'
                      e.currentTarget.style.textDecoration = 'underline'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#5865f2'
                      e.currentTarget.style.textDecoration = 'none'
                    }}
                    >
                      Conditions d'utilisation
                    </a>
                    {' '}et notre{' '}
                    <a href="#" style={{
                      color: '#5865f2',
                      textDecoration: 'none',
                      fontWeight: 500,
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#6b76f9'
                      e.currentTarget.style.textDecoration = 'underline'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#5865f2'
                      e.currentTarget.style.textDecoration = 'none'
                    }}
                    >
                      Politique de confidentialité
                    </a>
                  </p>
                </div>
              </div>
            </Motion.div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulseFloat {
              0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
              50% { transform: translate(20px, 20px) scale(1.1); opacity: 0.15; }
            }
            @keyframes iconBounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

