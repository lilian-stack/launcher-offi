/**
 * Système de logging professionnel pour l'application
 * Remplace tous les console.log/error/warn par un système centralisé
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
}

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'
const isProd = import.meta.env.PROD || import.meta.env.MODE === 'production'

// Désactiver tous les logs (même en développement pour réduire le bruit)
// Niveau de log : NONE (aucun log)
const currentLogLevel = LOG_LEVELS.NONE

class Logger {
  constructor(context = 'App') {
    this.context = context
  }

  _shouldLog(level) {
    return level >= currentLogLevel
  }

  _formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${this.context}]`
    
    if (args.length > 0) {
      return [prefix, message, ...args]
    }
    return [prefix, message]
  }

  debug(message, ...args) {
    if (this._shouldLog(LOG_LEVELS.DEBUG) && isDev) {
    }
  }

  info(message, ...args) {
    if (this._shouldLog(LOG_LEVELS.INFO)) {
    }
  }

  warn(message, ...args) {
    if (this._shouldLog(LOG_LEVELS.WARN)) {
      console.warn(...this._formatMessage(LOG_LEVELS.WARN, message, ...args))
    }
  }

  error(message, ...args) {
    if (this._shouldLog(LOG_LEVELS.ERROR)) {
      console.error(...this._formatMessage(LOG_LEVELS.ERROR, message, ...args))
    }
  }

  // Méthode pour créer un logger avec un contexte spécifique
  create(context) {
    return new Logger(context)
  }
}

// Export d'une instance par défaut
export const logger = new Logger('App')

// Export de la classe pour créer des loggers personnalisés
export default Logger

