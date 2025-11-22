# 🔧 Configuration Discord pour les tickets

## Problème actuel
L'erreur `"Guild introuvable"` indique que le `GUILD_ID` n'est pas configuré dans `config.js`.

## Comment obtenir votre GUILD_ID (ID du serveur Discord)

### Méthode 1 : Via Discord (Mode développeur activé)

1. **Activez le mode développeur** dans Discord :
   - Ouvrez Discord
   - Allez dans **Paramètres utilisateur** → **Avancé**
   - Activez **Mode développeur**

2. **Obtenez l'ID du serveur** :
   - Clic droit sur votre serveur Discord
   - Cliquez sur **Copier l'ID du serveur**
   - L'ID ressemble à : `123456789012345678`

### Méthode 2 : Via l'URL Discord

1. Ouvrez votre serveur Discord dans le navigateur
2. L'URL ressemble à : `https://discord.com/channels/123456789012345678/...`
3. Le premier nombre après `/channels/` est votre `GUILD_ID`

## Configuration du fichier config.js

Sur votre hébergeur katabump, modifiez le fichier `config.js` :

```javascript
module.exports = {
    // Token Discord (requis pour le bot Discord)
    TOKEN: process.env.DISCORD_TOKEN || 'VOTRE_TOKEN_DISCORD_ICI',
    
    // ID du serveur Discord (REQUIS pour créer des tickets)
    GUILD_ID: process.env.GUILD_ID || 'VOTRE_GUILD_ID_ICI',  // ← IMPORTANT !
    
    // ID du rôle administrateur
    ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || 'ID_DU_ROLE_ADMIN',
    
    // ID du salon pour les suggestions
    SUGGESTIONS_CHANNEL: process.env.SUGGESTIONS_CHANNEL || '',
    
    // ID du salon pour voir les suggestions
    VIEW_SUGGESTIONS_CHANNEL: process.env.VIEW_SUGGESTIONS_CHANNEL || '',
    
    // ID du salon pour les tickets
    TICKETS_CHANNEL: process.env.TICKETS_CHANNEL || '',
    
    // Catégories de tickets (optionnel pour l'API /create-ticket)
    TICKET_CATEGORIES: {
        SUPPORT: process.env.TICKET_CATEGORY_SUPPORT || '',
        LINK_PROBLEM: process.env.TICKET_CATEGORY_LINK_PROBLEM || '',
        PARTNERSHIP: process.env.TICKET_CATEGORY_PARTNERSHIP || '',
        OTHER: process.env.TICKET_CATEGORY_OTHER || '',
        APPLICATION: process.env.TICKET_CATEGORY_APPLICATION || ''
    }
};
```

## Configuration minimale requise

Pour que l'API `/create-ticket` fonctionne, vous devez au minimum configurer :

1. **TOKEN** : Le token de votre bot Discord
2. **GUILD_ID** : L'ID de votre serveur Discord (OBLIGATOIRE)

Les autres champs sont optionnels pour l'API `/create-ticket`, mais nécessaires pour les fonctionnalités avancées (suggestions, tickets par catégorie, etc.).

## Après configuration

1. **Téléchargez le fichier `config.js` modifié** sur votre hébergeur katabump
2. **Redémarrez le serveur** : `node launcher-server.js` (ou `node index.js`)
3. **Testez la création de ticket** depuis votre application Electron

## Vérification

Après redémarrage, le serveur devrait afficher :
```
✅ Bot connecté en tant que VotreBot#1234!
```

Si vous voyez cette ligne, le bot est connecté et le `GUILD_ID` devrait fonctionner.

## Note importante

- Le bot Discord doit être membre du serveur avec les permissions appropriées
- Le bot doit avoir la permission de créer des salons (channels)
- Le bot doit avoir la permission de gérer les messages


