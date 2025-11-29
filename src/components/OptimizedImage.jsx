import { useState, useEffect, memo } from 'react'

/**
 * Composant d'image optimisé avec lazy loading et placeholder
 * Réduit la charge initiale en ne chargeant que les images visibles
 */
export const OptimizedImage = memo(({ 
  src, 
  alt, 
  className = '', 
  priority = false,
  delay = 0,
  onError,
  ...props 
}) => {
  const [shouldLoad, setShouldLoad] = useState(priority)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (priority) {
      setShouldLoad(true)
      return
    }

    // Charger l'image avec un délai pour les images non prioritaires
    const timer = setTimeout(() => {
      setShouldLoad(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [priority, delay])

  const handleLoad = () => {
    setImageLoaded(true)
  }

  const handleError = (e) => {
    setImageError(true)
    if (onError) {
      onError(e)
    }
  }

  if (!src || imageError) {
    return (
      <div className={`bg-gradient-to-br from-surface-muted/40 to-surface-muted/20 flex items-center justify-center ${className}`}>
        <svg className="w-12 h-12 text-muted opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Placeholder pendant le chargement */}
      {!imageLoaded && shouldLoad && (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-muted/40 to-surface-muted/20 animate-pulse" />
      )}
      
      {/* Image réelle */}
      {shouldLoad && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchpriority={priority ? "high" : "low"}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </div>
  )
})

OptimizedImage.displayName = 'OptimizedImage'

