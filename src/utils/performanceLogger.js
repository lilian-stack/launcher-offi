/**
 * Logger de performance - Désactive tous les logs en production
 * Utiliser ce logger au lieu de console.log/warn/info/debug
 */

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

// En production, toutes les fonctions sont des no-ops (pas de logs)
// En développement, on peut activer les logs si nécessaire
const ENABLE_LOGS_IN_DEV = false // Mettre à true si besoin de debug

export const perfLog = {
  log: isDevelopment && ENABLE_LOGS_IN_DEV ? console.log.bind(console) : () => {},
  warn: isDevelopment && ENABLE_LOGS_IN_DEV ? console.warn.bind(console) : () => {},
  info: isDevelopment && ENABLE_LOGS_IN_DEV ? console.info.bind(console) : () => {},
  debug: isDevelopment && ENABLE_LOGS_IN_DEV ? console.debug.bind(console) : () => {},
  error: console.error.bind(console), // Toujours garder les erreurs
}

