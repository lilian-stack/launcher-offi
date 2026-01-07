import { createPortal } from 'react-dom'
import { Motion, AnimatePresence } from './Motion'

export function GuestWarningModal({ 
  isOpen, 
  onClose, 
  onContinue,
  action = 'télécharger'
}) {
  if (!isOpen) return null

  const handleContinue = () => {
    if (onContinue) {
      onContinue()
    }
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      <div 
        className="overlay"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '20px'
        }}
        onClick={onClose}
      >
        <Motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ 
            type: 'spring',
            damping: 25,
            stiffness: 300
          }}
          onClick={(e) => e.stopPropagation()}
          className="modal"
          style={{
            background: 'linear-gradient(135deg, #5c4a38 0%, #3d2f24 100%)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
            position: 'relative'
          }}
        >
          {/* Header */}
          <div className="modal-header" style={{
            padding: '24px 24px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div className="header-content" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <div className="warning-icon" style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #d4a574 0%, #b88c5e 100%)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '24px', color: '#2a1f18' }}>⚠</span>
              </div>
              <div className="header-text">
                <h2 style={{
                  color: '#fff',
                  fontSize: '22px',
                  fontWeight: 600,
                  marginBottom: '4px'
                }}>
                  Mode Invité
                </h2>
                <p style={{
                  color: '#d4a574',
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  Accès limité
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="close-btn"
              style={{
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '6px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="modal-body" style={{
            padding: '0 24px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Warning Card */}
            <div className="info-card warning" style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid rgba(212, 165, 116, 0.5)'
            }}>
              <div className="card-header" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div className="card-icon" style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '18px'
                }}>
                  🔒
                </div>
                <div className="card-title" style={{
                  color: '#d4a574',
                  fontSize: '15px',
                  fontWeight: 600
                }}>
                  Fonctionnalités limitées
                </div>
              </div>
              <div className="card-description" style={{
                color: '#d4a574',
                fontSize: '14px',
                lineHeight: 1.5,
                marginBottom: '12px'
              }}>
                Vous êtes actuellement connecté en tant qu'invité. Certaines fonctionnalités sont limitées :
              </div>
              <ul className="feature-list" style={{
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <li style={{
                  color: '#d4a574',
                  fontSize: '14px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: '8px',
                    fontSize: '16px'
                  }}>•</span>
                  Accès restreint aux téléchargements
                </li>
                <li style={{
                  color: '#d4a574',
                  fontSize: '14px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: '8px',
                    fontSize: '16px'
                  }}>•</span>
                  Pas d'accès aux jeux VIP
                </li>
                <li style={{
                  color: '#d4a574',
                  fontSize: '14px',
                  paddingLeft: '20px',
                  position: 'relative'
                }}>
                  <span style={{
                    position: 'absolute',
                    left: '8px',
                    fontSize: '16px'
                  }}>•</span>
                  Fonctionnalités premium désactivées
                </li>
              </ul>
            </div>

            {/* Info Card */}
            <div className="info-card info" style={{
              background: 'rgba(31, 56, 88, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid rgba(88, 166, 255, 0.5)'
            }}>
              <div className="card-header" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div className="card-icon" style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  fontSize: '18px'
                }}>
                  👤
                </div>
                <div className="card-title" style={{
                  color: '#58a6ff',
                  fontSize: '15px',
                  fontWeight: 600
                }}>
                  Connectez-vous pour plus
                </div>
              </div>
              <div className="card-description" style={{
                color: '#9dc5ff',
                fontSize: '14px',
                lineHeight: 1.5
              }}>
                Connectez-vous avec Discord pour accéder à toutes les fonctionnalités et profiter d'une expérience complète.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{
            padding: '0 24px 24px'
          }}>
            <p className="footer-text" style={{
              color: '#a0a0a0',
              fontSize: '13px',
              textAlign: 'center',
              marginBottom: '16px',
              lineHeight: 1.4
            }}>
              Souhaitez-vous continuer à {action} ce jeu en mode invité ?
            </p>
            <div className="button-group" style={{
              display: 'flex',
              gap: '12px'
            }}>
              <Motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                className="btn btn-cancel"
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                Annuler
              </Motion.button>
              <Motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleContinue}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'linear-gradient(135deg, #d4a574 0%, #b88c5e 100%)',
                  color: '#2a1f18'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ddb482 0%, #c4976b 100%)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 165, 116, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #d4a574 0%, #b88c5e 100%)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Continuer quand même
              </Motion.button>
            </div>
          </div>
        </Motion.div>
      </div>
    </AnimatePresence>,
    document.body
  )
}
