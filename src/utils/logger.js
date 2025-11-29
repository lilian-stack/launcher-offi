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

// Niveau de log en production : seulement ERROR et WARN
// En développement : tout
const currentLogLevel = isProd ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG

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
      console.log(...this._formatMessage(LOG_LEVELS.DEBUG, message, ...args))
    }
  }

  info(message, ...args) {
    if (this._shouldLog(LOG_LEVELS.INFO)) {
      console.log(...this._formatMessage(LOG_LEVELS.INFO, message, ...args))
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

