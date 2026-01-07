/**
 * Gestionnaire de chargement lazy des services
 */

let githubService = null
let steamService = null
let gamesService = null
let discordService = null
let websocketService = null
let gameExtractor = null
let lockrService = null
let adsService = null
let discordRPCService = null
let imageCacheService = null

export async function getGameExtractor() {
  if (!gameExtractor) {
    gameExtractor = await import('../game-extractor.mjs').catch(() => import('../game-extractor.mjs'))
  }
  return gameExtractor
}

export async function getGithubService() {
  if (!githubService) {
    githubService = await import('../github-service.mjs')
  }
  return githubService
}

export async function getSteamService() {
  if (!steamService) {
    steamService = await import('../steam-service.mjs')
  }
  return steamService
}

export async function getGamesService() {
  if (!gamesService) {
    gamesService = await import('../games-service.mjs').catch(() => import('../games-service.mjs'))
  }
  return gamesService
}

export async function getDiscordService() {
  if (!discordService) {
    const { app } = await import('electron')
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { pathToFileURL } = await import('node:url')
    const { errorLog } = await import('./logger.mjs')
    const { API_URL } = await import('./config.mjs')
    
    const isDev = !app.isPackaged
    
    if (!isDev) {
      const installDir = path.dirname(process.execPath)
      const possiblePaths = [
        path.join(installDir, 'discord-service-secure.js'),
        path.join(__dirname, '../discord-service-secure.js'),
      ]
      
      const servicePath = possiblePaths.find(p => fs.existsSync(p))
      
      if (servicePath) {
        try {
          const fileUrl = pathToFileURL(servicePath).href
          discordService = await import(fileUrl)
        } catch (err) {
          try {
            discordService = await import('../discord-service-secure.mjs')
          } catch (err2) {
            errorLog('[Services] Erreur import depuis asar:', err2.message)
          }
        }
      } else {
        try {
          discordService = await import('../discord-service-secure.mjs')
        } catch (err) {
          errorLog('[Services] discord-service-secure.js non trouvé:', err.message)
        }
      }
    } else {
      try {
        discordService = await import('../discord-service-secure.mjs')
      } catch (err) {
        errorLog('[Services] Erreur import en dev:', err.message)
      }
    }
    
    if (!discordService) {
      try {
        discordService = await import('../discord-service.mjs')
      } catch (err) {
        errorLog('[Services] Impossible de charger le service Discord:', err.message)
      }
    }
    
    if (discordService && discordService.setApiUrl) {
      const apiUrlIPv4 = API_URL.includes('localhost') ? API_URL.replace('localhost', '127.0.0.1') : API_URL
      discordService.setApiUrl(apiUrlIPv4)
    }
  }
  return discordService
}

export async function getWebsocketService() {
  if (!websocketService) {
    websocketService = await import('../websocket-service.mjs')
  }
  return websocketService
}

export async function getAdsService() {
  if (!adsService) {
    adsService = await import('../ads-service.mjs')
  }
  return adsService
}

export async function getLockrService() {
  if (!lockrService) {
    lockrService = await import('../lockr-service.mjs')
  }
  return lockrService
}

export async function getDiscordRPCService() {
  if (!discordRPCService) {
    discordRPCService = await import('../discord-rpc-service.mjs').catch(() => import('../discord-rpc-service.mjs'))
  }
  return discordRPCService
}

export async function getImageCacheService() {
  if (!imageCacheService) {
    imageCacheService = await import('../image-cache-service.mjs')
  }
  return imageCacheService
}
