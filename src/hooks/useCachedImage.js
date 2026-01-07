import { useEffect, useState, useRef } from 'react'
import { getCachedImage } from '../services/imageCache'

export function useCachedImage(url) {
  const [cachedSrc, setCachedSrc] = useState(null)
  const loadingRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    if (!url) {
      setCachedSrc(null)
      return undefined
    }

    // Si on a déjà une URL en cache, l'utiliser immédiatement
    // et charger en arrière-plan pour mettre à jour si nécessaire
    if (loadingRef.current) return undefined
    
    loadingRef.current = true
    
    // Utiliser l'URL originale immédiatement pendant le chargement du cache
    // pour éviter le flash blanc
    setCachedSrc(url)
    
    getCachedImage(url)
      .then(result => {
        if (isMounted && result) {
          // Mettre à jour avec l'URL du cache si disponible
          setCachedSrc(result)
        }
      })
      .catch(() => {
        // En cas d'erreur, garder l'URL originale
        if (isMounted) {
          setCachedSrc(url)
        }
      })
      .finally(() => {
        loadingRef.current = false
      })

    return () => {
      isMounted = false
    }
  }, [url])

  // Toujours retourner une URL (originale ou cache) pour affichage immédiat
  return cachedSrc || url
}



