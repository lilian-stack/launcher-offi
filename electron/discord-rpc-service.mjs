import { Client } from 'discord-rpc'
import { DISCORD_CONFIG } from './discord-config.mjs'

let rpcClient = null
let isConnected = false

/**
 * Initialise et connecte le client Discord RPC
 */
export async function initDiscordRPC() {
  try {
    // Utiliser le CLIENT_ID de la configuration Discord
    const clientId = DISCORD_CONFIG.CLIENT_ID
    
    if (!clientId) {
      console.error('[Discord RPC] CLIENT_ID non configuré')
      return false
    }

    // Créer le client RPC
    rpcClient = new Client({ transport: 'ipc' })
    
    // Gérer les événements
    rpcClient.on('ready', () => {
      isConnected = true
      
      // Définir la présence initiale
      setDiscordPresence({
        details: 'Naviguant dans Actoris',
        state: 'Launcher de jeux',
        largeImageKey: 'actoris-logo', // Clé de l'image uploadée sur Discord Developer Portal
        largeImageText: 'Actoris Launcher',
        smallImageKey: 'actoris-logo',
        smallImageText: 'Actoris',
        startTimestamp: Date.now(),
        buttons: [
          { label: 'Télécharger Actoris', url: 'https://actoris.com' }
        ]
      })
    })

    rpcClient.on('error', (error) => {
      console.error('[Discord RPC] ❌ Erreur:', error)
      isConnected = false
    })

    // Se connecter
    await rpcClient.login({ clientId })
    return true
  } catch (error) {
    console.error('[Discord RPC] ❌ Erreur lors de l\'initialisation:', error.message)
    isConnected = false
    return false
  }
}

/**
 * Définit la présence Discord
 * @param {Object} presence - Objet de présence Discord
 */
export async function setDiscordPresence(presence) {
  if (!rpcClient || !isConnected) {
    console.warn('[Discord RPC] Client non connecté, tentative de connexion...')
    await initDiscordRPC()
    // Attendre un peu pour que la connexion s'établisse
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  if (!rpcClient || !isConnected) {
    console.warn('[Discord RPC] Impossible de définir la présence: client non connecté')
    return false
  }

  try {
    await rpcClient.setActivity({
      details: presence.details || 'Naviguant dans Actoris',
      state: presence.state || 'Launcher de jeux',
      largeImageKey: presence.largeImageKey || 'actoris-logo',
      largeImageText: presence.largeImageText || 'Actoris Launcher',
      smallImageKey: presence.smallImageKey,
      smallImageText: presence.smallImageText,
      startTimestamp: presence.startTimestamp || Date.now(),
      endTimestamp: presence.endTimestamp,
      buttons: presence.buttons || [],
      partyId: presence.partyId,
      partySize: presence.partySize,
      partyMax: presence.partyMax,
      ...presence
    })
    return true
  } catch (error) {
    console.error('[Discord RPC] ❌ Erreur lors de la définition de la présence:', error.message)
    return false
  }
}

/**
 * Met à jour la présence pour un jeu spécifique
 * @param {string} gameName - Nom du jeu
 * @param {string} gameImageKey - Clé de l'image du jeu (optionnel)
 */
export async function setGamePresence(gameName, gameImageKey = null) {
  return await setDiscordPresence({
    details: `Joue à ${gameName}`,
    state: 'En jeu',
    largeImageKey: gameImageKey || 'actoris-logo',
    largeImageText: gameName,
    smallImageKey: 'actoris-logo',
    smallImageText: 'Actoris Launcher',
    startTimestamp: Date.now()
  })
}

/**
 * Réinitialise la présence par défaut
 */
export async function resetPresence() {
  return await setDiscordPresence({
    details: 'Naviguant dans Actoris',
    state: 'Launcher de jeux',
    largeImageKey: 'actoris-logo',
    largeImageText: 'Actoris Launcher',
    smallImageKey: 'actoris-logo',
    smallImageText: 'Actoris',
    startTimestamp: Date.now()
  })
}

/**
 * Déconnecte le client RPC
 */
export async function disconnectDiscordRPC() {
  if (rpcClient && isConnected) {
    try {
      await rpcClient.destroy()
      isConnected = false
      return true
    } catch (error) {
      console.error('[Discord RPC] ❌ Erreur lors de la déconnexion:', error.message)
      return false
    }
  }
  return true
}

/**
 * Vérifie si le client RPC est connecté
 */
export function isDiscordRPCConnected() {
  return isConnected && rpcClient !== null
}

