import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'

export function RestrictedAccessModal({ isOpen, onClose, onLogin, message = "Pour suggérer des jeux et interagir avec la communauté, vous devez vous connecter avec votre compte Discord." }) {
  if (!isOpen) return null

  const handleDiscordLogin = async () => {
    // Naviguer vers la page de connexion ou déclencher la connexion Discord
    if (onLogin) {
      onLogin()
    } else if (window.electron?.discord) {
      try {
        // Obtenir l'URL d'autorisation
        const authUrl = await window.electron.discord.getAuthUrl()
        if (authUrl) {
          // Ouvrir l'URL d'autorisation
          await window.electron.discord.openAuthUrl(authUrl)
        }
      } catch (error) {
        console.error('[RestrictedAccessModal] Erreur lors de la connexion:', error)
      }
    }
    onClose()
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
              left: '20%',
              width: '500px',
              height: '500px',
              background: 'linear-gradient(135deg, #d4a574, #b88c5e)',
              opacity: 0.15,
              borderRadius: '50%',
              filter: 'blur(120px)',
              animation: 'pulseGlow 8s ease-in-out infinite'
            }} />
            <div className="bg-blur bg-blur-2" style={{
              position: 'absolute',
              bottom: '20%',
              right: '15%',
              width: '600px',
              height: '600px',
              background: 'linear-gradient(135deg, #ff6b35, #d4a574)',
              opacity: 0.15,
              borderRadius: '50%',
              filter: 'blur(120px)',
              animation: 'pulseGlow 8s ease-in-out infinite',
              animationDelay: '2s'
            }} />
          </div>

          {/* Overlay */}
          <div 
            className="overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
              animation: 'fadeIn 0.3s ease-out'
            }}
            onClick={onClose}
          >
            <Motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ 
                type: 'spring',
                damping: 25,
                stiffness: 300
              }}
              onClick={(e) => e.stopPropagation()}
              className="modal"
              style={{
                background: 'linear-gradient(145deg, rgba(50, 40, 35, 0.95), rgba(35, 28, 25, 0.98))',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: '520px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(212, 165, 116, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top border gradient */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.5) 50%, transparent)'
              }} />

              {/* Header */}
              <div className="modal-header" style={{
                padding: '32px 32px 24px',
                background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(184, 140, 94, 0.1))',
                borderBottom: '1px solid rgba(212, 165, 116, 0.2)',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.3) 50%, transparent)'
                }} />
                <div className="header-content" style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}>
                  <div className="lock-icon" style={{
                    width: '56px',
                    height: '56px',
                    background: 'linear-gradient(135deg, #d4a574 0%, #b88c5e 100%)',
                    borderRadius: '16px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                    boxShadow: '0 8px 24px rgba(212, 165, 116, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    position: 'relative',
                    animation: 'iconPulse 3s ease-in-out infinite'
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      inset: '-2px',
                      borderRadius: '16px',
                      padding: '2px',
                      background: 'linear-gradient(135deg, #d4a574, #b88c5e)',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      opacity: 0.3,
                      pointerEvents: 'none'
                    }} />
                  </div>
                  <div className="header-text">
                    <h2 style={{
                      color: '#ffffff',
                      fontSize: '28px',
                      fontWeight: 700,
                      marginBottom: '6px',
                      letterSpacing: '-0.5px'
                    }}>
                      Accès restreint
                    </h2>
                    <p style={{
                      color: '#d4a574',
                      fontSize: '15px',
                      fontWeight: 500,
                      opacity: 0.9
                    }}>
                      Connexion requise
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="modal-body" style={{
                padding: '32px'
              }}>
                <div className="info-card" style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '24px',
                  border: '1px solid rgba(212, 165, 116, 0.2)',
                  position: 'relative',
                  marginBottom: '24px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 165, 116, 0.4)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(212, 165, 116, 0.1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(212, 165, 116, 0.2)'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    background: 'linear-gradient(180deg, #d4a574, #b88c5e)',
                    borderRadius: '16px 0 0 16px'
                  }} />
                  <div className="card-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    marginBottom: '14px'
                  }}>
                    <div className="card-icon" style={{
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontSize: '20px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#d4a574' }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="card-title" style={{
                      color: '#d4a574',
                      fontSize: '17px',
                      fontWeight: 600,
                      letterSpacing: '-0.2px'
                    }}>
                      Vous devez vous connecter via Discord
                    </div>
                  </div>
                  <div className="card-description" style={{
                    color: 'rgba(212, 165, 116, 0.85)',
                    fontSize: '15px',
                    lineHeight: 1.6
                  }}>
                    {message}
                  </div>
                </div>

                {/* Footer notice */}
                <div className="footer-notice" style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  border: '1px solid rgba(212, 165, 116, 0.15)',
                  textAlign: 'center'
                }}>
                  <p style={{
                    color: 'rgba(160, 160, 160, 0.9)',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    marginBottom: '20px'
                  }}>
                    Vous pouvez consulter le formulaire ci-dessous, mais l'accès complet nécessite une connexion.
                  </p>
                  
                  <button
                    onClick={handleDiscordLogin}
                    className="discord-button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 32px',
                      background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 8px 24px rgba(88, 101, 242, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #6b76f9 0%, #5865f2 100%)'
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(88, 101, 242, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)'
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(88, 101, 242, 0.3)'
                    }}
                  >
                    <span style={{
                      position: 'relative',
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
                        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      Se connecter avec Discord
                    </span>
                  </button>
                </div>
              </div>
            </Motion.div>
          </div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulseGlow {
              0%, 100% { opacity: 0.1; transform: scale(1); }
              50% { opacity: 0.2; transform: scale(1.1); }
            }
            @keyframes iconPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

