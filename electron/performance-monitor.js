// Performance monitoring pour le launcher
const { performance } = require('node:perf_hooks')

/**
 * Mesurer les performances d'une fonction
 */
function measurePerformance(name, fn) {
  return async (...args) => {
    const start = performance.now()
    try {
      const result = await fn(...args)
      const end = performance.now()
      const duration = (end - start).toFixed(2)
      
      // Logs désactivés
      return result
    } catch (error) {
      // Logs désactivés
      throw error
    }
  }
}

/**
 * Surveiller l'utilisation mémoire
 */
function startMemoryMonitoring(intervalMs = 60000) {
  const interval = setInterval(() => {
    // Logs désactivés - monitoring silencieux
    // const usage = process.memoryUsage()
    // const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2)
  }, intervalMs)

  return () => clearInterval(interval)
}

/**
 * Mesurer le temps de démarrage
 */
function measureStartupTime() {
  const startTime = performance.now()
  
  return {
    mark: (label) => {
      // Logs désactivés
      // const elapsed = (performance.now() - startTime).toFixed(2)
    },
    finish: () => {
      // Logs désactivés
      // const total = (performance.now() - startTime).toFixed(2)
    }
  }
}

module.exports = {
  measurePerformance,
  startMemoryMonitoring,
  measureStartupTime
}
