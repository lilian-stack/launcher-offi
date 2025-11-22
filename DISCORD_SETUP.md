# Configuration Discord OAuth2

Ce guide explique comment configurer l'authentification Discord OAuth2 pour le launcher.

## Étapes de configuration

### 1. Créer une application Discord

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur "New Application"
3. Donnez un nom à votre application (ex: "Mon Launcher")
4. Cliquez sur "Create"

### 2. Configurer OAuth2

1. Dans le menu de gauche, allez dans "OAuth2"
2. Notez votre **Client ID** et **Client Secret**
3. Dans "Redirects", ajoutez l'URL de redirection :
   - Pour le développement : `http://localhost:5173/auth/discord/callback`
   - Pour la production : `votre-domaine.com/auth/discord/callback`

### 3. Obtenir l'ID du serveur Discord (Guild ID)

1. Activez le mode développeur dans Discord :
   - Paramètres Discord > Avancé > Mode développeur
2. Faites un clic droit sur votre serveur Discord
3. Cliquez sur "Copier l'ID" (c'est votre Guild ID)

### 4. Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet avec les valeurs suivantes :

```env
DISCORD_CLIENT_ID=votre_client_id_ici
DISCORD_CLIENT_SECRET=votre_client_secret_ici
DISCORD_REDIRECT_URI=http://localhost:5173/auth/discord/callback
DISCORD_GUILD_ID=votre_guild_id_ici
```

### 5. Configurer les rôles Discord

Les IDs des rôles sont déjà configurés dans `electron/discord-config.js` :

- **Membres** : `1332077241722605700`
- **VIP** : `1351995593383350302`
- **Serveur boost** : `1332111013205770282`
- **Admin** : `1332076547422683268`

Assurez-vous que ces IDs correspondent aux rôles de votre serveur Discord.

### 6. Configurer les permissions du bot (optionnel)

Si vous souhaitez que le bot vérifie les rôles des utilisateurs, vous devez :

1. Allez dans "Bot" dans le menu de gauche
2. Créez un bot si vous n'en avez pas
3. Activez les intents suivants :
   - Server Members Intent (si vous voulez vérifier les membres du serveur)
4. Invitez le bot sur votre serveur avec les permissions nécessaires

### 7. Tester l'authentification

1. Démarrez l'application : `npm run electron:dev`
2. Allez sur la page de connexion
3. Cliquez sur "Se connecter avec Discord"
4. Autorisez l'application dans Discord
5. Vous devriez être connecté avec vos rôles Discord appliqués

## Notes importantes

- **Sécurité** : Ne partagez jamais votre Client Secret publiquement
- **URL de redirection** : L'URL de redirection doit correspondre exactement à celle configurée dans Discord
- **Rôles** : Les rôles sont vérifiés dans l'ordre de priorité : Admin > VIP > BOOST > Member
- **Scopes** : Les scopes utilisés sont : `identify`, `email`, `guilds`, `guilds.members.read`

## Dépannage

### Erreur "Invalid redirect_uri"
- Vérifiez que l'URL de redirection dans `.env` correspond exactement à celle dans Discord
- Les URLs doivent correspondre caractère par caractère

### Erreur "Missing permissions"
- Vérifiez que le bot a les permissions nécessaires sur le serveur
- Vérifiez que les intents sont activés dans Discord Developer Portal

### Les rôles ne sont pas détectés
- Vérifiez que l'utilisateur est bien membre du serveur Discord
- Vérifiez que les IDs des rôles dans `discord-config.js` correspondent aux vrais IDs
- Vérifiez que le bot a accès aux informations des membres du serveur

