# Bot Discord Complet avec WebSocket & API Express

Ce serveur combine un bot Discord complet (tickets, suggestions, etc.) avec la communication WebSocket et API REST pour le launcher Electron.

## 📋 Prérequis

Installez les dépendances nécessaires :

```bash
npm install ws express discord.js axios cheerio
```

## 🚀 Démarrage

Lancez le serveur indépendamment du bot Discord :

```bash
node launcher-server.js
```

Le serveur démarre :
- **WebSocket** sur le port `8080`
- **API Express** sur le port `3001`

## 📡 Fonctionnalités

### 1. WebSocket (Port 8080)

Les launchers se connectent automatiquement et peuvent :
- Recevoir des messages du staff Discord en temps réel
- Envoyer des messages au serveur

### 2. API REST (Port 3001)

#### Créer un ticket depuis le launcher

```http
POST http://localhost:3001/create-ticket
Content-Type: application/json

{
  "discord_id": "123456789012345678",
  "username": "NomUtilisateur",
  "message": "Message du launcher"
}
```

**Réponse :**
```json
{
  "success": true,
  "channelId": "987654321098765432",
  "channelName": "ticket-123456789012345678"
}
```

#### Vérifier le statut du serveur

```http
GET http://localhost:3001/status
```

**Réponse :**
```json
{
  "success": true,
  "websocket": {
    "connected": 2,
    "port": 8080
  },
  "api": {
    "port": 3001,
    "status": "running"
  },
  "discord": {
    "connected": true,
    "guilds": 1
  }
}
```

## 🔧 Configuration

Modifiez les valeurs dans `launcher-server.js` ou utilisez des variables d'environnement :

```javascript
const config = {
    TOKEN: process.env.DISCORD_TOKEN || 'VOTRE_TOKEN_DISCORD',
    GUILD_ID: process.env.GUILD_ID || 'ID_DU_SERVEUR_DISCORD',
    ADMIN_ROLE_ID: process.env.ADMIN_ROLE_ID || 'ID_DU_ROLE_ADMIN',
    SUGGESTIONS_CHANNEL: 'ID_DU_SALON_SUGGESTIONS',
    VIEW_SUGGESTIONS_CHANNEL: 'ID_DU_SALON_VOIR_SUGGESTIONS',
    TICKETS_CHANNEL: 'ID_DU_SALON_TICKETS',
    TICKET_CATEGORIES: {
        SUPPORT: 'ID_CATEGORIE_SUPPORT',
        LINK_PROBLEM: 'ID_CATEGORIE_LINK_PROBLEM',
        PARTNERSHIP: 'ID_CATEGORIE_PARTNERSHIP',
        OTHER: 'ID_CATEGORIE_OTHER',
        APPLICATION: 'ID_CATEGORIE_APPLICATION'
    }
};
```

## 🎮 Fonctionnalités du Bot Discord

### ✨ Système de Suggestions
- Création de suggestions de jeux via modal
- Récupération automatique des infos depuis Steam
- Acceptation/Refus par les admins avec raison
- Commandes : `!setup` pour initialiser

### 🎫 Système de Tickets
- Création de tickets par catégorie (Support, Problème de liens, Partenariat, Autre, Candidature)
- Salons privés automatiques
- Fermeture de tickets avec suppression automatique
- Commandes : `!setup-tickets` pour initialiser

### 🔍 Debug
- Commande `!debug-channels` pour vérifier la configuration des salons

## 📨 Communication

### Messages Discord → Launcher

Quand un membre du staff envoie un message dans un salon ticket Discord, tous les launchers connectés reçoivent :

```json
{
  "type": "discord_message",
  "channel": "ticket-123456789012345678",
  "author": "NomDuStaff",
  "authorId": "987654321098765432",
  "content": "Message du staff",
  "timestamp": 1234567890123
}
```

### Messages Launcher → Discord

Le launcher peut créer un ticket via l'API `/create-ticket` qui :
1. Crée un salon privé sur Discord (ou utilise l'existant)
2. Envoie le message dans ce salon
3. Retourne les informations du salon créé

## ⚠️ Notes importantes

- Ce serveur est **séparé** du bot Discord principal
- Il peut être lancé sur le même serveur ou un serveur différent
- Les launchers doivent se connecter à `ws://localhost:8080` (ou l'IP du serveur)
- L'API doit être accessible depuis le launcher sur `http://localhost:3001`

## 🔒 Sécurité

Pour la production, ajoutez :
- Authentification pour l'API
- Validation des données
- Rate limiting
- HTTPS/WSS pour les connexions sécurisées

