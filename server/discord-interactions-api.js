/**
 * API pour gérer les interactions Discord (boutons) pour les suggestions de jeux
 * Seuls les admins peuvent accepter/refuser les suggestions
 */

import express from 'express'
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

const router = express.Router()
const ADMIN_ID = '1332076547422683268'
let discordClient = null

// Initialiser le bot Discord si le token est disponible
async function initDiscordBot() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      console.warn('[Discord Interactions] ⚠️ DISCORD_TOKEN non configuré, les interactions ne seront pas disponibles')
      return false
    }

    if (discordClient) {
      return true // Déjà initialisé
    }

    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    })

    discordClient.once('ready', () => {
      setupInteractionHandler()
    })

    discordClient.on('error', (error) => {
      console.error('[Discord Interactions] ❌ Erreur:', error)
    })

    await discordClient.login(process.env.DISCORD_TOKEN)
    return true
  } catch (error) {
    console.error('[Discord Interactions] ❌ Erreur lors de l\'initialisation:', error.message)
    return false
  }
}

// Vérifier si un utilisateur est admin
function isAdmin(userId) {
  return userId === ADMIN_ID
}

// Configurer le handler d'interactions
function setupInteractionHandler() {
  if (!discordClient) return

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return

    const { customId, user, message } = interaction

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
            icon_url: originalEmbed.footer?.icon_url
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

      } catch (error) {
        console.error('[Discord Interactions] ❌ Erreur lors de la mise à jour:', error)
        await interaction.reply({
          content: '❌ Erreur lors de la mise à jour de la suggestion',
          ephemeral: true
        })
      }
    }
  })
}

// Initialiser le bot au chargement du module
initDiscordBot().catch(err => {
  console.error('[Discord Interactions] ❌ Erreur lors de l\'initialisation:', err)
})

export default router

