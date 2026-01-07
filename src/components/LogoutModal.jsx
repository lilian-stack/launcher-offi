import { useState, useEffect } from 'react'
import { Motion, AnimatePresence } from './Motion'

export function LogoutModal({ isOpen, onClose, onConfirm, username, currentUser }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoggingOut) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, isLoggingOut, onClose])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    onConfirm?.()
    onClose()
    setIsLoggingOut(false)
  }

  if (!isOpen) return null

  const displayName = username || currentUser?.username || 'Utilisateur'
  const displayAvatar = currentUser?.avatar
  const userInitial = displayName.charAt(0).toUpperCase()

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.3s ease'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoggingOut) {
              onClose()
            }
          }}
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
              position: 'relative',
              width: '90%',
              maxWidth: '480px',
              background: 'linear-gradient(135deg, rgba(32, 34, 37, 0.98) 0%, rgba(40, 42, 46, 0.98) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderRadius: '20px',
              padding: '40px',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(88, 101, 242, 0.2) inset, 0 0 40px rgba(88, 101, 242, 0.1)',
              border: '1px solid rgba(88, 101, 242, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch'
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={isLoggingOut}
              className="close-btn"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                width: '36px',
                height: '36px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '8px',
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s',
                opacity: isLoggingOut ? 0.5 : 1,
                pointerEvents: isLoggingOut ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!isLoggingOut) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.transform = 'rotate(90deg)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'
                e.currentTarget.style.transform = 'rotate(0deg)'
              }}
            >
              ✕
            </button>

            {/* Logo - Centré */}
            <div className="logo" style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '25px',
              width: '100%'
            }}>
              <div className="logo-circle" style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #5865f2 0%, #7289da 50%, #8b5cf6 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 30px rgba(88, 101, 242, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
                animation: 'logoFloat 3s ease-in-out infinite',
                border: '2px solid rgba(88, 101, 242, 0.3)'
              }}>
                <svg viewBox="0 0 71 55" fill="white" style={{ width: '45px', height: '45px' }}>
                  <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/>
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="modal-title" style={{
              textAlign: 'center',
              fontSize: '26px',
              fontWeight: 700,
              color: 'white',
              marginBottom: '15px'
            }}>
              Déconnexion
            </h2>

            {/* Description */}
            <p className="modal-description" style={{
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '30px'
            }}>
              Êtes-vous sûr de vouloir vous déconnecter ? Vous devrez vous reconnecter avec Discord pour accéder au launcher.
            </p>

            {/* Account Info */}
            <div className="account-info" style={{
              background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
              border: '1px solid rgba(88, 101, 242, 0.2)',
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.3s',
              boxShadow: '0 4px 12px rgba(88, 101, 242, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
            >
              {displayAvatar ? (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={displayAvatar} 
                    alt={displayName}
                    className="account-avatar"
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      flexShrink: 0,
                      boxShadow: '0 5px 15px rgba(88, 101, 242, 0.5)',
                      border: '2px solid rgba(88, 101, 242, 0.3)'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '14px',
                    height: '14px',
                    background: '#10b981',
                    border: '2px solid rgba(32, 34, 37, 0.98)',
                    borderRadius: '50%',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                  }} />
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div className="account-avatar" style={{
                    width: '50px',
                    height: '50px',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '20px',
                    color: 'white',
                    flexShrink: 0,
                    boxShadow: '0 5px 15px rgba(88, 101, 242, 0.5)',
                    border: '2px solid rgba(88, 101, 242, 0.3)'
                  }}>
                    {userInitial}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '14px',
                    height: '14px',
                    background: '#10b981',
                    border: '2px solid rgba(32, 34, 37, 0.98)',
                    borderRadius: '50%',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                  }} />
                </div>
              )}
              <div className="account-details" style={{ flex: 1 }}>
                <div className="account-label" style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '4px'
                }}>
                  Compte connecté
                </div>
                <div className="account-name" style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {displayName}
                  {currentUser?.isAdmin && (
                    <span className="admin-badge" style={{
                      background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(245, 87, 108, 0.3)'
                    }}>
                      Admin
                    </span>
                  )}
                  {!currentUser?.isAdmin && currentUser?.isVip && (
                    <span className="admin-badge" style={{
                      background: 'linear-gradient(135deg, #f7e479, #ffd700)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: '#0f0c29',
                      boxShadow: '0 2px 8px rgba(247, 228, 121, 0.4)'
                    }}>
                      VIP
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="info-box" style={{
              background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
              border: '1px solid rgba(88, 101, 242, 0.3)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '25px',
              display: 'flex',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(88, 101, 242, 0.1)'
            }}>
              <div className="info-icon" style={{
                width: '24px',
                height: '24px',
                color: '#5865f2',
                flexShrink: 0,
                fontSize: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(88, 101, 242, 0.2)',
                borderRadius: '6px',
                padding: '2px'
              }}>
                🛡️
              </div>
              <div className="info-text" style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: 1.5
              }}>
                Vos données locales seront conservées. Vous pourrez vous reconnecter à tout moment.
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="btn btn-confirm"
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)',
                  opacity: isLoggingOut ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoggingOut) {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 12px 35px rgba(239, 68, 68, 0.6)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.4)'
                }}
              >
                {isLoggingOut ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <span>Déconnexion...</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '18px' }}>🚪</span>
                    <span>Confirmer</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                disabled={isLoggingOut}
                className="btn btn-cancel"
                style={{
                  width: '100%',
                  padding: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  opacity: isLoggingOut ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoggingOut) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 5px 20px rgba(0, 0, 0, 0.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                Annuler
              </button>
            </div>
          </Motion.div>

          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes logoFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  )
}
