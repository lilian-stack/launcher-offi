/**
 * Helpers pour les redirections et confirmations Lockr
 */

import https from 'node:https'
import http from 'node:http'
import { USER_AGENT } from './constants.js'

/**
 * Confirme un téléchargement vers redirect.html
 */
export async function confirmDownloadToRedirect(redirectUrl, gameName, gameId, log = () => {}, errorLog = () => {}) {
  try {
    if (!redirectUrl || !redirectUrl.includes('redirect.html')) {
      log('[Confirm] ⚠️ URL de redirection invalide, confirmation ignorée')
      return
    }
    
    log('[Confirm] 📤 Envoi de la confirmation vers redirect.html...')
    log('[Confirm] URL:', redirectUrl)
    log('[Confirm] Jeu:', gameName, gameId ? `(ID: ${gameId})` : '')
    
    // Extraire les paramètres de l'URL originale
    const urlObj = new URL(redirectUrl)
    const gameNameParam = urlObj.searchParams.get('game') || gameName
    const gameIdParam = urlObj.searchParams.get('gameId') || gameId
    const token = urlObj.searchParams.get('token')
    const timestamp = urlObj.searchParams.get('timestamp')
    const userId = urlObj.searchParams.get('userId')
    
    // Construire l'URL de confirmation avec le paramètre confirmed=1
    const confirmUrl = new URL(redirectUrl)
    confirmUrl.searchParams.set('confirmed', '1')
    confirmUrl.searchParams.set('game', gameNameParam)
    if (gameIdParam) confirmUrl.searchParams.set('gameId', gameIdParam)
    if (token) confirmUrl.searchParams.set('token', token)
    if (timestamp) confirmUrl.searchParams.set('timestamp', timestamp)
    if (userId) confirmUrl.searchParams.set('userId', userId)
    
    log('[Confirm] URL de confirmation:', confirmUrl.toString())
    
    // Envoyer une requête GET vers redirect.html
    return new Promise((resolve, reject) => {
      const url = new URL(confirmUrl.toString())
      const client = url.protocol === 'https:' ? https : http
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT
        },
        timeout: 5000
      }
      
      const req = client.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log('[Confirm] ✅ Confirmation envoyée avec succès vers redirect.html')
            resolve()
          } else {
            errorLog('[Confirm] ⚠️ Réponse non-OK:', res.statusCode)
            resolve() // Ne pas rejeter, juste logger
          }
        })
      })
      
      req.on('error', (err) => {
        errorLog('[Confirm] ❌ Erreur lors de l\'envoi de la confirmation:', err.message)
        resolve() // Ne pas rejeter, juste logger
      })
      
      req.on('timeout', () => {
        req.destroy()
        errorLog('[Confirm] ⚠️ Timeout lors de l\'envoi de la confirmation')
        resolve() // Ne pas rejeter, juste logger
      })
      
      req.end()
    })
  } catch (err) {
    errorLog('[Confirm] ❌ Erreur lors de la confirmation:', err)
  }
}
