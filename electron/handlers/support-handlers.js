/**
 * Handlers IPC pour le support
 */
import { ipcMain } from 'electron'
import https from 'node:https'
import http from 'node:http'
import { log, errorLog } from '../utils/logger.js'
import { API_URL } from '../utils/config.js'

let dependencies = {}

export function injectDependencies(deps) {
  dependencies = { ...dependencies, ...deps }
}

export function registerSupportHandlers() {
  ipcMain.handle('support:createTicket', async (event, payload) => {
    try {
      const { discord_id, username, message, category } = payload
      const url = `${API_URL}/create-ticket`
      const body = JSON.stringify({ discord_id, username, message, category })
      const urlObj = new URL(url)
      const isHttps = urlObj.protocol === 'https:'
      const httpModule = isHttps ? https : http
      
      return await new Promise((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent': 'Game-Launcher/1.0.23'
          },
        }
        
        const req = httpModule.request(options, (res) => {
          let data = ''
          res.on('data', chunk => data += chunk)
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve({ success: true, ...JSON.parse(data) })
              } catch (e) {
                resolve({ success: true, data })
              }
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`))
            }
          })
        })
        
        req.on('error', reject)
        req.write(body)
        req.end()
      })
    } catch (error) {
      log('support:createTicket error', error)
      return { success: false, error: error.message || 'Erreur lors de la création du ticket' }
    }
  })

  ipcMain.handle('support:submitGameSuggestion', async (event, suggestionData) => {
    try {
      log('[Support] 📤 Envoi d\'une suggestion de jeu vers Discord (via serveur backend)...')
      
      const axios = (await import('axios')).default
      const response = await axios.post(`${API_URL}/api/discord/send-suggestion`, suggestionData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.data && response.data.success) {
        log('[Support] ✅ Suggestion envoyée avec succès via serveur backend')
        return {
          success: true,
          messageId: response.data.messageId,
          suggestionId: response.data.suggestionId
        }
      } else {
        errorLog('[Support] ❌ Échec de l\'envoi de la suggestion:', response.data?.error)
        return {
          success: false,
          error: response.data?.error || 'Erreur lors de l\'envoi'
        }
      }
    } catch (err) {
      errorLog('[Support] ❌ Erreur lors de l\'envoi de la suggestion:', err)
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Erreur inconnue'
      }
    }
  })
}
