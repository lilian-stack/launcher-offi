// Service pour envoyer des webhooks Discord
import https from 'https'

// Variable de contrôle pour désactiver temporairement les webhooks de nouveautés
// FORCER LA DÉSACTIVATION TEMPORAIRE
const DISABLE_NEWS_WEBHOOK = true // Forcé à true pour désactiver temporairement

// Webhook pour les liens morts (salon #liens-non-fonctionnel)
// ID du salon: 1452758243762897026
const DEAD_LINK_WEBHOOK_URL = process.env.DISCORD_DEAD_LINK_WEBHOOK_URL || 'https://discord.com/api/webhooks/1452758100636471327/3qlU4NL03sv3Kk_hw7gQgTsCjrjI5xfdzMxUk4DlTBj3CJkZh-vRS-eyhniaCMv0aRvP'

// Webhook général (pour les nouveaux jeux, etc.)
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1416549238740881580/OFKKm-SFHB66ZFThrI8vTQIFMSm2nW30uYeoX7h_7bLZuxQWpWgxeJEHOG_-egHlOcBw'

// Webhook pour les nouveautés (liens remis à jour / reupload) - TEMPORAIREMENT DÉSACTIVÉ
const NEWS_WEBHOOK_URL = process.env.DISCORD_NEWS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1416549238740881580/OFKKm-SFHB66ZFThrI8vTQIFMSm2nW30uYeoX7h_7bLZuxQWpWgxeJEHOG_-egHlOcBw'

/**
 * Envoie un webhook Discord avec un embed et des composants (boutons)
 * @param {Object} embedData - Données de l'embed (title, description, color, thumbnail, etc.)
 * @param {Array} components - Composants Discord (boutons, etc.) - optionnel
 * @returns {Promise<{success: boolean, error?: string, messageId?: string}>}
 */
export async function sendDiscordWebhook(embedData, components = null) {
  return new Promise((resolve, reject) => {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('TON_WEBHOOK_URL')) {
      console.warn('[Discord Webhook] ⚠️ URL de webhook non configurée')
      resolve({ success: false, error: 'Webhook URL non configurée' })
      return
    }

    try {
      const url = new URL(WEBHOOK_URL)
      
      const payload = {
        embeds: [embedData]
      }

      // Ajouter les composants (boutons) si fournis
      // IMPORTANT: Les webhooks Discord supportent les composants depuis 2021
      if (components && Array.isArray(components) && components.length > 0) {
        payload.components = components
      } else {
        console.log('[Discord Webhook] ⚠️ Aucun composant fourni')
      }

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // Timeout de 10 secondes
      }

      const req = https.request(options, (res) => {
        let body = ''

        res.on('data', (chunk) => {
          body += chunk
        })

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const responseData = body ? JSON.parse(body) : {}
              resolve({ success: true, messageId: responseData.id })
            } catch (e) {
              resolve({ success: true })
            }
          } else {
            const error = body ? (() => {
              try {
                return JSON.parse(body)
              } catch {
                return { message: body }
              }
            })() : { message: `HTTP ${res.statusCode}` }
            console.error('[Discord Webhook] ❌ Erreur HTTP:', res.statusCode, error)
            console.error('[Discord Webhook] ❌ Réponse complète:', body)
            resolve({ success: false, error: error.message || `HTTP ${res.statusCode}` })
          }
        })
      })

      req.on('error', (error) => {
        console.error('[Discord Webhook] ❌ Erreur réseau:', error.message)
        resolve({ success: false, error: error.message })
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[Discord Webhook] ❌ Timeout')
        resolve({ success: false, error: 'Timeout' })
      })

      // Ajouter un timeout global
      const timeout = setTimeout(() => {
        req.destroy()
        resolve({ success: false, error: 'Timeout' })
      }, 10000)

      req.on('close', () => {
        clearTimeout(timeout)
      })

      req.write(JSON.stringify(payload))
      req.end()
    } catch (error) {
      console.error('[Discord Webhook] ❌ Erreur:', error.message)
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Envoie une notification Discord pour un lien de téléchargement mort
 * @param {string} gameName - Nom du jeu
 * @param {string} errorMessage - Message d'erreur
 * @param {string|null} gameId - ID du jeu (optionnel)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function notifyDeadLink(gameName, errorMessage, gameId = null) {
  console.log('[Discord Webhook] 📤 notifyDeadLink appelé:', { gameName, errorMessage, gameId })
  return new Promise((resolve) => {
    try {
      if (!DEAD_LINK_WEBHOOK_URL || DEAD_LINK_WEBHOOK_URL.includes('TON_WEBHOOK_URL')) {
        console.warn('[Discord Webhook] ⚠️ URL de webhook pour liens morts non configurée')
        resolve({ success: false, error: 'Webhook URL non configurée' })
        return
      }
      
      console.log('[Discord Webhook] ✅ URL webhook configurée:', DEAD_LINK_WEBHOOK_URL.substring(0, 50) + '...')

      const formattedError = errorMessage || 'Lien non fonctionnel'
      const errorType = formattedError.toLowerCase().includes('404') ? '404 - Not Found' :
                        formattedError.toLowerCase().includes('timeout') ? 'Timeout' :
                        formattedError.toLowerCase().includes('connection') ? 'Erreur de connexion' :
                        formattedError.toLowerCase().includes('interrupted') ? 'Téléchargement interrompu' :
                        'Erreur inconnue'

      // Couleur selon le type d'erreur
      const errorColor = formattedError.toLowerCase().includes('404') ? 16711680 : // Rouge vif
                         formattedError.toLowerCase().includes('timeout') ? 16776960 : // Jaune
                         formattedError.toLowerCase().includes('connection') ? 16753920 : // Orange
                         15158332 // Rouge par défaut

      const now = new Date()
      const dateStr = now.toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const embed = {
        title: `🎮 ${gameName}`,
        description: `Un utilisateur a rencontré un problème lors du téléchargement de **${gameName}**.`,
        color: errorColor,
        fields: [
          {
            name: '📋 Type d\'erreur',
            value: `\`${errorType}\``,
            inline: true
          },
          {
            name: '🕐 Date',
            value: dateStr,
            inline: true
          },
          {
            name: '🆔 Game ID',
            value: gameId ? `\`${gameId}\`` : 'N/A',
            inline: true
          },
          {
            name: '💬 Message d\'erreur',
            value: formattedError.length > 1024 ? 
              `\`\`\`${formattedError.substring(0, 1021)}...\`\`\`` : 
              `\`\`\`${formattedError}\`\`\``,
            inline: false
          }
        ],
        footer: {
          text: 'Actoris Launcher • Système de détection automatique'
        },
        timestamp: now.toISOString()
      }

      const payload = {
        content: `🔴 **Lien de téléchargement mort détecté**`,
        embeds: [embed]
      }

      const url = new URL(DEAD_LINK_WEBHOOK_URL)
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }

      console.log('[Discord Webhook] 📡 Envoi de la requête HTTP...', {
        hostname: options.hostname,
        path: options.path,
        method: options.method
      })
      
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          console.log('[Discord Webhook] 📥 Réponse reçue:', {
            statusCode: res.statusCode,
            headers: res.headers,
            bodyLength: body.length
          })
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[Discord Webhook] ✅ Webhook lien mort envoyé avec succès pour:', gameName)
            console.log('[Discord Webhook] 📋 Réponse complète:', body)
            resolve({ success: true })
          } else {
            console.error('[Discord Webhook] ❌ Erreur HTTP:', res.statusCode)
            console.error('[Discord Webhook] ❌ Corps de la réponse:', body)
            resolve({ success: false, error: `HTTP ${res.statusCode}` })
          }
        })
      })

      req.on('error', (error) => {
        console.error('[Discord Webhook] ❌ Erreur réseau:', error.message)
        resolve({ success: false, error: error.message })
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[Discord Webhook] ❌ Timeout')
        resolve({ success: false, error: 'Timeout' })
      })

      req.write(JSON.stringify(payload))
      req.end()
    } catch (error) {
      console.error('[Discord Webhook] ❌ Erreur lors de l\'envoi du webhook pour lien mort:', error)
      resolve({ success: false, error: error.message })
    }
  })
}

/**
 * Envoie une notification lorsqu'un nouveau jeu est ajouté
 * @param {Object} gameData - Données du jeu (title, description, header_image, etc.)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function notifyGameAdded(gameData) {
  try {
    // Vérifier si les webhooks de nouveautés sont désactivés
    if (DISABLE_NEWS_WEBHOOK) {
      console.log('[Discord Webhook] ⏸️ Webhook de nouveautés temporairement désactivé pour:', gameData.title || gameData.name)
      return { success: true, disabled: true, message: 'Webhook temporairement désactivé' }
    }

    const gameName = gameData.title || gameData.name || 'Jeu sans nom'
    const gameDescription = gameData.short_description || gameData.shortDescription || 'Aucune description disponible'
    const gameImage = gameData.header_image || gameData.coverImage || gameData.cover_image || null
    
    // Limiter la description à 200 caractères pour l'embed Discord
    const truncatedDescription = gameDescription.length > 200 
      ? gameDescription.substring(0, 197) + '...' 
      : gameDescription

    const embed = {
      title: `🎮 Nouveau jeu ajouté : ${gameName}`,
      description: truncatedDescription,
      color: 5814783, // Couleur violette (en décimal)
      image: gameImage ? { url: gameImage } : undefined, // Image en avant (image au lieu de thumbnail)
      footer: { 
        text: 'Ajout automatique • Actoris Launcher',
        icon_url: 'https://cdn.discordapp.com/attachments/1414273368114597951/1416549238740881580/e452d9373bf3f6080a53a7ec90e64ea1'
      },
      timestamp: new Date().toISOString()
    }

    // Ajouter des champs supplémentaires si disponibles
    const fields = []
    
    if (gameData.id) {
      fields.push({
        name: '🆔 ID',
        value: String(gameData.id),
        inline: true
      })
    }
    
    if (gameData.category) {
      fields.push({
        name: '📁 Catégorie',
        value: gameData.category,
        inline: true
      })
    }

    if (gameData.downloadUrl) {
      const urlCount = gameData.downloadUrl.split(/[,\n]/).filter(u => u.trim()).length
      fields.push({
        name: '📥 Téléchargement',
        value: urlCount > 1 ? `${urlCount} parties` : 'Lien direct',
        inline: true
      })
    }

    if (fields.length > 0) {
      embed.fields = fields
    }

    return await sendDiscordWebhook(embed)
  } catch (error) {
    console.error('[Discord Webhook] ❌ Erreur lors de la notification:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envoie une notification lorsqu'un lien de jeu est remis à jour
 * @param {Object} gameData - Données du jeu (id, name, downloadUrl, etc.)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function notifyLinkUpdated(gameData) {
  try {
    // Vérifier si les webhooks de nouveautés sont désactivés
    if (DISABLE_NEWS_WEBHOOK) {
      console.log('[Discord Webhook] ⏸️ Webhook de nouveautés temporairement désactivé pour:', gameData.name || gameData.title)
      return { success: true, disabled: true, message: 'Webhook temporairement désactivé' }
    }

    const gameName = gameData.name || gameData.title || 'Jeu sans nom'
    const gameId = gameData.id || 'N/A'
    const gameImage = gameData.header_image || gameData.coverImage || gameData.cover_image || null
    
    const urlCount = gameData.downloadUrl ? 
      gameData.downloadUrl.split(/[,\n]/).filter(u => u.trim()).length : 0

    const embed = {
      title: `🔄 Lien remis à jour : ${gameName}`,
      description: `Le lien de téléchargement pour **${gameName}** a été mis à jour.`,
      color: 3066993, // Couleur verte (en décimal)
      image: gameImage ? { url: gameImage } : undefined, // Image en avant au lieu de thumbnail
      fields: [
        {
          name: '🆔 ID du jeu',
          value: `\`${gameId}\``,
          inline: true
        },
        {
          name: '📦 Nombre de parties',
          value: urlCount > 1 ? `${urlCount} parties` : 'Lien direct',
          inline: true
        },
        {
          name: '📅 Date de mise à jour',
          value: new Date().toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          inline: true
        }
      ],
      footer: { 
        text: 'Actoris Launcher • Système de gestion des liens',
        icon_url: 'https://cdn.discordapp.com/attachments/1414273368114597951/1416549238740881580/e452d9373bf3f6080a53a7ec90e64ea1'
      },
      timestamp: new Date().toISOString()
    }

    const payload = {
      content: `🆕 **Lien de téléchargement remis à jour !**`,
      embeds: [embed]
    }

    const url = new URL(NEWS_WEBHOOK_URL)
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[Discord Webhook] ✅ Notification de lien remis à jour envoyée pour:', gameName)
            resolve({ success: true })
          } else {
            console.error('[Discord Webhook] ❌ Erreur HTTP:', res.statusCode)
            resolve({ success: false, error: `HTTP ${res.statusCode}` })
          }
        })
      })

      req.on('error', (error) => {
        console.error('[Discord Webhook] ❌ Erreur réseau:', error.message)
        resolve({ success: false, error: error.message })
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[Discord Webhook] ❌ Timeout')
        resolve({ success: false, error: 'Timeout' })
      })

      req.write(JSON.stringify(payload))
      req.end()
    })
  } catch (error) {
    console.error('[Discord Webhook] ❌ Erreur lors de la notification de lien remis à jour:', error)
    return { success: false, error: error.message }
  }
}

