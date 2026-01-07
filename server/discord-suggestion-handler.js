/**
 * Gestionnaire Discord pour les suggestions de jeux avec boutons interactifs
 * Utilise discord.js pour envoyer des messages avec des composants interactifs
 */

import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

const ADMIN_ID = '1332076547422683268'
let discordClient = null
let isReady = false

/**
 * Initialise le client Discord bot
 */
export async function initDiscordBot() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      console.warn('[Discord Bot] ⚠️ DISCORD_TOKEN non configuré, les boutons interactifs ne seront pas disponibles')
      return false
    }

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    })

    discordClient.once('ready', () => {
      isReady = true
    })

    discordClient.on('error', (error) => {
      console.error('[Discord Bot] ❌ Erreur:', error)
      isReady = false
    })

    await discordClient.login(process.env.DISCORD_TOKEN)
    return true
  } catch (error) {
    console.error('[Discord Bot] ❌ Erreur lors de l\'initialisation:', error.message)
    isReady = false
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
 * Envoie une suggestion de jeu avec embed et boutons interactifs
 */
export async function sendGameSuggestionWithButtons(suggestionData, channelId = '1407780886497464471') {
  try {
    if (!isReady || !discordClient) {
      console.warn('[Discord Bot] ⚠️ Bot non prêt, utilisation du webhook simple')
      return { success: false, error: 'Bot Discord non disponible' }
    }

    const channel = await discordClient.channels.fetch(channelId)
    if (!channel) {
      return { success: false, error: 'Channel Discord introuvable' }
    }

    // Créer l'embed
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
        text: `ID: suggestion_${Date.now()} • Actoris Launcher`,
        iconURL: 'https://cdn.discordapp.com/attachments/1414273368114597951/1416549238740881580/e452d9373bf3f6080a53a7ec90e64ea1'
      })
      .setTimestamp(new Date(suggestionData.timestamp))

    // Ajouter le lien Steam si fourni
    if (suggestionData.gameUrl) {
      embed.addFields({
        name: '🔗 Lien Steam',
        value: `[Cliquez ici pour voir le jeu](${suggestionData.gameUrl})`,
        inline: false
      })
    }

    // Ajouter l'image si disponible (depuis Steam ou autre source)
    if (suggestionData.gameImage) {
      embed.setImage(suggestionData.gameImage)
    } else if (suggestionData.gameUrl && suggestionData.gameUrl.includes('steam')) {
      // Essayer d'extraire l'appid et récupérer l'image Steam
      const appIdMatch = suggestionData.gameUrl.match(/app\/(\d+)/)
      if (appIdMatch) {
        const appId = appIdMatch[1]
        embed.setImage(`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`)
      }
    }

    // Créer les boutons interactifs
    const acceptButton = new ButtonBuilder()
      .setCustomId(`suggestion_accept_${Date.now()}`)
      .setLabel('Accepter')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')

    const rejectButton = new ButtonBuilder()
      .setCustomId(`suggestion_reject_${Date.now()}`)
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

    // Stocker les données de la suggestion avec le message ID pour les interactions
    // (Vous pouvez utiliser une base de données ou un cache ici)
    const suggestionId = `suggestion_${Date.now()}`
    
    return {
      success: true,
      messageId: message.id,
      suggestionId: suggestionId
    }
  } catch (error) {
    console.error('[Discord Bot] ❌ Erreur lors de l\'envoi de la suggestion:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Gère les interactions de boutons (accept/reject)
 */
export function setupInteractionHandler() {
  if (!discordClient) return

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return

    const { customId, user } = interaction

    // Vérifier si c'est une interaction de suggestion
    if (customId.startsWith('suggestion_accept_') || customId.startsWith('suggestion_reject_')) {
      // Vérifier si l'utilisateur est admin
      if (!isAdmin(user.id)) {
        await interaction.reply({
          content: '❌ Seuls les administrateurs peuvent accepter ou refuser des suggestions.',
          ephemeral: true // Seul l'utilisateur voit ce message
        })
        return
      }

      const isAccept = customId.startsWith('suggestion_accept_')
      const action = isAccept ? 'acceptée' : 'refusée'
      const color = isAccept ? 0x00FF00 : 0xFF0000
      const emoji = isAccept ? '✅' : '❌'

      // Mettre à jour l'embed
      const originalEmbed = interaction.message.embeds[0]
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

      // Envoyer une confirmation
      await interaction.followUp({
        content: `${emoji} La suggestion a été ${action} par ${user.username}`,
        ephemeral: false
      })

    }
  })
}

// Initialiser le handler d'interactions au chargement
if (discordClient) {
  setupInteractionHandler()
}

