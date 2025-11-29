import { useEffect, useState } from 'react'
import { getCachedImage } from '../services/imageCache'

export function useCachedImage(url) {
  const [cachedSrc, setCachedSrc] = useState(null)

  useEffect(() => {
    let isMounted = true
    if (!url) return undefined

    getCachedImage(url).then(result => {
      if (isMounted) setCachedSrc(result)
    })

    return () => {
      isMounted = false
    }
  }, [url])

  return cachedSrc || url
}



