import React, { useState, useEffect } from 'react'
import { VipAccessModal } from '../components/VipAccessModal'

export function VipPage({ currentUser = null, onNavigate }) {
  const [showVipModal, setShowVipModal] = useState(false)
  const [cardsVisible, setCardsVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState(null)

  const isGuest = currentUser?.isGuest === true
  const isAdmin = currentUser?.isAdmin === true
  const isVip = currentUser?.isVip === true
  const isBoost = currentUser?.isBoost === true

  // Déterminer le plan actuel de l'utilisateur
  const getCurrentPlan = () => {
    if (isAdmin || isVip) return 'vip'
    if (isBoost) return 'boost'
    return 'free'
  }

  const currentPlan = getCurrentPlan()

  // Afficher le modal si l'utilisateur est invité
  useEffect(() => {
    if (isGuest) {
      setShowVipModal(true)
    }
  }, [isGuest])

  // Animation d'apparition en cascade des cartes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCardsVisible(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const handlePlanSelect = (planType) => {
    if (planType === 'vip') {
      console.log('Plan VIP sélectionné')
    } else if (planType === 'boost') {
      console.log('Plan Boost sélectionné')
    }
  }

  const handleCardHover = (cardIndex, isHovering) => {
    setHoveredCard(isHovering ? cardIndex : null)
  }

  return (
    <>
      {/* Modal d'accès VIP pour les invités */}
      <VipAccessModal
        isOpen={showVipModal}
        onClose={() => setShowVipModal(false)}
        onConnectDiscord={() => {
          setShowVipModal(false)
          if (onNavigate) {
            onNavigate('login')
          } else {
            window.dispatchEvent(new CustomEvent('navigate', {
              detail: { page: 'login' }
            }))
          }
        }}
      />

      <div style={styles.container}>
        {/* Background gradient */}
        <div style={styles.bgGradient}></div>
        
        <div style={styles.containerInner}>
          {/* Header */}
          <header style={styles.header}>
            <h1 style={styles.headerTitle}>Choisissez votre plan</h1>
            <p style={styles.headerSubtitle}>Sélectionnez l'offre qui correspond à vos besoins</p>
          </header>

          {/* Plans Grid */}
          <div style={styles.plansGrid}>
            {/* Plan Gratuit */}
            <div 
              style={{
                ...styles.planCard,
                ...styles.cardAnimation,
                animationDelay: cardsVisible ? '0ms' : '1000ms',
                opacity: cardsVisible ? 1 : 0,
                transform: cardsVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
                ...(hoveredCard === 0 ? styles.cardHover : {})
              }}
              onMouseEnter={() => handleCardHover(0, true)}
              onMouseLeave={() => handleCardHover(0, false)}
            >
              <div style={styles.planIcon}>
                🎁
              </div>
              <h2 style={styles.planName}>Gratuit</h2>
              <p style={styles.planDescription}>Accès de base au catalogue</p>
              <div style={styles.planPrice}>
                <div style={styles.priceContainer}>
                  <span style={styles.priceAmount}>0€</span>
                  <span style={styles.pricePeriod}>/mois</span>
                </div>
              </div>
              <ul style={styles.features}>
                {['Accès au catalogue complet', 'Jusqu\'à 3 jeux dans la bibliothèque', 'Publicités présentes'].map((feature, index) => (
                  <li 
                    key={index} 
                    style={{
                      ...styles.featureItem,
                      ...styles.featureAnimation,
                      animationDelay: cardsVisible ? `${200 + index * 100}ms` : '1000ms',
                      opacity: cardsVisible ? 1 : 0,
                      transform: cardsVisible ? 'translateX(0)' : 'translateX(-20px)'
                    }}
                  >
                    <span style={feature === 'Publicités présentes' ? styles.warningIcon : styles.checkIcon}>
                      {feature === 'Publicités présentes' ? (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={styles.warningSvg}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                        </svg>
                      ) : (
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={styles.checkSvg}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                style={{
                  ...styles.ctaButton, 
                  ...(currentPlan === 'free' ? styles.ctaButtonCurrent : {}),
                  ...(hoveredCard === 0 && currentPlan !== 'free' ? styles.buttonHover : {})
                }}
                onClick={() => currentPlan !== 'free' && handlePlanSelect('free')}
              >
                {currentPlan === 'free' ? 'Plan actuel' : 'Plan gratuit'}
              </button>
            </div>

            {/* Plan VIP */}
            <div 
              style={{
                ...styles.planCard, 
                ...styles.planCardHighlighted,
                ...styles.cardAnimation,
                animationDelay: cardsVisible ? '150ms' : '1000ms',
                opacity: cardsVisible ? 1 : 0,
                transform: cardsVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
                ...(hoveredCard === 1 ? styles.cardHoverVip : {})
              }}
              onMouseEnter={() => handleCardHover(1, true)}
              onMouseLeave={() => handleCardHover(1, false)}
            >
              <span style={{...styles.badge, ...styles.badgePulse}}>Recommandé</span>
              <div style={{...styles.planIcon, ...styles.planIconHighlighted}}>
                👑
              </div>
              <h2 style={styles.planName}>VIP</h2>
              <p style={styles.planDescription}>L'expérience complète et illimitée</p>
              <div style={styles.planPrice}>
                <div style={styles.priceContainer}>
                  <span style={styles.priceAmount}>2,99€</span>
                  <span style={styles.pricePeriod}>/une fois</span>
                </div>
              </div>
              <ul style={styles.features}>
                {[
                  'Toutes les fonctionnalités Boost',
                  'Jeux illimités dans la bibliothèque', 
                  'Téléchargements illimités',
                  'Aucune publicité',
                  'Support prioritaire 24/7',
                  'Accès anticipé aux nouveautés',
                  'Badges et personnalisation exclusive',
                  'Thèmes premium exclusifs'
                ].map((feature, index) => (
                  <li 
                    key={index} 
                    style={{
                      ...styles.featureItem,
                      ...styles.featureAnimation,
                      animationDelay: cardsVisible ? `${350 + index * 100}ms` : '1000ms',
                      opacity: cardsVisible ? 1 : 0,
                      transform: cardsVisible ? 'translateX(0)' : 'translateX(-20px)'
                    }}
                  >
                    <span style={{...styles.checkIcon, ...styles.checkIconHighlighted}}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{...styles.checkSvg, ...styles.checkSvgHighlighted}}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                      </svg>
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                style={{
                  ...styles.ctaButton, 
                  ...styles.ctaButtonHighlighted,
                  ...(currentPlan === 'vip' ? styles.ctaButtonCurrentVip : {}),
                  ...(hoveredCard === 1 && currentPlan !== 'vip' ? styles.buttonHoverVip : {})
                }}
                onClick={() => currentPlan !== 'vip' && handlePlanSelect('vip')}
              >
                {currentPlan === 'vip' ? (isAdmin ? 'Plan Admin (VIP inclus)' : 'Plan actuel') : 'Choisir ce plan'}
              </button>
            </div>

            {/* Plan Boost */}
            <div 
              style={{
                ...styles.planCard,
                ...styles.cardAnimation,
                animationDelay: cardsVisible ? '300ms' : '1000ms',
                opacity: cardsVisible ? 1 : 0,
                transform: cardsVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
                ...(hoveredCard === 2 ? styles.cardHover : {})
              }}
              onMouseEnter={() => handleCardHover(2, true)}
              onMouseLeave={() => handleCardHover(2, false)}
            >
              <div style={styles.planIcon}>
                ⚡
              </div>
              <h2 style={styles.planName}>Boost Serveur</h2>
              <p style={styles.planDescription}>Offert lors du boost Discord du serveur</p>
              <div style={styles.planPrice}>
                <div style={styles.priceContainer}>
                  <span style={styles.priceAmount}>0€</span>
                  <span style={styles.pricePeriod}>/mois</span>
                </div>
              </div>
              <ul style={styles.features}>
                {[
                  'Téléchargements prioritaires',
                  'Aucune publicité',
                  'Accès aux nouveautés',
                  'Notifications personnalisées',
                  'Badges exclusifs',
                  'Support communautaire'
                ].map((feature, index) => (
                  <li 
                    key={index} 
                    style={{
                      ...styles.featureItem,
                      ...styles.featureAnimation,
                      animationDelay: cardsVisible ? `${500 + index * 100}ms` : '1000ms',
                      opacity: cardsVisible ? 1 : 0,
                      transform: cardsVisible ? 'translateX(0)' : 'translateX(-20px)'
                    }}
                  >
                    <span style={styles.checkIcon}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={styles.checkSvg}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                      </svg>
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                style={{
                  ...styles.ctaButton,
                  ...(currentPlan === 'boost' ? styles.ctaButtonCurrent : {}),
                  ...(hoveredCard === 2 && currentPlan !== 'boost' ? styles.buttonHover : {})
                }}
                onClick={() => currentPlan !== 'boost' && handlePlanSelect('boost')}
              >
                {currentPlan === 'boost' ? 'Plan actuel' : 'Choisir ce plan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes featureSlideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes iconRotate {
          from {
            transform: rotateY(0deg);
          }
          to {
            transform: rotateY(360deg);
          }
        }

        @keyframes badgePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 8px rgba(212, 175, 55, 0);
          }
        }

        @keyframes cardGlow {
          0%, 100% {
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          }
          50% {
            box-shadow: 0 20px 60px rgba(212, 175, 55, 0.2);
          }
        }

        @keyframes buttonPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .plans-grid {
            grid-template-columns: 1fr !important;
            max-width: 440px !important;
          }
          .header-title {
            font-size: 2.25rem !important;
          }
        }

        @media (max-width: 768px) {
          .container-inner {
            padding: 10px 20px 30px 20px !important;
          }
          .header {
            margin-bottom: 20px !important;
          }
          .header-title {
            font-size: 2rem !important;
          }
          .header-subtitle {
            font-size: 1rem !important;
          }
          .price-amount {
            font-size: 2rem !important;
          }
          .plan-card {
            min-height: 480px !important;
            padding: 20px 16px !important;
          }
        }
      `}</style>
    </>
  )
}

const styles = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    background: '#0a0a0f',
    color: '#fff',
    overflowX: 'hidden',
    overflowY: 'auto',
    minHeight: '100vh',
    lineHeight: 1.6,
    position: 'relative',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  bgGradient: {
    position: 'fixed',
    inset: 0,
    background: `
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120, 119, 198, 0.15), transparent),
      radial-gradient(ellipse 60% 50% at 50% 120%, rgba(139, 92, 246, 0.1), transparent)
    `,
    pointerEvents: 'none',
  },
  containerInner: {
    position: 'relative',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '60px 32px 40px 32px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  headerTitle: {
    fontSize: '2.75rem',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  headerSubtitle: {
    fontSize: '1.125rem',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 400,
  },
  plansGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  planCard: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    padding: '24px 20px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    cursor: 'pointer',
    height: 'auto',
    minHeight: '550px',
    display: 'flex',
    flexDirection: 'column',
  },
  planCardHighlighted: {
    background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 14px',
    background: 'rgba(212, 175, 55, 0.15)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '6px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#d4af37',
    marginBottom: '24px',
    letterSpacing: '0.02em',
  },
  planIcon: {
    width: '40px',
    height: '40px',
    marginBottom: '16px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  },
  planIconHighlighted: {
    background: 'rgba(212, 175, 55, 0.1)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  planName: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '6px',
    color: '#ffffff',
    letterSpacing: '-0.01em',
  },
  planDescription: {
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: '20px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
  planPrice: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  priceContainer: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  priceAmount: {
    fontSize: '2.5rem',
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  pricePeriod: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: 400,
  },
  features: {
    listStyle: 'none',
    marginBottom: '16px',
    padding: 0,
    flex: 1,
    maxHeight: 'none',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '4px 0',
    fontSize: '0.8125rem',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 400,
  },
  checkIcon: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '1px',
  },
  checkIconHighlighted: {
    background: 'rgba(212, 175, 55, 0.15)',
  },
  checkSvg: {
    width: '10px',
    height: '10px',
    stroke: 'rgba(255, 255, 255, 0.6)',
  },
  checkSvgHighlighted: {
    stroke: '#d4af37',
  },

  warningIcon: {
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    background: 'rgba(255, 193, 7, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '1px',
  },

  warningSvg: {
    width: '10px',
    height: '10px',
    stroke: '#ffc107',
  },
  ctaButton: {
    width: '100%',
    padding: '12px 20px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
    marginTop: 'auto',
    flexShrink: 0,
  },
  ctaButtonHighlighted: {
    background: 'rgba(212, 175, 55, 0.15)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
    color: '#d4af37',
  },
  ctaButtonCurrent: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: 'rgba(255, 255, 255, 0.3)',
    cursor: 'default',
  },

  ctaButtonCurrentVip: {
    background: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
    color: '#d4af37',
    cursor: 'default',
  },

  // Animations
  cardAnimation: {
    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  featureAnimation: {
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Hover Effects
  cardHover: {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 25px 60px rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  cardHoverVip: {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 25px 60px rgba(212, 175, 55, 0.3)',
    borderColor: 'rgba(212, 175, 55, 0.5)',
    background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
  },

  iconRotate: {
    transform: 'rotateY(180deg) scale(1.1)',
    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  badgePulse: {
    animation: 'badgePulse 2s infinite',
  },

  buttonHover: {
    transform: 'scale(1.05)',
    background: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    boxShadow: '0 8px 25px rgba(255, 255, 255, 0.15)',
  },

  buttonHoverVip: {
    transform: 'scale(1.05)',
    background: 'rgba(212, 175, 55, 0.25)',
    borderColor: 'rgba(212, 175, 55, 0.6)',
    boxShadow: '0 8px 25px rgba(212, 175, 55, 0.4)',
  },
}

export default VipPage
