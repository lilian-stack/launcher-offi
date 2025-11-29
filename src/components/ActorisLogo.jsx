import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export function ActorisLogo({ className = '', size = 'default', showText = true }) {
  const [logoError, setLogoError] = useState(false)
  const [logoPath, setLogoPath] = useState('./actoris-logo.png')
  
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16'
  }
  
  const textSizes = {
    small: 'text-xs',
    default: 'text-sm',
    large: 'text-base'
  }

  // Essayer différents chemins pour le logo
  useEffect(() => {
    // En production Electron, le logo est dans dist/ (copié depuis public/)
    // Avec base: './' dans vite.config.js, le chemin relatif devrait fonctionner
    const basePath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '.'
    const tryPaths = [
      `${basePath}/actoris-logo.png`,
      './actoris-logo.png',
      'actoris-logo.png',
      '/actoris-logo.png',
      new URL('./actoris-logo.png', window.location.href).href,
      new URL('/actoris-logo.png', window.location.href).href
    ]
    
    let currentIndex = 0
    const img = new Image()
    
    const tryNextPath = () => {
      if (currentIndex < tryPaths.length) {
        img.src = tryPaths[currentIndex]
        currentIndex++
      } else {
        console.warn('[ActorisLogo] Impossible de charger le logo depuis tous les chemins essayés')
        setLogoError(true)
      }
    }
    
    img.onload = () => {
      setLogoPath(img.src)
    }
    
    img.onerror = () => {
      console.warn('[ActorisLogo] Échec du chargement depuis:', img.src)
      tryNextPath()
    }
    
    tryNextPath()
  }, [])
  
  return (
    <motion.div
      className={`actoris-logo flex flex-col items-center ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
    >
      {/* Logo ACTORIS depuis l'image */}
      <motion.div 
        className={`relative ${sizeClasses[size]} flex items-center justify-center`}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.2 }}
      >
        {!logoError ? (
          <img 
            src={logoPath} 
            alt="ACTORIS Logo"
            className="w-full h-full object-contain rounded-xl"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.3))'
            }}
            onError={() => {
              console.error('Erreur de chargement du logo ACTORIS')
              setLogoError(true)
            }}
          />
        ) : (
          <div className="logo-fallback w-full h-full rounded-xl bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg"
            style={{
              fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1.5rem' : '1rem',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            A
          </div>
        )}
        {/* Effet de brillance animé */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
          style={{
            mixBlendMode: 'overlay'
          }}
        />
      </motion.div>
      {/* Texte ACTORIS (optionnel, car déjà dans l'image) */}
      {showText && (
        <div 
          className={`${textSizes[size]} font-bold text-purple-400 mt-1 tracking-wider`}
          style={{
            textShadow: '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
            letterSpacing: '0.15em'
          }}
        >
          ACTORIS
        </div>
      )}
    </motion.div>
  )
}

