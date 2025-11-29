import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Charger la configuration depuis le fichier ou les variables d'environnement
// Utiliser 127.0.0.1 au lieu de localhost pour éviter les problèmes IPv6
let WS_URL = process.env.WS_URL || 'ws://127.0.0.1:20036'

try {
  const configPath = path.join(__dirname, '../websocket-config.json')
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.wsUrl) {
      WS_URL = config.wsUrl
    }
  }
} catch (error) {
  console.warn('[WebSocket] Impossible de charger websocket-config.json, utilisation de la valeur par défaut')
}
let ws = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 3 // Réduit à 3 tentatives
let reconnectTimeout = null
let isConnecting = false
let isManualDisconnect = false
let lastError = null
let consecutiveRefusedErrors = 0
const MAX_CONSECUTIVE_REFUSED = 2 // Arrêter après 2 erreurs ECONNREFUSED consécutives
let hasReachedLimit = false // Flag pour indiquer qu'on a atteint la limite
let isManualRetry = false // Flag pour distinguer les tentatives manuelles des automatiques

let messageHandlers = []

/**
 * Connecte au serveur WebSocket
 * @param {Function} onMessage - Callback pour les messages reçus
 * @param {Function} onError - Callback pour les erreurs
 * @param {Function} onConnect - Callback pour la connexion réussie
 * @param {Function} onDisconnect - Callback pour la déconnexion
 * @param {boolean} manualRetry - Indique si c'est une tentative manuelle (depuis l'UI)
 */
export function connectWebSocket(onMessage, onError, onConnect, onDisconnect, manualRetry = false) {
  // Si déjà connecté, ne rien faire
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[WebSocket] Déjà connecté')
    return
  }

  // Si une connexion est en cours, ne rien faire
  if (isConnecting) {
    console.log('[WebSocket] Connexion déjà en cours...')
    return
  }

  // Si c'est une tentative manuelle, réinitialiser les compteurs et flags
  if (manualRetry) {
    console.log('[WebSocket] Tentative manuelle de connexion - réinitialisation des compteurs')
    consecutiveRefusedErrors = 0
    reconnectAttempts = 0
    hasReachedLimit = false
    isManualDisconnect = false
    isManualRetry = true
  } else {
    // Si on a atteint la limite et que ce n'est pas une tentative manuelle, vérifier si c'est une nouvelle connexion
    // (pas une reconnexion automatique programmée)
    if (hasReachedLimit && reconnectTimeout !== null) {
      // C'est une reconnexion automatique programmée, on l'annule
      console.log('[WebSocket] Limite atteinte, reconnexion automatique désactivée. Utilisez une tentative manuelle.')
      return
    }
    // Si hasReachedLimit est true mais qu'il n'y a pas de reconnexion programmée,
    // c'est probablement une nouvelle tentative (première connexion ou après un délai)
    // On permet cette tentative mais on ne réinitialise pas hasReachedLimit
    isManualRetry = false
  }

  // Si une reconnexion est programmée, l'annuler
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  // Nettoyer l'ancienne connexion si elle existe
  if (ws) {
    try {
      ws.removeAllListeners()
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close()
      }
    } catch (error) {
      // Ignorer les erreurs de nettoyage
    }
    ws = null
  }

  isConnecting = true
  isManualDisconnect = false
  console.log(`[WebSocket] Connexion à ${WS_URL}...`)
  
  try {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      console.log('[WebSocket] ✅ Connecté au serveur')
      isConnecting = false
      reconnectAttempts = 0
      consecutiveRefusedErrors = 0 // Réinitialiser le compteur en cas de succès
      hasReachedLimit = false // Réinitialiser le flag en cas de succès
      lastError = null
      isManualRetry = false
      if (onConnect) onConnect()
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        console.log('[WebSocket] 📨 Message reçu:', message)
        
        if (onMessage) {
          onMessage(message)
        }
        
        // Notifier tous les handlers
        messageHandlers.forEach(handler => {
          try {
            handler(message)
          } catch (error) {
            console.error('[WebSocket] Erreur dans un handler:', error)
          }
        })
      } catch (error) {
        console.error('[WebSocket] Erreur lors du parsing du message:', error)
      }
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] ❌ Erreur:', error)
      lastError = error
      
      // Détecter les erreurs ECONNREFUSED pour éviter les reconnexions inutiles
      if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('ECONNREFUSED'))) {
        consecutiveRefusedErrors++
        console.warn(`[WebSocket] Erreur de connexion refusée (${consecutiveRefusedErrors}/${MAX_CONSECUTIVE_REFUSED}). Le serveur n'est probablement pas disponible.`)
        
        // Si trop d'erreurs consécutives, arrêter les tentatives de reconnexion automatique
        // mais permettre les reconnexions manuelles
        if (consecutiveRefusedErrors >= MAX_CONSECUTIVE_REFUSED) {
          console.error('[WebSocket] ❌ Trop d\'erreurs de connexion refusée. Arrêt des tentatives de reconnexion automatique.')
          reconnectAttempts = MAX_RECONNECT_ATTEMPTS // Forcer l'arrêt des reconnexions automatiques
          hasReachedLimit = true // Marquer qu'on a atteint la limite
          // Ne pas mettre isManualDisconnect = true ici, pour permettre les reconnexions manuelles
        }
      } else {
        // Réinitialiser le compteur si l'erreur n'est pas ECONNREFUSED
        consecutiveRefusedErrors = 0
      }
      
      if (onError) onError(error)
    })

    ws.on('close', () => {
      console.log('[WebSocket] ❌ Déconnecté')
      isConnecting = false
      if (onDisconnect) onDisconnect()
      
      // Ne pas reconnecter si c'est une déconnexion manuelle
      if (isManualDisconnect) {
        console.log('[WebSocket] Déconnexion manuelle, pas de reconnexion automatique')
        return
      }
      
      // Tentative de reconnexion seulement si pas de déconnexion manuelle, pas trop d'erreurs ECONNREFUSED, et pas de limite atteinte
      if (!hasReachedLimit && !isManualDisconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && consecutiveRefusedErrors < MAX_CONSECUTIVE_REFUSED) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000) // Max 10s au lieu de 30s
        console.log(`[WebSocket] Reconnexion dans ${delay}ms (tentative ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
        
        reconnectTimeout = setTimeout(() => {
          if (!hasReachedLimit && !isManualDisconnect && consecutiveRefusedErrors < MAX_CONSECUTIVE_REFUSED) {
            connectWebSocket(onMessage, onError, onConnect, onDisconnect, false) // Reconnexion automatique
          } else {
            console.warn('[WebSocket] Reconnexion annulée: limite atteinte, déconnexion manuelle ou trop d\'erreurs')
          }
        }, delay)
      } else {
        if (hasReachedLimit || consecutiveRefusedErrors >= MAX_CONSECUTIVE_REFUSED) {
          console.error('[WebSocket] ❌ Arrêt des reconnexions: le serveur n\'est pas disponible (ECONNREFUSED). Utilisez une tentative manuelle.')
          hasReachedLimit = true
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[WebSocket] ❌ Nombre maximum de tentatives de reconnexion atteint')
          hasReachedLimit = true
        }
      }
    })

  } catch (error) {
    console.error('[WebSocket] ❌ Erreur lors de la connexion:', error)
    isConnecting = false
    if (onError) onError(error)
  }
}

/**
 * Déconnecte du serveur WebSocket
 */
export function disconnectWebSocket() {
  isManualDisconnect = true
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  
  if (ws) {
    try {
      ws.removeAllListeners()
      ws.close()
    } catch (error) {
      // Ignorer les erreurs
    }
    ws = null
  }
  
  isConnecting = false
  reconnectAttempts = 0
  consecutiveRefusedErrors = 0
  hasReachedLimit = false
  lastError = null
  isManualRetry = false
  messageHandlers = []
}

/**
 * Envoie un message au serveur WebSocket
 */
export function sendWebSocketMessage(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.error('[WebSocket] ❌ Pas connecté, impossible d\'envoyer le message')
    return false
  }

  try {
    const data = JSON.stringify(message)
    ws.send(data)
    console.log('[WebSocket] 📤 Message envoyé:', message)
    return true
  } catch (error) {
    console.error('[WebSocket] ❌ Erreur lors de l\'envoi:', error)
    return false
  }
}

/**
 * Vérifie si le WebSocket est connecté
 */
export function isWebSocketConnected() {
  return ws && ws.readyState === WebSocket.OPEN
}

/**
 * Ajoute un handler pour les messages
 */
export function addMessageHandler(handler) {
  messageHandlers.push(handler)
  return () => {
    messageHandlers = messageHandlers.filter(h => h !== handler)
  }
}

