/**
 * Module de logging optimisé pour dev & prod
 */

const LOG_LEVELS = {
  ERROR: 0,   // Toujours logué
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

// En dev : logs complets, en prod : seulement erreurs
const CURRENT_LOG_LEVEL = (process.env.NODE_ENV === 'development' || process.env.ENABLE_LOGS === 'true')
  ? LOG_LEVELS.DEBUG
  : LOG_LEVELS.ERROR

function baseLog(level, ...args) {
  if (level > CURRENT_LOG_LEVEL) return
  const prefixMap = {
    [LOG_LEVELS.ERROR]: '[ERROR]',
    [LOG_LEVELS.WARN]: '[WARN]',
    [LOG_LEVELS.INFO]: '[INFO]',
    [LOG_LEVELS.DEBUG]: '[DEBUG]',
  }
  const prefix = prefixMap[level] || '[LOG]'
  // Utiliser console.error pour ERROR, console.log pour le reste
  if (level === LOG_LEVELS.ERROR) {
    console.error(prefix, ...args)
  } else {
  }
}

// Compatibilité avec tous les anciens appels: log('message') / log('a', 'b', ...)
// ET nouveau style: log(LOG_LEVELS.DEBUG, 'message détaillé')
export function log(...args) {
  if (!args.length) return
  if (typeof args[0] === 'number' && Object.values(LOG_LEVELS).includes(args[0])) {
    const [level, ...rest] = args
    baseLog(level, ...rest)
  } else {
    baseLog(LOG_LEVELS.INFO, ...args)
  }
}

export function errorLog(...args) { 
  baseLog(LOG_LEVELS.ERROR, ...args)
}

export function warnLog(...args) {
  baseLog(LOG_LEVELS.WARN, ...args)
}

export function debugLog(...args) {
  baseLog(LOG_LEVELS.DEBUG, ...args)
}

export { LOG_LEVELS }
