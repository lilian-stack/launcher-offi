import { useState, useEffect, useCallback } from 'react'
import { Motion, AnimatePresence } from '../components/Motion'
import { GuestWarningModal } from '../components/GuestWarningModal'
import { waitForBackend } from '../utils/backend'

export function LoginPage({ onLogin }) {
  const [discordLoading, setDiscordLoading] = useState(false)
  const [error, setError] = useState('')
  const [showGuestWarning, setShowGuestWarning] = useState(false)
  const [backendInitializing, setBackendInitializing] = useState(true)
  const [backendStatus, setBackendStatus] = useState('checking')

  const processAuthCode = useCallback(async (code) => {
    if (!code) return
    
    setDiscordLoading(true)
    setError('')

    try {
      let attempts = 0
      const maxAttempts = 50
      
      while (!window.electron?.discord && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (!window.electron?.discord) {
        throw new Error('Les fonctions Discord ne sont pas disponibles. Veuillez redémarrer le launcher.')
      }

      const result = await window.electron.discord.authenticate(code)
      
      if (result.success && result.user && result.sessionToken && onLogin) {
        onLogin(result.user, result.sessionToken)
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname)
        }
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
        
        throw new Error(errorMessage)
      }
    } catch (err) {
      let userFriendlyMessage = err.message || 'Une erreur est survenue lors de la connexion Discord'
      
      if (userFriendlyMessage.includes('ECONNREFUSED') || 
          userFriendlyMessage.includes('connect') && userFriendlyMessage.includes('127.0.0.1:3001')) {
        userFriendlyMessage = 'Le serveur backend démarre... Veuillez patienter quelques secondes et réessayer.'
        setTimeout(() => {
          setError('')
        }, 5000)
        return
      } else if (userFriendlyMessage.includes('rate limit') || 
          userFriendlyMessage.includes('rate_limited') || 
          userFriendlyMessage.includes('Trop de tentatives')) {
      } else if (userFriendlyMessage.includes('CLIENT_SECRET') || userFriendlyMessage.includes('invalid_client')) {
        userFriendlyMessage = 'Configuration Discord invalide. Veuillez vérifier votre configuration.'
      } else if (userFriendlyMessage.includes('invalid_redirect_uri')) {
        userFriendlyMessage = 'URL de redirection invalide. Vérifiez la configuration Discord.'
      }
      
      setError(userFriendlyMessage)
    } finally {
      setDiscordLoading(false)
    }
  }, [onLogin])

  const handleDiscordLogin = useCallback(async (retryCount = 0) => {
    setError('')
    setDiscordLoading(true)
    
    if (backendStatus !== 'ready') {
      const isReady = await waitForBackend(10, 500)
      if (!isReady) {
        setError('Veuillez attendre que le serveur soit prêt...')
        setDiscordLoading(false)
        return
      }
      setBackendStatus('ready')
    }

    try {
      if (!window.electron?.discord) {
        throw new Error('Les fonctions Discord ne sont pas disponibles.')
      }

      const authUrlPromise = window.electron.discord.getAuthUrl()
      
      try {
        const authUrl = await authUrlPromise
      
        if (authUrl) {
          setError('')
          const result = await window.electron.discord.openAuthUrl(authUrl)
          
          if (result && result.success && result.code) {
            await processAuthCode(result.code)
          } else if (result && result.error) {
            let errorMessage = result.error
            if (errorMessage === 'access_denied') {
              errorMessage = 'Accès refusé. Vous avez annulé l\'autorisation Discord.'
            }
            setError(errorMessage)
            setDiscordLoading(false)
          } else {
            setDiscordLoading(false)
          }
        } else {
          throw new Error('Impossible d\'obtenir l\'URL d\'autorisation Discord.')
        }
      } catch (err) {
        console.error('Login error:', err)
        
        const isConnectionError = err.message && (
          err.message.includes('ECONNREFUSED') || 
          err.message.includes('ECONNRESET') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('fetch failed') ||
          err.message.includes('Configuration Discord invalide')
        )
        
        if (isConnectionError && retryCount < 3) {
          setTimeout(() => handleDiscordLogin(retryCount + 1), 2000)
          return
        }
        
        if (isConnectionError) {
          setError('Le serveur backend ne répond pas. Veuillez réessayer dans quelques instants.')
        } else {
          setError(err.message || 'An error occurred during login')
        }
        setDiscordLoading(false)
      }
    } catch (err) {
      console.error('Login error:', err)
      
      const isConnectionError = err.message && (
        err.message.includes('ECONNREFUSED') || 
        err.message.includes('ECONNRESET') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('fetch failed') ||
        err.message.includes('Configuration Discord invalide')
      )
      
      if (isConnectionError && retryCount < 3) {
        setTimeout(() => handleDiscordLogin(retryCount + 1), 2000)
        return
      }
      
      if (isConnectionError) {
        setError('Le serveur backend ne répond pas. Veuillez réessayer dans quelques instants.')
      } else {
        setError(err.message || 'An error occurred during login')
      }
      setDiscordLoading(false)
    } finally {
      if (retryCount >= 3 || backendStatus !== 'ready') {
        setDiscordLoading(false)
      }
    }
  }, [processAuthCode, backendStatus])

  useEffect(() => {
    const checkBackend = async () => {
      setBackendInitializing(true)
      setBackendStatus('checking')
      
      const isReady = await waitForBackend(30, 500)
      
      if (isReady) {
        setBackendStatus('ready')
      } else {
        setBackendStatus('error')
        console.warn('⏳ Backend pas encore prêt, mais on continue')
      }
      
      setBackendInitializing(false)
    }
    
    checkBackend()
  }, [])

  useEffect(() => {
    const checkAndProcessCode = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const error = urlParams.get('error')

      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }

      if (error) {
        let errorMessage = `Erreur Discord: ${error}`
        
        if (error === 'access_denied') {
          errorMessage = 'Accès refusé. Vous avez annulé l\'autorisation Discord.'
        } else if (error === 'invalid_client') {
          errorMessage = 'Configuration Discord invalide.'
        } else if (error === 'invalid_redirect_uri') {
          errorMessage = 'URL de redirection invalide.'
        }
        
        setError(errorMessage)
        return
      }

      if (code) {
        await new Promise(resolve => setTimeout(resolve, 200))
        await processAuthCode(code)
      }
    }

    checkAndProcessCode()
  }, [processAuthCode])

  const handleLogin = () => {
    const btn = document.querySelector('.btn-primary')
    if (btn) {
      btn.textContent = 'Connexion...'
      setTimeout(() => {
        btn.textContent = 'Connexion avec Discord'
        handleDiscordLogin(0)
      }, 500)
    } else {
      handleDiscordLogin(0)
    }
  }

  const continueWithout = (e) => {
    e.preventDefault()
    setShowGuestWarning(true)
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.9);
            filter: blur(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes orbitFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(100px, -50px) scale(1.1); }
          50% { transform: translate(150px, 50px) scale(0.9); }
          75% { transform: translate(-50px, 100px) scale(1.05); }
        }

        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(88, 101, 242, 0.6)); }
          50% { filter: drop-shadow(0 0 40px rgba(88, 101, 242, 0.9)); }
        }

        .background-wrapper {
          position: fixed;
          inset: 0;
          overflow: hidden;
          background: linear-gradient(135deg, #0a0514 0%, #1a0f2e 25%, #2d1b4e 50%, #1a0f2e 75%, #0a0514 100%);
          background-size: 400% 400%;
          animation: gradientShift 20s ease infinite;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.4;
          animation: orbitFloat 25s infinite ease-in-out;
        }

        .orb-1 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(88, 101, 242, 0.8), transparent);
          top: -20%;
          left: -10%;
          animation-duration: 30s;
        }

        .orb-2 {
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(138, 108, 255, 0.6), transparent);
          bottom: -15%;
          right: -10%;
          animation-duration: 35s;
          animation-delay: -10s;
        }

        .orb-3 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(114, 137, 218, 0.7), transparent);
          top: 50%;
          left: 50%;
          animation-duration: 40s;
          animation-delay: -20s;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(88, 101, 242, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(88, 101, 242, 0.05) 1px, transparent 1px);
          background-size: 100px 100px;
          mask-image: radial-gradient(circle at center, black, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black, transparent 80%);
        }

        .login-container {
          position: relative;
          z-index: 10;
          width: 90%;
          max-width: 480px;
          padding: 50px 50px 60px;
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(40px) saturate(200%);
          -webkit-backdrop-filter: blur(40px) saturate(200%);
          border-radius: 32px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          box-shadow: 
            0 30px 90px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 -1px 0 rgba(255, 255, 255, 0.05);
          animation: slideIn 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(135deg,
            rgba(88, 101, 242, 0.4),
            rgba(114, 137, 218, 0.4),
            rgba(138, 108, 255, 0.4)
          );
          border-radius: 32px;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.6s ease;
          animation: gradientShift 3s ease infinite;
          background-size: 200% 200%;
        }

        .login-container:hover::before {
          opacity: 0.5;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 48px;
          animation: logoFloat 4s ease-in-out infinite;
        }

        .logo-icon {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #5865f2, #7289da);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(88, 101, 242, 0.5);
          animation: glow 3s ease-in-out infinite;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .logo-icon:hover {
          transform: scale(1.1) rotate(-5deg);
        }

        .logo-icon svg {
          width: 42px;
          height: 42px;
        }

        .logo-text {
          color: white;
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .title {
          color: white;
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 12px;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          background: linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.7);
          font-size: 15px;
          margin-bottom: 48px;
          font-weight: 500;
        }

        .alert-box {
          padding: 18px 20px;
          border-radius: 16px;
          font-size: 14px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          animation: slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          font-weight: 500;
        }

        .alert-info {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(88, 101, 242, 0.15));
          border: 1.5px solid rgba(59, 130, 246, 0.4);
          color: rgba(191, 219, 254, 1);
        }

        .alert-error {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15));
          border: 1.5px solid rgba(239, 68, 68, 0.4);
          color: rgba(254, 202, 202, 1);
        }

        .spinner {
          width: 22px;
          height: 22px;
          border: 2.5px solid rgba(147, 197, 253, 0.2);
          border-top-color: rgba(147, 197, 253, 1);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        .btn-primary {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #5865f2 0%, #7289da 50%, #8a6cff 100%);
          border: none;
          border-radius: 16px;
          color: white;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 
            0 12px 35px rgba(88, 101, 242, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
          background-size: 200% 200%;
          letter-spacing: 0.3px;
        }

        .btn-primary::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg,
            transparent,
            rgba(255, 255, 255, 0.3),
            transparent
          );
          transition: left 0.6s ease;
        }

        .btn-primary:hover::before {
          left: 100%;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 
            0 18px 50px rgba(88, 101, 242, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
          background-position: 100% 50%;
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(-2px);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          animation: pulse 2s ease-in-out infinite;
        }

        .guest-link {
          text-align: center;
          margin-top: 28px;
        }

        .guest-link a {
          color: rgba(255, 255, 255, 0.75);
          font-size: 14px;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          display: inline-block;
          padding: 10px 4px;
          font-weight: 600;
        }

        .guest-link a::after {
          content: '';
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 80%;
          height: 2px;
          background: linear-gradient(90deg, #5865f2, #7289da);
          border-radius: 2px;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .guest-link a:hover {
          color: white;
          transform: translateY(-2px);
        }

        .guest-link a:hover::after {
          transform: translateX(-50%) scaleX(1);
        }

        @media (max-width: 640px) {
          .login-container {
            padding: 40px 32px 50px;
            max-width: 95%;
          }

          .title {
            font-size: 28px;
          }

          .logo-icon {
            width: 60px;
            height: 60px;
          }

          .logo-icon svg {
            width: 36px;
            height: 36px;
          }

          .logo-text {
            font-size: 20px;
          }
        }
      `}</style>

      <div style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Animated Background */}
        <div className="background-wrapper">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
          <div className="grid-overlay"></div>
        </div>

        <div className="login-container">
          <div className="logo-section">
            <div className="logo-icon">
              <svg viewBox="0 0 71 55" fill="none">
                <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="white"/>
              </svg>
            </div>
            <div className="logo-text">Discord</div>
          </div>

          <h1 className="title">Bienvenue !</h1>
          <p className="subtitle">Nous sommes ravis de vous revoir !</p>

          <AnimatePresence>
            {(backendInitializing || backendStatus === 'checking') && (
              <div className="alert-box alert-info">
                <div className="spinner" />
                <span>Initialisation du serveur...</span>
              </div>
            )}
            {error && !backendInitializing && backendStatus !== 'checking' && (
              <div className="alert-box alert-error">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </AnimatePresence>

          <button 
            className="btn-primary"
            onClick={handleLogin}
            disabled={discordLoading || backendInitializing || backendStatus !== 'ready'}
          >
            {discordLoading ? 'Connexion en cours...' : 
             backendInitializing || backendStatus !== 'ready' ? 'Initialisation...' : 
             'Connexion avec Discord'}
          </button>

          <div className="guest-link">
            <a href="#" onClick={continueWithout}>
              Continuer sans se connecter
            </a>
          </div>
        </div>

        <GuestWarningModal
          isOpen={showGuestWarning}
          onClose={() => setShowGuestWarning(false)}
          onContinue={() => {
            const guestUser = {
              username: 'Invité',
              isAdmin: false,
              isVip: false,
              isBoost: false,
              isGuest: true,
              avatar: null
            }
            if (onLogin) {
              onLogin(guestUser)
            }
            setShowGuestWarning(false)
          }}
          action="accéder à l'application"
        />
      </div>
    </>
  )
}