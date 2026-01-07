import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'

export function VipAccessModal({ isOpen, onClose, onConnectDiscord }) {
  if (!isOpen) return null

  const handleDiscordConnect = () => {
    if (onConnectDiscord) {
      onConnectDiscord()
    } else {
      // Fallback : naviguer vers la page de connexion
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: { page: 'login' }
      }))
    }
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay SANS backdrop-filter pour éviter de flouter les éléments UI */}
          <div 
            className="overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.92)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 99999,
              animation: 'fadeIn 0.3s ease-out'
            }}
            onClick={(e) => {
              // Ne pas fermer en cliquant en dehors - l'utilisateur doit se connecter
              e.stopPropagation()
            }}
          >
          <Motion.div
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="popup-container"
            style={{
              background: 'linear-gradient(145deg, rgba(42, 42, 62, 0.95), rgba(31, 31, 46, 0.98))',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              borderRadius: '24px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              margin: '20px',
              position: 'relative',
              zIndex: 100000 // Au-dessus de l'overlay (99999)
            }}
          >
            {/* Top border gradient */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5) 50%, transparent)'
            }} />
            {/* Header */}
            <div className="popup-header" style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(124, 58, 237, 0.1))',
              padding: '32px 28px',
              position: 'relative',
              overflow: 'hidden',
              borderBottom: '1px solid rgba(139, 92, 246, 0.2)'
            }}>
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3) 50%, transparent)'
              }} />
              <div style={{
                position: 'absolute',
                top: '-50%',
                right: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
                animation: 'shine 3s infinite'
              }} />
              <div className="lock-icon" style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                animation: 'iconPulse 3s ease-in-out infinite'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }}>
                  <path d="M12 2C9.243 2 7 4.243 7 7v2H6c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-9c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zM9 7c0-1.654 1.346-3 3-3s3 1.346 3 3v2H9V7zm4 10.723V20h-2v-2.277a1.993 1.993 0 0 1 .567-3.677A2.001 2.001 0 0 1 14 16a1.99 1.99 0 0 1-1 1.723z"/>
                </svg>
              </div>
              <h2 style={{
                fontSize: '28px',
                color: '#ffffff',
                fontWeight: 700,
                marginBottom: '8px',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                letterSpacing: '-0.5px'
              }}>
                Accès VIP Requis
              </h2>
              <p style={{
                fontSize: '15px',
                color: '#8b5cf6',
                fontWeight: 500,
                opacity: 0.9
              }}>
                Contenu premium réservé aux membres
              </p>
            </div>

            {/* Body */}
            <div className="popup-body" style={{
              padding: '32px 28px'
            }}>
              <div className="info-box" style={{
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '4px',
                  height: '100%',
                  background: 'linear-gradient(180deg, #8b5cf6, #7c3aed)',
                  borderRadius: '16px 0 0 16px'
                }} />
                <div className="info-box-header" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div className="user-icon" style={{
                    width: '40px',
                    height: '40px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#8b5cf6">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <h3 style={{
                    fontSize: '16px',
                    color: '#8b5cf6',
                    fontWeight: 600
                  }}>
                    Connexion Discord requise
                  </h3>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: 'rgba(139, 92, 246, 0.85)',
                  lineHeight: 1.6
                }}>
                  Pour accéder à ce contenu exclusif et interagir avec notre communauté VIP, vous devez vous connecter avec votre compte Discord.
                </p>
              </div>

              <button
                onClick={handleDiscordConnect}
                className="btn-discord"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #5865F2 0%, #4752C4 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 8px 20px rgba(88, 101, 242, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(88, 101, 242, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(88, 101, 242, 0.3)'
                }}
              >
                <svg className="discord-icon" viewBox="0 0 24 24" fill="white" style={{ width: '24px', height: '24px' }}>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Se connecter avec Discord
              </button>

              <p className="note" style={{
                fontSize: '13px',
                color: 'rgba(160, 160, 160, 0.9)',
                textAlign: 'center',
                lineHeight: 1.5,
                padding: '0 8px'
              }}>
                Vous pouvez consulter le formulaire ci-dessous, mais l'accès complet nécessite une connexion.
              </p>
            </div>
          </Motion.div>
        </div>

        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes shine {
            0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
            50% { transform: translate(-30%, -30%) rotate(180deg); }
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

