/**
 * Handlers IPC pour l'authentification Discord
 */
import { ipcMain } from 'electron'
import { getDiscordService } from '../utils/services-loader.js'
import { log, errorLog } from '../utils/logger.js'

let dependencies = {}

export function injectDependencies(deps) {
  dependencies = { ...dependencies, ...deps }
}

export function registerAuthHandlers() {
  ipcMain.handle('discord:refreshToken', async (event, sessionToken) => {
    try {
      const service = await getDiscordService()
      if (service.refreshDiscordToken) {
        const result = await service.refreshDiscordToken(sessionToken)
        return result
      } else {
        return {
          success: false,
          error: 'Service de rafraîchissement non disponible'
        }
      }
    } catch (err) {
      errorLog('discord:refreshToken error', err)
      return {
        success: false,
        error: err.message || 'Erreur lors du rafraîchissement du token'
      }
    }
  })

  ipcMain.handle('discord:logout', async (event, sessionToken) => {
    try {
      const service = await getDiscordService()
      if (service.logout) {
        const result = await service.logout(sessionToken)
        return result
      } else {
        // Fallback : utiliser l'API directement
        const axios = (await import('axios')).default
        const { API_URL } = await import('../utils/config.js')
        const response = await axios.post(`${API_URL}/api/discord/logout`, {
          sessionToken
        })
        return response.data
      }
    } catch (err) {
      errorLog('discord:logout error', err)
      return {
        success: false,
        error: err.message || 'Erreur lors de la déconnexion'
      }
    }
  })
}
