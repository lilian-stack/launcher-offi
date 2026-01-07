const imageCache = new Map()

const pendingRequests = new Map()
const MAX_CACHE_SIZE = 500 // Augmenté pour garder plus d'images en cache

function trimCache() {
  if (imageCache.size <= MAX_CACHE_SIZE) return
  
  // Trier par lastAccess pour supprimer les moins récemment utilisées
  const entries = Array.from(imageCache.entries())
    .map(([key, value]) => ({ key, lastAccess: value.lastAccess || 0 }))
    .sort((a, b) => a.lastAccess - b.lastAccess)
  
  const overflow = imageCache.size - MAX_CACHE_SIZE
  entries.slice(0, overflow).forEach(({ key }) => {
    const entry = imageCache.get(key)
    if (entry?.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl)
    }
    imageCache.delete(key)
  })
}

async function fetchImage(url) {
  if (!url) return null

  if (imageCache.has(url)) {
    const cached = imageCache.get(url)
    cached.lastAccess = Date.now()
    return cached.objectUrl || cached.url
  }

  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)
  }

  const request = fetch(url)
    .then(async response => {
      if (!response.ok) throw new Error('Image fetch failed')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      imageCache.set(url, { objectUrl, lastAccess: Date.now() })
      trimCache()
      pendingRequests.delete(url)
      return objectUrl
    })
    .catch(() => {
      pendingRequests.delete(url)
      return url // fallback to original url
    })

  pendingRequests.set(url, request)
  return request
}

export async function getCachedImage(url) {
  return fetchImage(url)
}

export function clearImageCache() {
  imageCache.forEach(entry => {
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
  })
  imageCache.clear()
  pendingRequests.clear()
}



