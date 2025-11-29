const CACHE_KEY = 'actoris_patch_notes_cache'
const CACHE_TTL = 1000 * 60 * 10 // 10 minutes

let inMemoryCache = null

const now = () => Date.now()

const getEndpoint = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PATCH_NOTES_URL) {
    return import.meta.env.VITE_PATCH_NOTES_URL
  }
  return '/patch-notes.json'
}

const readPersistentCache = () => {
  if (inMemoryCache) return inMemoryCache
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    inMemoryCache = JSON.parse(raw)
    return inMemoryCache
  } catch (error) {
    console.warn('[PatchNotesService] Impossible de lire le cache:', error)
    return null
  }
}

const writePersistentCache = (payload) => {
  inMemoryCache = payload
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('[PatchNotesService] Impossible d\'écrire le cache:', error)
  }
}

const needsRefresh = (cacheEntry) => {
  if (!cacheEntry || !cacheEntry.timestamp) return true
  return now() - cacheEntry.timestamp > CACHE_TTL
}

const fetchRemotePatchNotes = async () => {
  const endpoint = getEndpoint()
  const response = await fetch(`${endpoint}?t=${now()}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

const normalizeData = (data) => ({
  latestVersion: data?.latestVersion || null,
  releaseDate: data?.releaseDate || null,
  highlights: data?.highlights || [],
  notes: data?.notes || [],
  downloads: data?.downloads || {},
  history: data?.history || [],
})

export const patchNotesService = {
  async getLatest(force = false) {
    const cacheEntry = readPersistentCache()
    if (!force && cacheEntry && !needsRefresh(cacheEntry)) {
      return cacheEntry.data
    }

    const remoteData = normalizeData(await fetchRemotePatchNotes())
    writePersistentCache({ timestamp: now(), data: remoteData })
    return remoteData
  },

  async getHistory(force = false) {
    const latest = await this.getLatest(force)
    return latest?.history || []
  },

  async getNotes(version = null) {
    // Si une version spécifique est demandée, on peut l'extraire de l'historique
    // Pour l'instant, on retourne les notes de la dernière version
    const latest = await this.getLatest()
    if (version) {
      // Chercher dans l'historique si disponible
      const history = latest?.history || []
      const versionNotes = history.find(item => {
        const itemVersion = item.version || item.tag_name || ''
        return itemVersion.includes(version) || version.includes(itemVersion)
      })
      if (versionNotes) {
        return versionNotes.notes || versionNotes.body || []
      }
    }
    // Retourner les notes de la dernière version par défaut
    return latest?.notes || []
  },

  clearCache() {
    inMemoryCache = null
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CACHE_KEY)
      } catch (error) {
        console.warn('[PatchNotesService] Impossible de nettoyer le cache:', error)
      }
    }
  }
}
