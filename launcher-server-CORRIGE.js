/**
 * Bot Discord complet avec WebSocket et API Express pour la communication avec le launcher
 * 
 * Installation des dépendances :
 * npm install ws express discord.js axios cheerio
 * 
 * Lancement :
 * node launcher-server.js
 */

const WebSocket = require("ws");
const express = require("express");
const http = require("http");  // ← AJOUTÉ : Import manquant
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('./config');

// ==================== WEBSOCKET & API EXPRESS ====================

// Initialiser Express
const app = express();
app.use(express.json());

// Créer le serveur HTTP avec Express
const server = http.createServer(app);

// Créer le serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });
let launchers = [];

// Initialiser le client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Cache pour éviter de recréer les webhooks à chaque message
const channelWebhookCache = new Map();

function broadcastTicketMessage({ channel, author, authorId, avatar, content, embeds = [], timestamp = Date.now() }) {
    const data = {
        type: 'discord_message',
        channel,
        author,
        authorId,
        avatar,
        content,
        embeds,
        timestamp
    };

    launchers.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (error) {
                console.error("❌ Erreur lors de l'envoi au launcher:", error);
            }
        }
    });
}

async function getOrCreateWebhook(channel) {
    if (channelWebhookCache.has(channel.id)) {
        return channelWebhookCache.get(channel.id);
    }

    const existing = (await channel.fetchWebhooks()).find(wh => wh.name === 'Actoris Launcher');
    if (existing) {
        channelWebhookCache.set(channel.id, existing);
        return existing;
    }

    const created = await channel.createWebhook({
        name: 'Actoris Launcher',
        reason: 'Webhook pour simuler les messages des utilisateurs du launcher'
    });

    channelWebhookCache.set(channel.id, created);
    return created;
}

async function sendMessageAsUser(channel, member, content) {
    const webhook = await getOrCreateWebhook(channel);
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });

    return webhook.send({
        content,
        username: member.user.username,
        avatarURL
    });
}

// ==================== FONCTIONS UTILITAIRES ====================

// Fonction pour récupérer les informations d'un jeu Steam
async function getGameInfo(steamUrl) {
    try {
        // Essayer d'abord la version française
        const frenchUrl = steamUrl.replace('/app/', '/app/').replace('?', '?l=french&');
        let response = await axios.get(frenchUrl);
        let $ = cheerio.load(response.data);
        
        let title = $('.apphub_AppName').text().trim() || $('title').text().trim();
        let description = $('.game_description_snippet').text().trim();
        let image = $('.game_header_image_full').attr('src') || $('.apphub_AppIcon img').attr('src');
        
        // Si pas de description en français, essayer la version anglaise
        if (!description || description.length < 10) {
            response = await axios.get(steamUrl);
            $ = cheerio.load(response.data);
            description = $('.game_description_snippet').text().trim();
        }
        
        // Si toujours pas de description, utiliser une description par défaut
        if (!description || description.length < 10) {
            description = 'Description non disponible sur Steam';
        }
        
        return {
            title: title || 'Titre non trouvé',
            description: description,
            image: image || null
        };
    } catch (error) {
        console.error('Erreur lors de la récupération des infos du jeu:', error);
        return null;
    }
}

// Fonction pour créer l'embed de suggestion
function createSuggestionEmbed(gameName, description, link, image, status = 'pending', moderator = null, reason = null) {
    const embed = new EmbedBuilder()
        .setTitle(status === 'pending' ? '🎮 NOUVELLE SUGGESTION' : 
                 status === 'accepted' ? '✅ SUGGESTION ACCEPTÉE' : '❌ SUGGESTION REFUSÉE')
        .setColor(status === 'pending' ? '#FFA500' : status === 'accepted' ? '#00FF00' : '#FF0000')
        .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
        .setDescription(`**🎮 ${gameName}**\n\n${description}`)
        .addFields(
            { name: '🔗 Lien Steam', value: `[Cliquez ici pour voir le jeu](${link})`, inline: false }
        )
        .setFooter({ 
            text: status === 'pending' ? 'En attente de modération' : 
                  status === 'accepted' ? 'Suggestion approuvée par l\'équipe' : 'Suggestion refusée',
            iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
        })
        .setTimestamp();

    if (image) {
        embed.setImage(image);
    }

    if (status !== 'pending') {
        embed.addFields(
            { name: '📊 Statut', value: status === 'accepted' ? '✅ **Acceptée**' : '❌ **Refusée**', inline: true },
            { name: '👤 Modérateur', value: `**${moderator || 'Inconnu'}**`, inline: true },
            { name: '⏰ Traité le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );
        
        if (reason) {
            embed.addFields({ 
                name: '💬 Raison du refus', 
                value: `\`\`\`${reason}\`\`\``, 
                inline: false 
            });
        }
    } else {
        embed.addFields(
            { name: '⏰ Créé le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '📋 ID', value: `${Date.now().toString().slice(-6)}`, inline: true }
        );
    }

    return embed;
}

// ==================== GESTION WEBSOCKET ====================

wss.on("connection", ws => {
    console.log("✅ Launcher connecté !");
    launchers.push(ws);

    // Envoyer un message de bienvenue
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connexion établie avec le serveur'
    }));

    ws.on("close", () => {
        console.log("❌ Launcher déconnecté");
        launchers = launchers.filter(l => l !== ws);
    });

    ws.on("error", (error) => {
        console.error("❌ Erreur WebSocket:", error);
    });

    // Écouter les messages du launcher
    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log("📨 Message reçu du launcher:", message);
            
            // Traiter les différents types de messages
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            console.error("❌ Erreur lors du parsing du message:", error);
        }
    });
});

// ==================== API EXPRESS ====================

// API pour créer un ticket depuis le launcher
app.post("/create-ticket", async (req, res) => {
    try {
        const { discord_id, username, message, category } = req.body;

        if (!discord_id || !username || !message) {
            return res.status(400).json({ 
                success: false, 
                error: "Paramètres manquants: discord_id, username, message requis" 
            });
        }

        // Vérifier si GUILD_ID est configuré
        if (!config.GUILD_ID || config.GUILD_ID.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: "GUILD_ID non configuré. Veuillez configurer votre ID de serveur Discord dans config.js" 
            });
        }

        const guild = client.guilds.cache.get(config.GUILD_ID);
        
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: `Guild introuvable. Vérifiez que le GUILD_ID (${config.GUILD_ID}) est correct et que le bot est membre du serveur.` 
            });
        }

        // Récupérer l'utilisateur depuis le serveur (ou le cache)
        let user = guild.members.cache.get(discord_id);
        if (!user) {
            try {
                user = await guild.members.fetch(discord_id);
            } catch (error) {
                console.error(`❌ Impossible de récupérer l'utilisateur ${discord_id}:`, error);
                return res.status(404).json({ 
                    success: false, 
                    error: `Utilisateur Discord introuvable (ID: ${discord_id}). Vérifiez que l'utilisateur est membre du serveur.` 
                });
            }
        }

        // Récupérer le rôle admin depuis le cache si configuré
        let adminRole = null;
        if (config.ADMIN_ROLE_ID && config.ADMIN_ROLE_ID.trim() !== '') {
            adminRole = guild.roles.cache.get(config.ADMIN_ROLE_ID);
            if (!adminRole) {
                console.warn(`⚠️  Rôle admin introuvable (ID: ${config.ADMIN_ROLE_ID})`);
            }
        }

        // Vérifier si une catégorie est fournie
        if (!category) {
            return res.status(400).json({ 
                success: false, 
                error: "Paramètre manquant: category requis" 
            });
        }

        const selectedCategory = category;

        // Mapper la catégorie vers l'ID de catégorie Discord
        const categoryChannelIds = {
            'support': config.TICKET_CATEGORIES?.SUPPORT,
            'link_problem': config.TICKET_CATEGORIES?.LINK_PROBLEM,
            'partnership': config.TICKET_CATEGORIES?.PARTNERSHIP,
            'other': config.TICKET_CATEGORIES?.OTHER,
            'application': config.TICKET_CATEGORIES?.APPLICATION
        };

        const categoryChannelId = categoryChannelIds[selectedCategory];
        
        // Si la catégorie n'est pas configurée ou invalide, créer le ticket sans catégorie parent
        let parentCategory = null;
        if (categoryChannelId) {
            parentCategory = client.channels.cache.get(categoryChannelId);
            if (!parentCategory) {
                console.warn(`⚠️  Catégorie Discord introuvable pour "${selectedCategory}", création sans catégorie parent`);
            }
        } else {
            console.warn(`⚠️  Catégorie "${selectedCategory}" non configurée, création sans catégorie parent`);
        }

        // Vérifier si un salon ticket existe déjà pour cet utilisateur
        // (les tickets sont nommés ticket-<discord_id> pour faciliter l'association avec le launcher)
        const expectedChannelName = `ticket-${discord_id}`;
        let channel = guild.channels.cache.find(ch => 
            ch.name === expectedChannelName &&
            (!parentCategory || ch.parentId === parentCategory.id)
        );

        if (!channel) {
            // Préparer les permissions
            const permissionOverwrites = [
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ];

            // Ajouter le rôle admin si configuré et trouvé
            if (adminRole) {
                permissionOverwrites.push({
                    id: adminRole.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                });
            }

            // Créer le salon ticket (dans la catégorie si disponible)
            const ticketChannelName = expectedChannelName;
            const channelOptions = {
                name: ticketChannelName,
                type: 0, // text channel
                permissionOverwrites: permissionOverwrites
            };

            // Ajouter la catégorie parent si disponible
            if (parentCategory) {
                channelOptions.parent = parentCategory.id;
            }

            channel = await guild.channels.create(channelOptions);
            console.log(`✅ Salon ticket créé: ${channel.name}${parentCategory ? ` dans la catégorie ${parentCategory.name}` : ' (sans catégorie)'}`);
        }

        // Envoyer le message via un webhook pour afficher le nom/avatar Discord
        try {
            await sendMessageAsUser(channel, user, message);
        } catch (error) {
            console.error('[Webhooks] Impossible d\'envoyer le message via webhook:', error);
            return res.status(500).json({
                success: false,
                error: "Impossible d'envoyer le message via Discord (webhook)"
            });
        }

        // Envoyer le message dans le ticket
        console.log(`✅ Message envoyé dans le ticket ${channel.name}`);
        
        res.json({ 
            success: true, 
            channelId: channel.id,
            channelName: channel.name
        });
    } catch (error) {
        console.error("❌ Erreur lors de la création du ticket:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Erreur serveur" 
        });
    }
});

// Endpoint pour vérifier le statut du serveur
app.get("/status", (req, res) => {
    const PORT = process.env.PORT || 20036;
    res.json({
        success: true,
        websocket: {
            connected: launchers.length,
            port: PORT
        },
        api: {
            port: PORT,
            status: "running"
        },
        discord: {
            connected: client.isReady(),
            guilds: client.guilds.cache.size
        }
    });
});

// Démarrer le serveur Express
// Utiliser le port alloué par katabump (20036)
const PORT = process.env.PORT || 20036;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Express prête sur le port ${PORT} !`);
    console.log(`📡 WebSocket serveur prêt sur le port ${PORT} !`);
});

// ==================== ÉVÉNEMENTS DISCORD ====================

// Utiliser clientReady au lieu de ready pour éviter l'avertissement de dépréciation
client.once('clientReady', async () => {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);

    try {
        if (!config.GUILD_ID || config.GUILD_ID.trim() === '') {
            console.warn('⚠️  GUILD_ID non configuré, impossible d\'enregistrer les commandes slash');
            return;
        }

        // Récupérer (ou fetch) la guilde cible
        let guild = client.guilds.cache.get(config.GUILD_ID);
        if (!guild) {
            try {
                guild = await client.guilds.fetch(config.GUILD_ID);
            } catch (error) {
                console.error(`❌ Impossible de récupérer la guilde ${config.GUILD_ID} pour enregistrer les commandes:`, error);
                return;
            }
        }

        await guild.commands.set([
            {
                name: 'rep',
                description: 'Répondre à un ticket depuis Discord',
                dm_permission: false,
                default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
                options: [
                    {
                        name: 'message',
                        description: 'Réponse à envoyer au launcher',
                        type: 3,
                        required: true
                    }
                ]
            }
        ]);

        console.log(`✅ Commandes slash synchronisées pour ${guild.name}`);
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes slash:', error);
    }
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'rep') {
            if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID)) {
                return interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
            }

            if (!interaction.channel || !interaction.channel.name?.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ Utilisez cette commande dans un salon de ticket.', ephemeral: true });
            }

            const response = interaction.options.getString('message', true);
            await interaction.deferReply({ ephemeral: true });

            await interaction.channel.send(`**${interaction.member.displayName || interaction.user.username}** : ${response}`);

            broadcastTicketMessage({
                channel: interaction.channel.name,
                author: interaction.member.displayName || interaction.user.username,
                authorId: interaction.user.id,
                avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
                content: response,
                embeds: [],
                timestamp: Date.now()
            });

            return interaction.editReply('✅ Réponse envoyée au launcher.');
        }
        return;
    }

    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    // Système de suggestions
    if (interaction.customId === 'create_suggestion') {
        const modal = new ModalBuilder()
            .setCustomId('suggestion_modal')
            .setTitle('✨ Créer une suggestion de jeu');

        const gameNameInput = new TextInputBuilder()
            .setCustomId('game_name')
            .setLabel('Nom du jeu')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Entrez le nom du jeu...');

        const gameLinkInput = new TextInputBuilder()
            .setCustomId('game_link')
            .setLabel('Lien du jeu (Steam, Epic, etc.)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('https://store.steampowered.com/app/...');

        modal.addComponents(
            new ActionRowBuilder().addComponents(gameNameInput),
            new ActionRowBuilder().addComponents(gameLinkInput)
        );

        await interaction.showModal(modal);
    }

    // Traitement du formulaire de suggestion
    if (interaction.customId === 'suggestion_modal') {
        await interaction.deferReply({ ephemeral: true });

        const gameName = interaction.fields.getTextInputValue('game_name');
        const gameLink = interaction.fields.getTextInputValue('game_link');

        try {
            let gameImage = null;
            let gameDescription = 'Description non disponible';
            
            // Récupérer les infos du jeu si c'est un lien Steam
            if (gameLink.includes('steampowered.com')) {
                const gameInfo = await getGameInfo(gameLink);
                if (gameInfo) {
                    gameDescription = gameInfo.description;
                    if (gameInfo.image) gameImage = gameInfo.image;
                }
            }

            // Envoyer UNE SEULE suggestion
            const embed = createSuggestionEmbed(gameName, gameDescription, gameLink, gameImage);
            const viewChannel = client.channels.cache.get(config.VIEW_SUGGESTIONS_CHANNEL);
            
            if (viewChannel) {
                const message = await viewChannel.send({ embeds: [embed] });
                
                // Ajouter les boutons d'action pour les admins
                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_suggestion_${message.id}`)
                            .setLabel('✅ Accepter')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reject_suggestion_${message.id}`)
                            .setLabel('❌ Refuser')
                            .setStyle(ButtonStyle.Danger)
                    );
                
                await message.edit({ components: [actionRow] });
            }

            await interaction.editReply('✅ Votre suggestion a été envoyée avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la suggestion:', error);
            await interaction.editReply('❌ Une erreur est survenue lors de l\'envoi de votre suggestion.');
        }
    }

    // Gestion des boutons d'acceptation/refus
    if (interaction.customId.startsWith('accept_suggestion_') || interaction.customId.startsWith('reject_suggestion_')) {
        // Vérifier si l'utilisateur a le rôle admin
        if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID)) {
            return await interaction.reply({ content: '❌ Vous n\'avez pas la permission d\'effectuer cette action.', ephemeral: true });
        }

        const messageId = interaction.customId.split('_')[2];
        const isAccept = interaction.customId.startsWith('accept_suggestion_');
        
        try {
            const message = await interaction.channel.messages.fetch(messageId);
            const embed = message.embeds[0];
            
            if (isAccept) {
                const newEmbed = createSuggestionEmbed(
                    embed.data.fields[0].value,
                    embed.data.fields[1].value,
                    embed.data.fields[2].value,
                    embed.data.image?.url,
                    'accepted',
                    interaction.user.tag
                );
                
                await message.edit({ embeds: [newEmbed], components: [] });
                await interaction.reply({ content: '✅ Suggestion acceptée !', ephemeral: true });
            } else {
                // Demander la raison du refus
                const modal = new ModalBuilder()
                    .setCustomId(`reject_reason_${messageId}`)
                    .setTitle('Raison du refus');

                const reasonInput = new TextInputBuilder()
                    .setCustomId('reject_reason')
                    .setLabel('Raison du refus')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setPlaceholder('Expliquez pourquoi cette suggestion est refusée...');

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal);
            }
        } catch (error) {
            console.error('Erreur lors de la gestion de la suggestion:', error);
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }

    // Traitement de la raison de refus
    if (interaction.customId.startsWith('reject_reason_')) {
        const messageId = interaction.customId.split('_')[2];
        const reason = interaction.fields.getTextInputValue('reject_reason');
        
        try {
            const message = await interaction.channel.messages.fetch(messageId);
            const embed = message.embeds[0];
            
            const newEmbed = createSuggestionEmbed(
                embed.data.fields[0].value,
                embed.data.fields[1].value,
                embed.data.fields[2].value,
                embed.data.image?.url,
                'rejected',
                interaction.user.tag,
                reason
            );
            
            await message.edit({ embeds: [newEmbed], components: [] });
            await interaction.reply({ content: '❌ Suggestion refusée !', ephemeral: true });
        } catch (error) {
            console.error('Erreur lors du refus de la suggestion:', error);
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }

    // Système de tickets - Créer un ticket
    if (interaction.customId === 'create_ticket') {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Sélectionnez une catégorie...')
            .addOptions([
                {
                    label: 'Support',
                    description: 'Pour toute demande d\'aide',
                    value: 'support',
                    emoji: '💬'
                },
                {
                    label: 'Problème de liens',
                    description: 'Liens morts/corrompus',
                    value: 'link_problem',
                    emoji: '🔗'
                },
                {
                    label: 'Partenariat',
                    description: 'Demande de partenariat',
                    value: 'partnership',
                    emoji: '🤝'
                },
                {
                    label: 'Autre',
                    description: 'Autre sujet',
                    value: 'other',
                    emoji: '🔍'
                },
                {
                    label: 'Candidature',
                    description: 'Suite à une réponse positive',
                    value: 'application',
                    emoji: '👤'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({ 
            content: 'Veuillez sélectionner une catégorie pour votre ticket :', 
            components: [row], 
            ephemeral: true 
        });
    }

    // Gestion de la sélection de catégorie de ticket
    if (interaction.customId === 'ticket_category') {
        await interaction.deferReply({ ephemeral: true });
        
        const category = interaction.values[0];
        const categoryNames = {
            'support': 'Support',
            'link_problem': 'Problème de liens',
            'partnership': 'Partenariat',
            'other': 'Autre',
            'application': 'Candidature'
        };

        const categoryChannelIds = {
            'support': config.TICKET_CATEGORIES.SUPPORT,
            'link_problem': config.TICKET_CATEGORIES.LINK_PROBLEM,
            'partnership': config.TICKET_CATEGORIES.PARTNERSHIP,
            'other': config.TICKET_CATEGORIES.OTHER,
            'application': config.TICKET_CATEGORIES.APPLICATION
        };

        try {
            // Trouver la catégorie parent
            const categoryChannelId = categoryChannelIds[category];
            const parentCategory = client.channels.cache.get(categoryChannelId);
            
            if (!parentCategory) {
                await interaction.editReply({ 
                    content: `❌ Erreur : Catégorie "${categoryNames[category]}" introuvable.`, 
                    components: [] 
                });
                return;
            }

            // Créer un salon privé pour le ticket
            const ticketChannelName = `ticket-${interaction.user.username.toLowerCase()}-${Date.now().toString().slice(-4)}`;
            
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketChannelName,
                type: 0, // GUILD_TEXT
                parent: parentCategory.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    {
                        id: config.ADMIN_ROLE_ID,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }
                ]
            });

            // Envoyer le message de bienvenue dans le ticket
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`🎫 Ticket - ${categoryNames[category]}`)
                .setDescription(`**👤 Utilisateur :** ${interaction.user}\n**📂 Catégorie :** ${categoryNames[category]}\n**⏰ Créé le :** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**📝 Instructions :**\n• Décrivez votre problème ou votre demande en détail\n• Un membre de l'équipe vous répondra bientôt\n• Utilisez le bouton ci-dessous pour fermer le ticket une fois résolu`)
                .setColor('#0099FF')
                .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
                .setFooter({ 
                    text: 'Système de tickets Actoris v2', 
                    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
                })
                .setTimestamp();

            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`close_ticket_${ticketChannel.id}`)
                        .setLabel('🔒 Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({ 
                content: `Bonjour ${interaction.user} ! Votre ticket a été créé.`, 
                embeds: [welcomeEmbed],
                components: [closeButton]
            });

            await interaction.editReply({ 
                content: `✅ Votre ticket a été créé : ${ticketChannel}`, 
                components: [] 
            });
        } catch (error) {
            console.error('Erreur lors de la création du ticket:', error);
            await interaction.editReply({ 
                content: '❌ Une erreur est survenue lors de la création de votre ticket.', 
                components: [] 
            });
        }
    }

    // Gestion de la fermeture des tickets
    if (interaction.customId.startsWith('close_ticket_')) {
        // Vérifier si l'utilisateur a le rôle admin ou s'il est le créateur du ticket
        const channelId = interaction.customId.split('_')[2];
        const ticketChannel = interaction.channel;
        
        if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID) && 
            ticketChannel.name !== `ticket-${interaction.user.username.toLowerCase()}-${ticketChannel.name.split('-').pop()}`) {
            return await interaction.reply({ 
                content: '❌ Vous n\'avez pas la permission de fermer ce ticket.', 
                ephemeral: true 
            });
        }

        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket fermé')
            .setDescription(`**👤 Fermé par :** ${interaction.user}\n**⏰ Fermé le :** <t:${Math.floor(Date.now() / 1000)}:F>\n**📋 Raison :** Ticket résolu\n\n**💬 Merci d'avoir utilisé notre système de tickets !**`)
            .setColor('#FF0000')
            .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
            .setFooter({ 
                text: 'Ce salon sera supprimé dans 5 secondes', 
                iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
            })
            .setTimestamp();

        await interaction.reply({ 
            content: '🔒 Fermeture du ticket en cours...', 
            ephemeral: true 
        });

        // Supprimer le salon après 5 secondes
        setTimeout(async () => {
            try {
                await ticketChannel.delete();
            } catch (error) {
                console.error('Erreur lors de la suppression du ticket:', error);
            }
        }, 5000);

        await ticketChannel.send({ embeds: [closeEmbed] });
    }
});

// Commandes pour initialiser les systèmes
client.on('messageCreate', async message => {
    if (message.content === '!setup') {
        const suggestionsChannel = client.channels.cache.get(config.SUGGESTIONS_CHANNEL);
        
        if (suggestionsChannel) {
            const embed = new EmbedBuilder()
                .setTitle('✨ Système de Suggestions de Jeux')
                .setDescription('**🎮 Comment suggérer un jeu :**\n• Cliquez sur le bouton ci-dessous\n• Remplissez le formulaire avec le nom et le lien du jeu\n• La description et l\'image seront récupérées automatiquement depuis Steam\n• Votre suggestion sera examinée par l\'équipe de modération\n\n**📋 Informations requises :**\n• Nom du jeu\n• Lien Steam (recommandé pour récupération automatique)')
                .setColor('#FFA500')
                .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
                .setFooter({ 
                    text: 'Actoris v2 • Système de suggestions', 
                    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
                })
                .setTimestamp();

            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_suggestion')
                        .setLabel('✨ Créer une suggestion')
                        .setStyle(ButtonStyle.Primary)
                );

            await suggestionsChannel.send({ embeds: [embed], components: [button] });
            await message.reply('✅ Système de suggestions initialisé !');
        }
    }

    if (message.content === '!setup-tickets') {
        const ticketsChannel = client.channels.cache.get(config.TICKETS_CHANNEL);
        
        if (ticketsChannel) {
            const embed = new EmbedBuilder()
                .setTitle('🎫 Système de Tickets')
                .setDescription('**🎫 Comment créer un ticket :**\n• Cliquez sur le bouton ci-dessous\n• Sélectionnez la catégorie appropriée\n• Un salon privé sera créé pour vous\n\n**📂 Catégories disponibles :**\n• 💬 Support - Pour toute demande d\'aide\n• 🔗 Problème de liens - Liens morts/corrompus\n• 🤝 Partenariat - Demande de partenariat\n• 🔍 Autre - Autre sujet\n• 👤 Candidature - Suite à une réponse positive')
                .setColor('#0099FF')
                .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
                .setFooter({ 
                    text: 'Actoris v2 • Système de tickets', 
                    iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
                })
                .setTimestamp();

            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('🎫 Créer un ticket')
                        .setStyle(ButtonStyle.Primary)
                );

            await ticketsChannel.send({ embeds: [embed], components: [button] });
            await message.reply('✅ Système de tickets initialisé !');
        }
    }

    if (message.content === '!debug-channels') {
        let debugInfo = '🔍 **Debug des salons :**\n\n';
        
        // Vérifier les salons principaux
        const suggestionsChannel = client.channels.cache.get(config.SUGGESTIONS_CHANNEL);
        const viewSuggestionsChannel = client.channels.cache.get(config.VIEW_SUGGESTIONS_CHANNEL);
        const ticketsChannel = client.channels.cache.get(config.TICKETS_CHANNEL);
        
        debugInfo += `**Salons principaux :**\n`;
        debugInfo += `• Suggestions: ${suggestionsChannel ? `✅ ${suggestionsChannel.name}` : '❌ Introuvable'}\n`;
        debugInfo += `• Voir suggestions: ${viewSuggestionsChannel ? `✅ ${viewSuggestionsChannel.name}` : '❌ Introuvable'}\n`;
        debugInfo += `• Tickets: ${ticketsChannel ? `✅ ${ticketsChannel.name}` : '❌ Introuvable'}\n\n`;
        
        // Vérifier les salons de catégories
        debugInfo += `**Salons de catégories :**\n`;
        Object.entries(config.TICKET_CATEGORIES).forEach(([key, channelId]) => {
            const channel = client.channels.cache.get(channelId);
            debugInfo += `• ${key}: ${channel ? `✅ ${channel.name}` : `❌ Introuvable (${channelId})`}\n`;
        });
        
        await message.reply(debugInfo);
    }

    // Envoyer les messages Discord aux launchers connectés
    if (!message.author.bot && message.channel.name.startsWith("ticket-")) {
        const data = {
            type: 'discord_message',
            channel: message.channel.name,
            author: message.author.username,
            authorId: message.author.id,
            avatar: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
            content: message.content,
            embeds: message.embeds?.map(embed => ({
                title: embed.title || null,
                description: embed.description || null,
                color: embed.color || null,
                footer: embed.footer?.text || null,
                timestamp: embed.timestamp || null,
                fields: embed.fields?.map(field => ({
                    name: field.name,
                    value: field.value,
                    inline: field.inline
                })) || []
            })) || [],
            timestamp: message.createdTimestamp
        };

        // Envoyer à tous les launchers connectés
        launchers.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(data));
                    console.log(`📤 Message envoyé au launcher depuis ${message.channel.name}`);
                } catch (error) {
                    console.error("❌ Erreur lors de l'envoi au launcher:", error);
                }
            }
        });
    }
});

// Connexion Discord (seulement si le token est configuré)
if (config.TOKEN && config.TOKEN.trim() !== '') {
    // Vérifier si GUILD_ID est configuré
    if (!config.GUILD_ID || config.GUILD_ID.trim() === '') {
        console.log('⚠️  ATTENTION: GUILD_ID non configuré dans config.js');
        console.log('⚠️  L\'API /create-ticket ne fonctionnera pas sans GUILD_ID.');
        console.log('⚠️  Pour obtenir votre GUILD_ID: Clic droit sur votre serveur Discord → Copier l\'ID du serveur');
    }
    
    client.login(config.TOKEN).catch(err => {
        console.error('❌ Erreur de connexion Discord:', err);
    });
} else {
    console.log('⚠️  Token Discord non configuré. Le bot Discord ne sera pas connecté.');
    console.log('⚠️  Le serveur WebSocket fonctionne toujours sur le port 20036.');
    if (!config.GUILD_ID || config.GUILD_ID.trim() === '') {
        console.log('⚠️  GUILD_ID non configuré. L\'API /create-ticket nécessite GUILD_ID et TOKEN.');
    }
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur...');
    
    // Fermer toutes les connexions WebSocket
    launchers.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });
    
    // Déconnecter le bot Discord
    if (client.isReady()) {
        client.destroy();
    }
    
    process.exit(0);
});

