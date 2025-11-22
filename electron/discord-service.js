import axios from 'axios'
import { DISCORD_CONFIG } from './discord-config.js'

const {
  CLIENT_ID: DISCORD_CLIENT_ID,
  CLIENT_SECRET: DISCORD_CLIENT_SECRET,
  REDIRECT_URI: DISCORD_REDIRECT_URI,
  GUILD_ID: DISCORD_GUILD_ID,
  ROLES: DISCORD_ROLES,
} = DISCORD_CONFIG

/**
 * Échange le code d'autorisation contre un token d'accès
 */
async function exchangeCodeForToken(code) {
  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
    })

    const response = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    return response.data
  } catch (error) {
    console.error('Erreur lors de l\'échange du code:', error.response?.data || error.message)
    throw new Error('Erreur lors de l\'obtention du token Discord')
  }
}

/**
 * Récupère les informations de l'utilisateur Discord
 */
async function getUserInfo(accessToken) {
  try {
    const response = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    return response.data
  } catch (error) {
    console.error('Erreur lors de la récupération des infos utilisateur:', error.response?.data || error.message)
    throw new Error('Erreur lors de la récupération des informations utilisateur')
  }
}

/**
 * Récupère les rôles de l'utilisateur dans le serveur Discord
 * Note: Cet endpoint nécessite le scope 'guilds.members.read' et que l'application
 * ait un bot avec les permissions nécessaires sur le serveur
 */
async function getUserGuildRoles(accessToken, userId) {
  try {
    console.log('[Discord] Récupération des rôles pour le serveur:', DISCORD_GUILD_ID)
    
    // Vérifier que le GUILD_ID est configuré
    if (!DISCORD_GUILD_ID || DISCORD_GUILD_ID === 'VOTRE_GUILD_ID') {
      console.error('[Discord] GUILD_ID non configuré! Veuillez configurer DISCORD_GUILD_ID dans discord-config.js')
      return []
    }
    
    // Récupérer les informations du membre dans le serveur
    // Cet endpoint nécessite le scope 'guilds.members.read'
    const response = await axios.get(`https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const roles = response.data.roles || []
    console.log('[Discord] Rôles récupérés:', roles)
    console.log('[Discord] Rôles configurés:', {
      ADMIN: DISCORD_ROLES.ADMIN,
      VIP: DISCORD_ROLES.VIP,
      BOOST: DISCORD_ROLES.BOOST,
      MEMBER: DISCORD_ROLES.MEMBER,
    })
    
    // Vérifier si les rôles correspondent
    const hasAdmin = roles.includes(DISCORD_ROLES.ADMIN)
    const hasVip = roles.includes(DISCORD_ROLES.VIP)
    const hasBoost = roles.includes(DISCORD_ROLES.BOOST)
    const hasMember = roles.includes(DISCORD_ROLES.MEMBER)
    
    console.log('[Discord] Vérification des rôles:', {
      hasAdmin,
      hasVip,
      hasBoost,
      hasMember,
    })
    
    // Retourner les IDs des rôles
    return roles
  } catch (error) {
    console.error('[Discord] Erreur lors de la récupération des rôles:', error.response?.data || error.message)
    console.error('[Discord] Status code:', error.response?.status)
    
    // Si l'utilisateur n'est pas dans le serveur ou n'a pas les permissions,
    // on essaie de vérifier s'il est au moins membre du serveur
    try {
      const guildsResponse = await axios.get('https://discord.com/api/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      
      console.log('[Discord] Serveurs de l\'utilisateur:', guildsResponse.data.map(g => ({ id: g.id, name: g.name })))
      
      // Vérifier si l'utilisateur est membre du serveur
      const isMember = guildsResponse.data.some(guild => guild.id === DISCORD_GUILD_ID)
      if (!isMember) {
        console.warn('[Discord] L\'utilisateur n\'est pas membre du serveur Discord avec l\'ID:', DISCORD_GUILD_ID)
        return []
      } else {
        console.log('[Discord] L\'utilisateur est membre du serveur, mais les rôles n\'ont pas pu être récupérés')
      }
    } catch (guildError) {
      console.error('[Discord] Erreur lors de la vérification des serveurs:', guildError.message)
    }
    
    // Retourner un tableau vide si on ne peut pas récupérer les rôles
    return []
  }
}

/**
 * Détermine le statut de l'utilisateur basé sur ses rôles Discord
 */
function determineUserStatus(roles) {
  const roleIds = roles || []
  
  console.log('[Discord] Détermination du statut avec les rôles:', roleIds)
  console.log('[Discord] Rôles attendus:', {
    ADMIN: DISCORD_ROLES.ADMIN,
    VIP: DISCORD_ROLES.VIP,
    BOOST: DISCORD_ROLES.BOOST,
    MEMBER: DISCORD_ROLES.MEMBER,
  })

  // Vérifier les rôles dans l'ordre de priorité (Admin > VIP > BOOST > Member)
  if (roleIds.includes(DISCORD_ROLES.ADMIN)) {
    console.log('[Discord] Statut déterminé: Admin')
    return {
      isAdmin: true,
      isVip: false,
      isBoost: false,
      role: 'admin',
    }
  }

  if (roleIds.includes(DISCORD_ROLES.VIP)) {
    console.log('[Discord] Statut déterminé: VIP')
    return {
      isAdmin: false,
      isVip: true,
      isBoost: false,
      role: 'vip',
    }
  }

  if (roleIds.includes(DISCORD_ROLES.BOOST)) {
    console.log('[Discord] Statut déterminé: BOOST')
    return {
      isAdmin: false,
      isVip: false,
      isBoost: true,
      role: 'boost',
    }
  }

  // Par défaut, membre
  console.log('[Discord] Statut déterminé: Member (par défaut)')
  return {
    isAdmin: false,
    isVip: false,
    isBoost: false,
    role: 'member',
  }
}

/**
 * Authentifie un utilisateur via Discord OAuth2
 */
export async function authenticateWithDiscord(code) {
  try {
    // 1. Échanger le code contre un token
    const tokenData = await exchangeCodeForToken(code)
    const { access_token, refresh_token } = tokenData

    // 2. Récupérer les informations de l'utilisateur
    const userInfo = await getUserInfo(access_token)

    // 3. Récupérer les rôles de l'utilisateur dans le serveur
    const roles = await getUserGuildRoles(access_token, userInfo.id)

    // 4. Déterminer le statut basé sur les rôles
    const status = determineUserStatus(roles)

    // 5. Créer l'objet utilisateur
    const user = {
      id: userInfo.id,
      username: userInfo.username,
      email: userInfo.email,
      avatar: userInfo.avatar
        ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`
        : null,
      discriminator: userInfo.discriminator,
      isAdmin: status.isAdmin,
      isVip: status.isVip,
      isBoost: status.isBoost,
      role: status.role,
      discordAccessToken: access_token,
      discordRefreshToken: refresh_token,
      discordRoles: roles,
    }

    return {
      success: true,
      user,
    }
  } catch (error) {
    console.error('Erreur lors de l\'authentification Discord:', error)
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'authentification Discord',
    }
  }
}

/**
 * Génère l'URL d'autorisation Discord
 */
export function getDiscordAuthUrl() {
  const scopes = ['identify', 'email', 'guilds', 'guilds.members.read']
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    prompt: 'consent', // Force l'affichage de la page d'autorisation
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

/**
 * Rafraîchit le token d'accès Discord
 */
export async function refreshDiscordToken(refreshToken) {
  try {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })

    const response = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    return response.data
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error.response?.data || error.message)
    throw new Error('Erreur lors du rafraîchissement du token Discord')
  }
}

