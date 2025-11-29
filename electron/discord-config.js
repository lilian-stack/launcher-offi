// Configuration Discord OAuth2
// Pour obtenir ces valeurs, créez une application sur https://discord.com/developers/applications

export const DISCORD_CONFIG = {
  // Client ID de votre application Discord
  CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1398485031189483642',
  
  // Client Secret de votre application Discord
  CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || "",

  // URL de redirection (doit être configurée dans les paramètres OAuth2 de Discord)
  REDIRECT_URI: process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173',
  
  // ID du serveur Discord (Guild ID)
  GUILD_ID: process.env.DISCORD_GUILD_ID || '1332072935682478202',
  
  // IDs des rôles Discord
  ROLES: {
    MEMBER: '1332077241722605700',
    VIP: '1351995593383350302',
    BOOST: '1332111013205770282',
    ADMIN: '1332076547422683268',
  },
}

