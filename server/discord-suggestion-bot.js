/**
 * Bot Discord pour envoyer des suggestions avec boutons interactifs
 * Utilise discord.js pour envoyer des messages avec des composants
 */

import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

const ADMIN_ID = '1332076547422683268'
const CHANNEL_ID = '1407780886497464471'
let discordClient = null
let isReady = false
let readyPromise = null // Promesse qui se résout quand le bot est prêt

/**
 * Initialise le bot Discord
 */
export async function initDiscordBot() {
  try {
    // Vérifier le token (logs désactivés)
    const token = process.env.DISCORD_TOKEN
    if (!token) {
      return false
    }
    
    // Vérifier que le token n'a pas d'espaces
    if (token !== token.trim()) {
      return false
    }

    // Si déjà connecté et prêt, retourner immédiatement
    if (discordClient && isReady) {
      const botReady = typeof discordClient.isReady === 'function' ? discordClient.isReady() : isReady
      if (botReady) {
        return true
      }
    }

    // Si le client existe mais n'est pas prêt, attendre un peu
    if (discordClient && !isReady) {
      try {
        await waitForBotReady(15000) // Attendre 15 secondes
        return true
      } catch (err) {
        // Détruire l'ancien client et en créer un nouveau
        try {
          discordClient.destroy()
        } catch (e) {
          // Ignorer les erreurs de destruction
        }
        discordClient = null
        isReady = false
        readyPromise = null
      }
    }

    // Logs désactivés - initialisation silencieuse
    
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    })

    // Créer une promesse qui se résout quand le bot est prêt
    readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Le bot n\'a pas répondu dans les 30 secondes'))
      }, 30000)

      discordClient.once('ready', () => {
        clearTimeout(timeout)
        // Logs désactivés
        isReady = true
        setupInteractionHandler()
        resolve(true)
      })

      discordClient.once('error', (error) => {
        clearTimeout(timeout)
        // Logs désactivés
        isReady = false
        reject(error)
      })
      
      // Écouter aussi les erreurs de rate limit (logs désactivés)
      discordClient.on('rateLimit', (rateLimitInfo) => {
        // Logs désactivés
      })
    })

    discordClient.on('error', (error) => {
      // Logs désactivés
      isReady = false
    })

    // Logs désactivés - connexion silencieuse
    
    try {
      await discordClient.login(token)
      
      // Attendre que le bot soit prêt (avec timeout)
      try {
        await readyPromise
        return true
      } catch (error) {
        // Logs désactivés
        return false
      }
    } catch (loginError) {
      // Logs désactivés
      return false
    }
  } catch (error) {
    // Logs désactivés
    isReady = false
    readyPromise = null
    return false
  }
}

/**
 * Vérifie si un utilisateur est admin
 */
function isAdmin(userId) {
  return userId === ADMIN_ID
}

/**
 * Envoie une suggestion avec embed et boutons via le bot Discord
 */
/**
 * Attend que le bot soit prêt (avec timeout)
 */
async function waitForBotReady(timeout = 20000) {
  if (!discordClient) {
    throw new Error('Bot Discord non initialisé')
  }
  
  // Si déjà prêt, retourner immédiatement
  const botReady = typeof discordClient.isReady === 'function' ? discordClient.isReady() : isReady
  if (botReady) {
    return true
  }
  
  // Logs désactivés
  
  // Attendre que la promesse ready se résolve (avec timeout)
  if (readyPromise) {
    try {
      await Promise.race([
        readyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ])
      return true
    } catch (error) {
      if (error.message === 'Timeout') {
        throw new Error('Le bot Discord met trop de temps à se connecter. Vérifiez le token et la connexion.')
      }
      throw error
    }
  }
  
  // Si pas de promesse, vérifier périodiquement pendant le timeout
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const currentReady = typeof discordClient.isReady === 'function' ? discordClient.isReady() : isReady
    if (currentReady) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 500)) // Attendre 500ms entre les vérifications
  }
  
  throw new Error('Bot Discord non prêt après ' + timeout + 'ms')
}

export async function sendSuggestionWithBot(suggestionData) {
  try {
    // Vérifier si le bot est initialisé
    if (!discordClient) {
      return { success: false, error: 'Bot Discord non initialisé. Le bot doit être connecté pour envoyer des suggestions.' }
    }
    
    // Attendre que le bot soit prêt (avec timeout de 20 secondes)
    try {
      await waitForBotReady(20000)
    } catch (waitError) {
      // Logs désactivés
      return { success: false, error: waitError.message || 'Bot Discord non prêt' }
    }

    const channel = await discordClient.channels.fetch(CHANNEL_ID)
    if (!channel) {
      return { success: false, error: 'Channel Discord introuvable' }
    }

    // Extraire l'image Steam si l'URL est fournie
    let gameImage = null
    if (suggestionData.gameUrl && suggestionData.gameUrl.includes('steam')) {
      const appIdMatch = suggestionData.gameUrl.match(/app\/(\d+)/)
      if (appIdMatch) {
        const appId = appIdMatch[1]
        gameImage = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
      }
    }

    // Créer l'embed
    const suggestionId = `suggestion_${Date.now()}`
    const embed = new EmbedBuilder()
      .setTitle('✨ NOUVELLE SUGGESTION')
      .setDescription(`**${suggestionData.gameName}**\n\n${suggestionData.description}`)
      .setColor(0xFFD700) // Or/Jaune
      .addFields(
        {
          name: '👤 Suggeré par',
          value: suggestionData.username,
          inline: true
        },
        {
          name: '🕐 Créé le',
          value: new Date(suggestionData.timestamp).toLocaleString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          inline: true
        }
      )
      .setFooter({
        text: `ID: ${suggestionId} • Actoris Launcher`,
        iconURL: 'https://cdn.discordapp.com/attachments/1414273368114597951/1416549238740881580/e452d9373bf3f6080a53a7ec90e64ea1'
      })
      .setTimestamp(new Date(suggestionData.timestamp))

    // Ajouter l'image si disponible
    if (gameImage) {
      embed.setImage(gameImage)
    }

    // Ajouter le lien Steam si fourni
    if (suggestionData.gameUrl) {
      embed.addFields({
        name: '🔗 Lien Steam',
        value: `[Cliquez ici pour voir le jeu](${suggestionData.gameUrl})`,
        inline: false
      })
    }

    // Créer les boutons
    const acceptButton = new ButtonBuilder()
      .setCustomId(`suggestion_accept_${suggestionId}`)
      .setLabel('Accepter')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')

    const rejectButton = new ButtonBuilder()
      .setCustomId(`suggestion_reject_${suggestionId}`)
      .setLabel('Refuser')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('❌')

    const row = new ActionRowBuilder()
      .addComponents(acceptButton, rejectButton)

    // Envoyer le message
    const message = await channel.send({
      embeds: [embed],
      components: [row]
    })

    return {
      success: true,
      messageId: message.id,
      suggestionId: suggestionId
    }
  } catch (error) {
    // Logs désactivés
    return { success: false, error: error.message }
  }
}

/**
 * Configure le handler d'interactions
 */
function setupInteractionHandler() {
  if (!discordClient) return

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return

    const { customId, user, message } = interaction

    if (customId.startsWith('suggestion_accept_') || customId.startsWith('suggestion_reject_')) {
      // Vérifier si l'utilisateur est admin
      if (!isAdmin(user.id)) {
        await interaction.reply({
          content: '❌ Seuls les administrateurs peuvent accepter ou refuser des suggestions.',
          ephemeral: true
        })
        return
      }

      const isAccept = customId.startsWith('suggestion_accept_')
      const action = isAccept ? 'acceptée' : 'refusée'
      const color = isAccept ? 0x00FF00 : 0xFF0000
      const emoji = isAccept ? '✅' : '❌'

      try {
        // Mettre à jour l'embed
        const originalEmbed = message.embeds[0]
        if (!originalEmbed) {
          await interaction.reply({ content: '❌ Erreur: embed introuvable', ephemeral: true })
          return
        }

        const updatedEmbed = EmbedBuilder.from(originalEmbed)
          .setTitle(`${emoji} Suggestion ${action.toUpperCase()}`)
          .setColor(color)
          .addFields({
            name: '👮 Modéré par',
            value: `${user.username} (${user.id})`,
            inline: false
          })
          .setFooter({
            text: `${originalEmbed.footer?.text || ''} • ${action} le ${new Date().toLocaleString('fr-FR')}`,
            iconURL: originalEmbed.footer?.iconURL
          })

        // Désactiver les boutons
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('suggestion_accept_disabled')
              .setLabel('Accepter')
              .setStyle(ButtonStyle.Success)
              .setEmoji('✅')
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('suggestion_reject_disabled')
              .setLabel('Refuser')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('❌')
              .setDisabled(true)
          )

        await interaction.update({
          embeds: [updatedEmbed],
          components: [disabledRow]
        })

        await interaction.followUp({
          content: `${emoji} La suggestion a été ${action} par ${user.username}`,
          ephemeral: false
        })

        // Logs désactivés
      } catch (error) {
        // Logs désactivés
        await interaction.reply({
          content: '❌ Erreur lors de la mise à jour de la suggestion',
          ephemeral: true
        })
      }
    }
  })
}

/**
 * Récupère l'état actuel du bot
 */
export async function getBotStatus() {
  try {
    const botReady = discordClient && (typeof discordClient.isReady === 'function' ? discordClient.isReady() : isReady)
    
    return {
      available: !!discordClient,
      ready: botReady || false,
      isReady: isReady,
      clientReady: discordClient ? (typeof discordClient.isReady === 'function' ? discordClient.isReady() : false) : false,
      user: discordClient?.user ? {
        tag: discordClient.user.tag,
        id: discordClient.user.id
      } : null,
      guilds: discordClient?.guilds ? discordClient.guilds.cache.size : 0,
      status: botReady ? 'ready' : (discordClient ? 'connecting' : 'not_initialized'),
      message: botReady 
        ? 'Bot Discord connecté et prêt' 
        : (discordClient 
          ? 'Bot en cours de connexion...' 
          : 'Bot non initialisé')
    }
  } catch (error) {
    return {
      available: false,
      ready: false,
      status: 'error',
      message: error.message
    }
  }
}

// Initialiser le bot au chargement (logs désactivés)
initDiscordBot().catch(err => {
  // Logs désactivés
})

