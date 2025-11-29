/**
 * Bot Discord complet avec WebSocket et API Express pour la communication avec le launcher
 * 
 * Installation des dépendances :
 * npm install ws express discord.js axios cheerio
 * 
 * Lancement :
 * node launcher-server.js
 */

import WebSocket from "ws";
import express from "express";
import http from "http";
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, StringSelectMenuBuilder, ChannelType } from 'discord.js';
import axios from 'axios';
import cheerio from 'cheerio';
import config from './config.js';

// ==================== WEBSOCKET & API EXPRESS ====================

// Initialiser Express
const app = express();
app.use(express.json());

// Initialiser le serveur WebSocket
// CrÃ©er le serveur HTTP avec Express
const server = http.createServer(app);

// CrÃ©er le serveur WebSocket attachÃ© au serveur HTTP
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
        .setTitle(status === 'pending' ? '?? NOUVELLE SUGGESTION' : 
                 status === 'accepted' ? '? SUGGESTION ACCEPTÉE' : '? SUGGESTION REFUSÉE')
        .setColor(status === 'pending' ? '#FFA500' : status === 'accepted' ? '#00FF00' : '#FF0000')
        .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
        .setDescription(`**?? ${gameName}**\n\n${description}`)
        .addFields(
            { name: '?? Lien Steam', value: `[Cliquez ici pour voir le jeu](${link})`, inline: false }
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
            { name: '?? Statut', value: status === 'accepted' ? '? **Acceptée**' : '? **Refusée**', inline: true },
            { name: '?? Modérateur', value: `**${moderator || 'Inconnu'}**`, inline: true },
            { name: '? Traité le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );
        
        if (reason) {
            embed.addFields({ 
                name: '?? Raison du refus', 
                value: `\`\`\`${reason}\`\`\``, 
                inline: false 
            });
        }
    } else {
        embed.addFields(
            { name: '? Créé le', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
            { name: '?? ID', value: `${Date.now().toString().slice(-6)}`, inline: true }
        );
    }

    return embed;
}

// ==================== GESTION WEBSOCKET ====================

wss.on("connection", ws => {
    console.log("? Launcher connecté !");
    launchers.push(ws);

    // Envoyer un message de bienvenue
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connexion établie avec le serveur'
    }));

    ws.on("close", () => {
        console.log("? Launcher déconnecté");
        launchers = launchers.filter(l => l !== ws);
    });

    ws.on("error", (error) => {
        console.error("? Erreur WebSocket:", error);
    });

    // Écouter les messages du launcher
    ws.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log("?? Message reçu du launcher:", message);
            
            // Traiter les différents types de messages
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
            }
        } catch (error) {
            console.error("? Erreur lors du parsing du message:", error);
        }
    });
});

// ==================== API EXPRESS ====================

// API pour créer un ticket depuis le launcher
app.post("/create-ticket", async (req, res) => {
    try {
        const { discord_id, username, message } = req.body;

        if (!discord_id || !username || !message) {
            return res.status(400).json({ 
                success: false, 
                error: "Paramètres manquants: discord_id, username, message requis" 
            });
        }

        const guild = client.guilds.cache.get(config.GUILD_ID);
        
        if (!guild) {
            return res.status(404).json({ 
                success: false, 
                error: "Guild introuvable" 
            });
        }

        // Vérifier si un salon ticket existe déjà
        let channel = guild.channels.cache.find(ch => ch.name === `ticket-${discord_id}`);

        if (!channel) {
            // Créer le salon ticket
            channel = await guild.channels.create({
                name: `ticket-${discord_id}`,
                type: 0, // text channel
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: discord_id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    {
                        id: config.ADMIN_ROLE_ID,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }
                ]
            });
            console.log(`? Salon ticket créé: ${channel.name}`);
        }

        // Envoyer le message dans le ticket
        await channel.send(`**${username}** : ${message}`);
        
        console.log(`? Message envoyé dans le ticket ${channel.name}`);
        
        res.json({ 
            success: true, 
            channelId: channel.id,
            channelName: channel.name
        });
    } catch (error) {
        console.error("? Erreur lors de la création du ticket:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Erreur serveur" 
        });
    }
});

// Endpoint pour vérifier le statut du serveur
app.get("/status", (req, res) => {
    res.json({
        success: true,
        websocket: {
            connected: launchers.length,
            port: 8080
        },
        api: {
            port: 3001,
            status: "running"
        },
        discord: {
            connected: client.isReady(),
            guilds: client.guilds.cache.size
        }
    });
});

// Démarrer le serveur Express
app.listen(3001, '0.0.0.0', () => {
    console.log("? API Express prête sur le port 3001 !");
    console.log("?? WebSocket serveur prêt sur le port 8080 !");
});

// ==================== ÉVÉNEMENTS DISCORD ====================

// Utiliser clientReady au lieu de ready pour éviter l'avertissement de dépréciation
// (discord.js v14+ supporte déjà clientReady, ready sera supprimé dans v15)
client.once('clientReady', () => {
    console.log(`? Bot connecté en tant que ${client.user.tag}!`);
});

// Gestion des interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

    // Système de suggestions
    if (interaction.customId === 'create_suggestion') {
        const modal = new ModalBuilder()
            .setCustomId('suggestion_modal')
            .setTitle('? Créer une suggestion de jeu');

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
                            .setLabel('? Accepter')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reject_suggestion_${message.id}`)
                            .setLabel('? Refuser')
                            .setStyle(ButtonStyle.Danger)
                    );
                
                await message.edit({ components: [actionRow] });
            }

            await interaction.editReply('? Votre suggestion a été envoyée avec succès !');
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la suggestion:', error);
            await interaction.editReply('? Une erreur est survenue lors de l\'envoi de votre suggestion.');
        }
    }

    // Gestion des boutons d'acceptation/refus
    if (interaction.customId.startsWith('accept_suggestion_') || interaction.customId.startsWith('reject_suggestion_')) {
        // Vérifier si l'utilisateur a le rôle admin
        if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID)) {
            return await interaction.reply({ content: '? Vous n\'avez pas la permission d\'effectuer cette action.', ephemeral: true });
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
                await interaction.reply({ content: '? Suggestion acceptée !', ephemeral: true });
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
            await interaction.reply({ content: '? Une erreur est survenue.', ephemeral: true });
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
            await interaction.reply({ content: '? Suggestion refusée !', ephemeral: true });
        } catch (error) {
            console.error('Erreur lors du refus de la suggestion:', error);
            await interaction.reply({ content: '? Une erreur est survenue.', ephemeral: true });
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
                    emoji: '??'
                },
                {
                    label: 'Problème de liens',
                    description: 'Liens morts/corrompus',
                    value: 'link_problem',
                    emoji: '??'
                },
                {
                    label: 'Partenariat',
                    description: 'Demande de partenariat',
                    value: 'partnership',
                    emoji: '??'
                },
                {
                    label: 'Autre',
                    description: 'Autre sujet',
                    value: 'other',
                    emoji: '??'
                },
                {
                    label: 'Candidature',
                    description: 'Suite à une réponse positive',
                    value: 'application',
                    emoji: '??'
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
                    content: `? Erreur : Catégorie "${categoryNames[category]}" introuvable.`, 
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
                .setTitle(`?? Ticket - ${categoryNames[category]}`)
                .setDescription(`**?? Utilisateur :** ${interaction.user}\n**?? Catégorie :** ${categoryNames[category]}\n**? Créé le :** <t:${Math.floor(Date.now() / 1000)}:F>\n\n**?? Instructions :**\n• Décrivez votre problème ou votre demande en détail\n• Un membre de l'équipe vous répondra bientôt\n• Utilisez le bouton ci-dessous pour fermer le ticket une fois résolu`)
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
                        .setLabel('?? Fermer le ticket')
                        .setStyle(ButtonStyle.Danger)
                );

            await ticketChannel.send({ 
                content: `Bonjour ${interaction.user} ! Votre ticket a été créé.`, 
                embeds: [welcomeEmbed],
                components: [closeButton]
            });

            await interaction.editReply({ 
                content: `? Votre ticket a été créé : ${ticketChannel}`, 
                components: [] 
            });
        } catch (error) {
            console.error('Erreur lors de la création du ticket:', error);
            await interaction.editReply({ 
                content: '? Une erreur est survenue lors de la création de votre ticket.', 
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
                content: '? Vous n\'avez pas la permission de fermer ce ticket.', 
                ephemeral: true 
            });
        }

        const closeEmbed = new EmbedBuilder()
            .setTitle('?? Ticket fermé')
            .setDescription(`**?? Fermé par :** ${interaction.user}\n**? Fermé le :** <t:${Math.floor(Date.now() / 1000)}:F>\n**?? Raison :** Ticket résolu\n\n**?? Merci d'avoir utilisé notre système de tickets !**`)
            .setColor('#FF0000')
            .setThumbnail('https://cdn.discordapp.com/emojis/1234567890123456789.png')
            .setFooter({ 
                text: 'Ce salon sera supprimé dans 5 secondes', 
                iconURL: 'https://cdn.discordapp.com/emojis/1234567890123456789.png'
            })
            .setTimestamp();

        await interaction.reply({ 
            content: '?? Fermeture du ticket en cours...', 
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
                .setTitle('? Système de Suggestions de Jeux')
                .setDescription('**?? Comment suggérer un jeu :**\n• Cliquez sur le bouton ci-dessous\n• Remplissez le formulaire avec le nom et le lien du jeu\n• La description et l\'image seront récupérées automatiquement depuis Steam\n• Votre suggestion sera examinée par l\'équipe de modération\n\n**?? Informations requises :**\n• Nom du jeu\n• Lien Steam (recommandé pour récupération automatique)')
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
                        .setLabel('? Créer une suggestion')
                        .setStyle(ButtonStyle.Primary)
                );

            await suggestionsChannel.send({ embeds: [embed], components: [button] });
            await message.reply('? Système de suggestions initialisé !');
        }
    }

    if (message.content === '!setup-tickets') {
        const ticketsChannel = client.channels.cache.get(config.TICKETS_CHANNEL);
        
        if (ticketsChannel) {
            const embed = new EmbedBuilder()
                .setTitle('?? Système de Tickets')
                .setDescription('**?? Comment créer un ticket :**\n• Cliquez sur le bouton ci-dessous\n• Sélectionnez la catégorie appropriée\n• Un salon privé sera créé pour vous\n\n**?? Catégories disponibles :**\n• ?? Support - Pour toute demande d\'aide\n• ?? Problème de liens - Liens morts/corrompus\n• ?? Partenariat - Demande de partenariat\n• ?? Autre - Autre sujet\n• ?? Candidature - Suite à une réponse positive')
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
                        .setLabel('?? Créer un ticket')
                        .setStyle(ButtonStyle.Primary)
                );

            await ticketsChannel.send({ embeds: [embed], components: [button] });
            await message.reply('? Système de tickets initialisé !');
        }
    }

    if (message.content === '!debug-channels') {
        let debugInfo = '?? **Debug des salons :**\n\n';
        
        // Vérifier les salons principaux
        const suggestionsChannel = client.channels.cache.get(config.SUGGESTIONS_CHANNEL);
        const viewSuggestionsChannel = client.channels.cache.get(config.VIEW_SUGGESTIONS_CHANNEL);
        const ticketsChannel = client.channels.cache.get(config.TICKETS_CHANNEL);
        
        debugInfo += `**Salons principaux :**\n`;
        debugInfo += `• Suggestions: ${suggestionsChannel ? `? ${suggestionsChannel.name}` : '? Introuvable'}\n`;
        debugInfo += `• Voir suggestions: ${viewSuggestionsChannel ? `? ${viewSuggestionsChannel.name}` : '? Introuvable'}\n`;
        debugInfo += `• Tickets: ${ticketsChannel ? `? ${ticketsChannel.name}` : '? Introuvable'}\n\n`;
        
        // Vérifier les salons de catégories
        debugInfo += `**Salons de catégories :**\n`;
        Object.entries(config.TICKET_CATEGORIES).forEach(([key, channelId]) => {
            const channel = client.channels.cache.get(channelId);
            debugInfo += `• ${key}: ${channel ? `? ${channel.name}` : `? Introuvable (${channelId})`}\n`;
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
            content: message.content,
            timestamp: message.createdTimestamp
        };

        // Envoyer à tous les launchers connectés
        launchers.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(data));
                    console.log(`?? Message envoyé au launcher depuis ${message.channel.name}`);
                } catch (error) {
                    console.error("? Erreur lors de l'envoi au launcher:", error);
                }
            }
        });
    }
});

// Connexion Discord (seulement si le token est configuré)
if (config.TOKEN && config.TOKEN.trim() !== '') {
    client.login(config.TOKEN).catch(err => {
        console.error('? Erreur de connexion Discord:', err);
    });
} else {
    console.log('??  Token Discord non configuré. Le bot Discord ne sera pas connecté.');
    console.log('??  Le serveur WebSocket fonctionne toujours sur le port 8080.');
}

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n?? Arrêt du serveur...');
    
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

