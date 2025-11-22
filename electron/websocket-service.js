import WebSocket from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Charger la configuration depuis le fichier ou les variables d'environnement
let WS_URL = process.env.WS_URL || 'ws://localhost:8080'

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
const MAX_RECONNECT_ATTEMPTS = 5
let reconnectTimeout = null
let isConnecting = false
let isManualDisconnect = false

let messageHandlers = []

/**
 * Connecte au serveur WebSocket
 */
export function connectWebSocket(onMessage, onError, onConnect, onDisconnect) {
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
      
      // Tentative de reconnexion seulement si pas de déconnexion manuelle
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
        console.log(`[WebSocket] Reconnexion dans ${delay}ms (tentative ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`)
        
        reconnectTimeout = setTimeout(() => {
          if (!isManualDisconnect) {
            connectWebSocket(onMessage, onError, onConnect, onDisconnect)
          }
        }, delay)
      } else {
        console.error('[WebSocket] ❌ Nombre maximum de tentatives de reconnexion atteint')
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

