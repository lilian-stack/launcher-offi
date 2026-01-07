/**
 * Système de lazy loading intelligent avec préchargement prédictif
 * OPTIMISATION EXPERT : Charge les modules avant qu'ils soient nécessaires
 */

class LazyLoader {
  constructor() {
    this.loadedModules = new Map()
    this.loadingPromises = new Map()
    this.preloadQueue = new Set()
    this.intersectionObserver = null
    this.idleCallback = null
    this.setupIntersectionObserver()
  }

  setupIntersectionObserver() {
    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const moduleName = entry.target.dataset.preload
              if (moduleName) {
                this.preloadModule(moduleName)
              }
            }
          })
        },
        { rootMargin: '50px' }
      )
    }
  }

  /**
   * Charge un module de manière lazy avec cache
   */
  async loadModule(importFn, moduleName) {
    // Vérifier le cache
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName)
    }

    // Vérifier si déjà en cours de chargement
    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName)
    }

    // Créer la promesse de chargement
    const loadingPromise = this.performLoad(importFn, moduleName)
    this.loadingPromises.set(moduleName, loadingPromise)

    try {
      const module = await loadingPromise
      this.loadedModules.set(moduleName, module)
      this.loadingPromises.delete(moduleName)
      return module
    } catch (error) {
      this.loadingPromises.delete(moduleName)
      throw error
    }
  }

  async performLoad(importFn, moduleName) {
    const start = performance.now()
    
    try {
      const module = await importFn()
      const end = performance.now()
      
      console.log(`[LazyLoader] Loaded ${moduleName} in ${(end - start).toFixed(2)}ms`)
      return module
    } catch (error) {
      console.error(`[LazyLoader] Failed to load ${moduleName}:`, error)
      throw error
    }
  }

  /**
   * Précharge un module pendant les temps d'inactivité
   */
  preloadModule(moduleName, importFn) {
    if (this.loadedModules.has(moduleName) || this.loadingPromises.has(moduleName)) {
      return
    }

    this.preloadQueue.add({ moduleName, importFn })
    this.schedulePreload()
  }

  schedulePreload() {
    if (this.idleCallback) return

    if (typeof requestIdleCallback !== 'undefined') {
      this.idleCallback = requestIdleCallback(() => {
        this.processPreloadQueue()
        this.idleCallback = null
      }, { timeout: 1000 })
    } else {
      // Fallback pour les navigateurs sans requestIdleCallback
      setTimeout(() => {
        this.processPreloadQueue()
        this.idleCallback = null
      }, 100)
    }
  }

  async processPreloadQueue() {
    const batch = Array.from(this.preloadQueue).slice(0, 3) // Traiter 3 modules max par batch
    
    for (const { moduleName, importFn } of batch) {
      try {
        await this.loadModule(importFn, moduleName)
        this.preloadQueue.delete({ moduleName, importFn })
      } catch (error) {
        console.warn(`[LazyLoader] Preload failed for ${moduleName}:`, error)
      }
    }

    // Continuer si il reste des modules
    if (this.preloadQueue.size > 0) {
      this.schedulePreload()
    }
  }

  /**
   * Observe un élément pour le préchargement
   */
  observeForPreload(element, moduleName) {
    if (this.intersectionObserver && element) {
      element.dataset.preload = moduleName
      this.intersectionObserver.observe(element)
    }
  }

  /**
   * Arrête l'observation d'un élément
   */
  unobserve(element) {
    if (this.intersectionObserver && element) {
      this.intersectionObserver.unobserve(element)
    }
  }

  /**
   * Précharge les modules critiques
   */
  preloadCriticalModules() {
    const criticalModules = [
      {
        name: 'GameCard',
        loader: () => import('../components/GameCard')
      },
      {
        name: 'VirtualizedGameGrid', 
        loader: () => import('../components/VirtualizedGameGrid')
      },
      {
        name: 'Motion',
        loader: () => import('../components/Motion')
      }
    ]

    criticalModules.forEach(({ name, loader }) => {
      this.preloadModule(name, loader)
    })
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
    }
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback)
    }
    this.loadedModules.clear()
    this.loadingPromises.clear()
    this.preloadQueue.clear()
  }

  /**
   * Statistiques de chargement
   */
  getStats() {
    return {
      loadedModules: this.loadedModules.size,
      loadingPromises: this.loadingPromises.size,
      preloadQueue: this.preloadQueue.size,
      moduleNames: Array.from(this.loadedModules.keys())
    }
  }
}

// Instance globale
export const lazyLoader = new LazyLoader()

/**
 * Hook React pour le lazy loading avec préchargement
 */
export function useLazyModule(importFn, moduleName, options = {}) {
  const { preload = false, critical = false } = options
  const [module, setModule] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    if (critical) {
      // Charger immédiatement les modules critiques
      loadModule()
    } else if (preload) {
      // Précharger pendant les temps d'inactivité
      lazyLoader.preloadModule(moduleName, importFn)
    }
  }, [importFn, moduleName, critical, preload])

  const loadModule = React.useCallback(async () => {
    if (module) return module

    setLoading(true)
    setError(null)

    try {
      const loadedModule = await lazyLoader.loadModule(importFn, moduleName)
      setModule(loadedModule)
      return loadedModule
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [importFn, moduleName, module])

  return { module, loading, error, loadModule }
}

/**
 * HOC pour le lazy loading de composants
 */
export function withLazyLoading(importFn, moduleName, fallback = null) {
  return React.lazy(async () => {
    const module = await lazyLoader.loadModule(importFn, moduleName)
    return module
  })
}