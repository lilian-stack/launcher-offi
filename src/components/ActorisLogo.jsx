import { Motion } from './Motion'
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
    <div className={`actoris-logo flex flex-col items-center ${className}`}>
      {/* Logo ACTORIS depuis l'image */}
      <div className={`${sizeClasses[size]} flex items-center justify-center`}>
        {!logoError ? (
          <img 
            src={logoPath} 
            alt="ACTORIS Logo"
            className="w-full h-full object-contain"
            width="48"
            height="48"
            loading="eager"
            fetchpriority="high"
            decoding="sync"
            onError={() => {
              console.error('Erreur de chargement du logo ACTORIS')
              setLogoError(true)
            }}
          />
        ) : (
          <div className="logo-fallback w-full h-full bg-purple-600 flex items-center justify-center text-white font-bold"
            style={{
              fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1.5rem' : '1rem'
            }}
          >
            A
          </div>
        )}
      </div>
      {/* Texte ACTORIS (optionnel, car déjà dans l'image) */}
      {showText && (
        <div className={`${textSizes[size]} font-bold text-purple-400 mt-1`}>
          ACTORIS
        </div>
      )}
    </div>
  )
}

