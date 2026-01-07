/**
 * API sécurisée pour l'authentification Discord
 * Tous les secrets sont stockés ici, JAMAIS dans le client
 */

import express from 'express'
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createSession, getSession, updateSessionTokens, deleteSession } from './session-manager.js'

// Import lazy de discord.js pour éviter les erreurs si le module n'est pas installé
let Client = null
let GatewayIntentBits = null
let discordJSLoaded = false

async function loadDiscordJS() {
  if (discordJSLoaded) return
  try {
    const discordJS = await import('discord.js')
    Client = discordJS.Client
    GatewayIntentBits = discordJS.GatewayIntentBits
    discordJSLoaded = true
  } catch (err) {
    // discord.js non disponible
  }
}

// Charger discord.js en arrière-plan (non bloquant)
loadDiscordJS().catch(() => {})

// Déterminer le chemin du fichier
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 🔧 Vérifier si les variables sont déjà chargées AVANT de recharger
const alreadyLoaded = !!process.env.DISCORD_CLIENT_ID && 
                      !!process.env.DISCORD_CLIENT_SECRET &&
                      !!process.env.DISCORD_TOKEN;

if (!alreadyLoaded) {
  // Essayer plusieurs emplacements pour le .env
  const envPaths = [
    process.env.ENV_FILE_PATH,                     // Passé depuis main.js
    path.join(process.env.APPDATA || '', 'actoris-launcher', '.env'),
    path.resolve(__dirname, '..', '.env'),         // Racine du projet
    path.resolve(__dirname, '..', '..', '.env'),   // Un niveau au-dessus
    path.resolve(process.cwd(), '.env'),           // Répertoire courant
  ].filter(Boolean);

  // Charger les fichiers .env SANS ÉCRASER les variables existantes
  let envLoaded = false
  let loadedEnvPath = null
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      // ⚠️ CRITIQUE: override: false pour ne PAS écraser les variables déjà chargées!
      dotenv.config({ path: envPath, override: false })
      envLoaded = true
      loadedEnvPath = envPath
      break
    }
  }

  if (!envLoaded) {
    dotenv.config({ override: false })
  }
}

const router = express.Router()

// ✅ TOUS LES SECRETS ICI (sur le serveur uniquement)
// ⚠️ IMPORTANT : DISCORD_TOKEN est le Bot Token (optionnel, pour discord.js)
// Pour OAuth, on utilise DISCORD_CLIENT_SECRET (différent !)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN

// CLIENT_ID - FORCER le fallback si la valeur est invalide
let DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID

if (DISCORD_CLIENT_ID) {
  DISCORD_CLIENT_ID = String(DISCORD_CLIENT_ID).trim()
  if (DISCORD_CLIENT_ID === 'undefined' || DISCORD_CLIENT_ID === 'null' || DISCORD_CLIENT_ID === '') {
    DISCORD_CLIENT_ID = '1398485031189483642'
  }
} else {
  DISCORD_CLIENT_ID = '1398485031189483642'
}

// CLIENT_SECRET - Nettoyer et valider
let DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET

// 🔍 DEBUG : Afficher la valeur brute

// Nettoyer le CLIENT_SECRET (enlever les espaces, vérifier qu'il n'est pas undefined/null)
if (DISCORD_CLIENT_SECRET) {
  DISCORD_CLIENT_SECRET = String(DISCORD_CLIENT_SECRET).trim()
  if (DISCORD_CLIENT_SECRET === 'undefined' || DISCORD_CLIENT_SECRET === 'null' || DISCORD_CLIENT_SECRET === '') {
    DISCORD_CLIENT_SECRET = null
    console.error('[Discord Auth API] ❌ DISCORD_CLIENT_SECRET est vide ou invalide après nettoyage')
    console.error('[Discord Auth API] 🔍 Valeur originale:', process.env.DISCORD_CLIENT_SECRET)
  } else {
  }
} else {
  console.error('[Discord Auth API] ❌ DISCORD_CLIENT_SECRET non défini dans process.env')
  console.error('[Discord Auth API] 🔍 Toutes les variables Discord disponibles:')
  console.error('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID || '❌')
  console.error('  DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET || '❌')
  console.error('  DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅' : '❌')
  console.error('  DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || '❌')
  console.error('  DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI || '❌')
}
const GUILD_ID = process.env.DISCORD_GUILD_ID
const ROLES = {
  MEMBER: process.env.DISCORD_ROLE_MEMBER,
  VIP: process.env.DISCORD_ROLE_VIP,
  BOOST: process.env.DISCORD_ROLE_BOOST,
  ADMIN: process.env.DISCORD_ROLE_ADMIN,
}

// Rôles configurés
// Roles loaded

// Client Discord pour vérifier les rôles
let discordClient = null

// Initialiser le client Discord si le token est disponible (après chargement de discord.js)
// ⚠️ IMPORTANT : Le bot Discord est optionnel - il est seulement nécessaire pour vérifier les rôles
// L'authentification OAuth fonctionne sans le bot (seulement avec CLIENT_SECRET)
async function initDiscordClient() {
  await loadDiscordJS()
  
  // Si le token n'est pas disponible, on ne fait rien (OAuth fonctionnera quand même)
  if (!DISCORD_TOKEN || DISCORD_TOKEN.trim() === '' || DISCORD_TOKEN === 'undefined') {
    return
  }
  
  if (Client && GatewayIntentBits) {
    try {
      discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
        ]
      })
      
      discordClient.on('error', (error) => {
        console.error('[Discord Auth API] Erreur du client Discord:', error.message)
      })
      
      discordClient.once('ready', () => {
        if (GUILD_ID) {
          const guild = discordClient.guilds.cache.get(GUILD_ID)
          if (guild) {
          } else {
            console.warn('[Discord Auth API] ⚠️  Serveur Discord non trouvé (GUILD_ID:', GUILD_ID, ')')
            console.warn('[Discord Auth API] 🔍 Serveurs disponibles:', Array.from(discordClient.guilds.cache.keys()))
          }
        }
      })
      
      discordClient.login(DISCORD_TOKEN).catch(err => {
        // Vérifier si c'est une erreur de token invalide
        if (err.message && err.message.includes('invalid token')) {
          console.warn('[Discord Auth API] ⚠️  DISCORD_TOKEN invalide ou expiré (non bloquant)')
          console.warn('[Discord Auth API] ℹ️  Pour obtenir un nouveau token: https://discord.com/developers/applications > Bot > Token')
          console.warn('[Discord Auth API] ℹ️  L\'authentification OAuth fonctionnera quand même (nécessite seulement DISCORD_CLIENT_SECRET)')
        } else {
          console.error('[Discord Auth API] ⚠️  Erreur de connexion Discord (non bloquant):', err.message)
          console.error('[Discord Auth API] 🔍 Détails de l\'erreur:', err.code, err.httpStatus)
          console.error('[Discord Auth API] ℹ️  L\'authentification OAuth fonctionnera quand même')
        }
        discordClient = null // Réinitialiser pour éviter les tentatives répétées
      })
    } catch (err) {
      console.error('[Discord Auth API] ⚠️  Impossible d\'initialiser le client Discord (non bloquant):', err.message)
      console.error('[Discord Auth API] ℹ️  L\'authentification OAuth fonctionnera quand même')
    }
  }
}

// Initialiser en arrière-plan (non bloquant)
// Ne pas bloquer si l'initialisation échoue - OAuth fonctionne sans le bot
initDiscordClient().catch((err) => {
})

/**
 * Fonction helper pour vérifier un token et obtenir les infos utilisateur
 * Utilisée en interne pour créer les sessions
 */
async function verifyUserToken(accessToken) {
  try {
    if (!accessToken) {
      return { success: false, error: 'Token d\'accès manquant' }
    }

    // Vérifier le token avec Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const userInfo = userResponse.data

    // Récupérer les rôles de l'utilisateur dans le serveur
    let roles = []
    let userStatus = {
      isAdmin: false,
      isVip: false,
      isBoost: false,
      role: 'member'
    }

    // Méthode principale : Utiliser discord.js bot (plus fiable)
    await loadDiscordJS()
    
    if (discordClient && discordClient.isReady() && GUILD_ID) {
      try {
        const guild = discordClient.guilds.cache.get(GUILD_ID)
        
        if (guild) {
          const member = await guild.members.fetch(userInfo.id).catch((err) => {
            console.warn('[Discord Auth API] ⚠️  Impossible de récupérer le membre:', err.message)
            return null
          })
          
          if (member) {
            roles = Array.from(member.roles.cache.keys())
            
            // Déterminer le statut basé sur les rôles
            if (roles.includes(ROLES.ADMIN)) {
              userStatus = { isAdmin: true, isVip: true, isBoost: false, role: 'admin' }
            } else if (roles.includes(ROLES.VIP)) {
              userStatus = { isAdmin: false, isVip: true, isBoost: false, role: 'vip' }
            } else if (roles.includes(ROLES.BOOST)) {
              userStatus = { isAdmin: false, isVip: false, isBoost: true, role: 'boost' }
            } else {
              userStatus = { isAdmin: false, isVip: false, isBoost: false, role: 'member' }
            }
          } else {
            console.warn('[Discord Auth API] ⚠️  Utilisateur non trouvé dans le serveur Discord')
          }
        } else {
          console.warn('[Discord Auth API] ⚠️  Serveur Discord non trouvé (GUILD_ID:', GUILD_ID, ')')
        }
      } catch (botError) {
        console.error('[Discord Auth API] ❌ Erreur lors de la récupération des rôles via bot:', botError.message)
        console.error('[Discord Auth API] 🔍 Stack:', botError.stack)
      }
    } else {
      console.warn('[Discord Auth API] ⚠️  Bot Discord non disponible (client:', !!discordClient, ', ready:', discordClient?.isReady(), ', GUILD_ID:', GUILD_ID, ')')
      
      // Méthode de fallback : Utiliser l'API Discord OAuth (si le bot n'est pas disponible)
      if (GUILD_ID) {
        try {
          const memberResponse = await axios.get(
            `https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          )
          
          if (memberResponse.data && memberResponse.data.roles) {
            roles = memberResponse.data.roles || []
            
            // Déterminer le statut basé sur les rôles
            if (roles.includes(ROLES.ADMIN)) {
              userStatus = { isAdmin: true, isVip: true, isBoost: false, role: 'admin' }
            } else if (roles.includes(ROLES.VIP)) {
              userStatus = { isAdmin: false, isVip: true, isBoost: false, role: 'vip' }
            } else if (roles.includes(ROLES.BOOST)) {
              userStatus = { isAdmin: false, isVip: false, isBoost: true, role: 'boost' }
            } else {
              userStatus = { isAdmin: false, isVip: false, isBoost: false, role: 'member' }
            }
          }
        } catch (oauthError) {
          console.warn('[Discord Auth API] ⚠️  Impossible de récupérer les rôles via OAuth:', oauthError.response?.status, oauthError.response?.data?.message || oauthError.message)
          console.warn('[Discord Auth API] ⚠️  Les rôles ne peuvent pas être vérifiés. L\'utilisateur sera considéré comme MEMBER.')
        }
      }
    }

    // Retourner les informations utilisateur
    return {
      success: true,
      user: {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        avatar: userInfo.avatar
          ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.png`
          : null,
        discriminator: userInfo.discriminator,
        ...userStatus,
        discordRoles: roles,
      }
    }
  } catch (error) {
    console.error('[Discord Auth API] Erreur:', error.response?.data || error.message)
    return { 
      success: false, 
      error: 'Token invalide ou expiré' 
    }
  }
}

/**
 * Endpoint pour vérifier un token (pour compatibilité)
 * POST /api/discord/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { accessToken } = req.body
    
    if (!accessToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token d\'accès manquant' 
      })
    }

    const result = await verifyUserToken(accessToken)
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(401).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification'
    })
  }
})

/**
 * Échanger un code OAuth contre un token et créer une session
 * POST /api/discord/exchange-code
 */
router.post('/exchange-code', async (req, res) => {
  try {
    const { code, redirectUri } = req.body
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code d\'autorisation manquant' 
      })
    }

    // IMPORTANT : Le redirect_uri doit être EXACTEMENT le même que celui de l'autorisation
    const finalRedirectUri = (redirectUri || process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback').replace(/\/$/, '')
    const safeClientId = DISCORD_CLIENT_ID || '1398485031189483642'
    const safeClientSecret = DISCORD_CLIENT_SECRET
    
    // Log de diagnostic détaillé
    console.log('  CLIENT_SECRET:', safeClientSecret ? `✅ (${safeClientSecret.substring(0, 10)}...)` : '❌ MANQUANT')
    console.log('  ⚠️  DOIT être identique à celui de l\'autorisation !')
    
    // Vérifier si on a récemment fait trop de requêtes (rate limiting)
    const rateLimitKey = `discord_rate_limit_${safeClientId}`
    const lastRequestTime = global[rateLimitKey] || 0
    const timeSinceLastRequest = Date.now() - lastRequestTime
    const MIN_DELAY_BETWEEN_REQUESTS = 2000 // 2 secondes minimum entre les requêtes
    
    if (timeSinceLastRequest < MIN_DELAY_BETWEEN_REQUESTS) {
      const waitTime = MIN_DELAY_BETWEEN_REQUESTS - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    global[rateLimitKey] = Date.now()
    
    // ⚠️ MODE DÉGRADÉ : Si CLIENT_SECRET n'est pas configuré, retourner une erreur explicative
    // En production, le backend devrait être sur un serveur distant avec les secrets
    if (!safeClientSecret || safeClientSecret === 'undefined' || safeClientSecret.trim() === '') {
      console.error('[Discord Auth API] ❌ DISCORD_CLIENT_SECRET non configuré - Mode dégradé')
      console.error('[Discord Auth API] 🔍 Variables d\'environnement disponibles:')
      console.error('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅' : '❌')
      console.error('  DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '✅' : '❌')
      return res.status(503).json({
        success: false,
        error: 'Service Discord temporairement indisponible. Le backend nécessite une configuration serveur.',
        requiresServerConfig: true,
        message: 'Cette fonctionnalité nécessite un serveur backend configuré avec les identifiants Discord.'
      })
    }
    
    // Nettoyer le CLIENT_SECRET avant l'envoi (supprimer tous les caractères invisibles)
    const cleanedClientSecret = safeClientSecret ? safeClientSecret.trim().replace(/[\u200B-\u200D\uFEFF]/g, '') : null
    
    // Vérifier que le CLIENT_SECRET est valide avant d'envoyer
    if (!cleanedClientSecret || cleanedClientSecret.length < 20) {
      console.error('[Discord Auth API] ❌ CLIENT_SECRET invalide ou trop court')
      console.error('[Discord Auth API]   Longueur:', cleanedClientSecret ? cleanedClientSecret.length : 0)
      return res.status(400).json({
        success: false,
        error: 'Configuration Discord invalide',
        errorCode: 'INVALID_CLIENT',
        message: 'Le CLIENT_SECRET Discord est invalide ou manquant. Vérifiez votre configuration dans le portail Discord.',
        details: 'Assurez-vous que le CLIENT_SECRET dans votre fichier .env correspond à celui de votre application Discord.'
      })
    }
    
    // Préparer les paramètres pour le token exchange
    const tokenParams = new URLSearchParams({
      client_id: safeClientId,
      client_secret: cleanedClientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: finalRedirectUri,
    })
    
    // Logs de debug détaillés
    console.log('  client_secret:', cleanedClientSecret ? `${cleanedClientSecret.substring(0, 10)}...` : '❌ MANQUANT')
    console.log('  code:', code ? `${code.substring(0, 10)}...` : '❌ MANQUANT')
    
    let tokenResponse
    try {
      tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
        tokenParams,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000
        }
      )
      
    } catch (axiosError) {
      // Gérer les erreurs Discord OAuth
      const errorData = axiosError.response?.data
      const errorMessage = errorData?.error || axiosError.message
      
      console.error('[Discord Auth API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('[Discord Auth API] ❌ ERREUR lors de l\'échange du code OAuth')
      console.error('[Discord Auth API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('  Status:', axiosError.response?.status)
      console.error('  Erreur Discord:', errorMessage)
      console.error('  Description:', errorData?.error_description || 'Aucune description')
      console.error('  Code utilisé:', code ? `${code.substring(0, 10)}...` : '❌ MANQUANT')
      console.error('  redirect_uri envoyé:', finalRedirectUri)
      console.error('  client_id envoyé:', safeClientId)
      console.error('  client_secret longueur:', cleanedClientSecret ? cleanedClientSecret.length : 0)
      console.error('  ⚠️  Vérifiez que le redirect_uri est IDENTIQUE à celui de l\'autorisation !')
      console.error('  ⚠️  Vérifiez que le CLIENT_SECRET correspond au CLIENT_ID dans Discord !')
      console.error('[Discord Auth API] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      // Messages d'erreur spécifiques selon le type d'erreur
      if (errorMessage === 'invalid_client') {
        return res.status(400).json({
          success: false,
          error: 'Configuration Discord invalide',
          errorCode: 'INVALID_CLIENT',
          message: 'Le CLIENT_SECRET Discord est incorrect ou ne correspond pas au CLIENT_ID. Vérifiez votre configuration dans le portail Discord.',
          details: `Vérifiez que le CLIENT_SECRET dans votre fichier .env correspond bien au CLIENT_ID ${safeClientId}. Si vous avez réinitialisé le CLIENT_SECRET dans Discord, vous devez mettre à jour votre fichier .env.`,
          troubleshooting: [
            '1. Allez sur https://discord.com/developers/applications',
            `2. Sélectionnez l'application avec le CLIENT_ID: ${safeClientId}`,
            '3. Allez dans l\'onglet "OAuth2"',
            '4. Vérifiez que le CLIENT_SECRET correspond à celui dans votre fichier .env',
            '5. Si vous avez réinitialisé le CLIENT_SECRET, copiez le nouveau et mettez-le à jour dans .env'
          ]
        })
      }
      
      if (errorMessage === 'invalid_grant') {
        return res.status(400).json({
          success: false,
          error: 'Code d\'autorisation invalide ou expiré',
          errorCode: 'INVALID_GRANT',
          message: 'Le code d\'autorisation est invalide, expiré ou a déjà été utilisé.'
        })
      }
      
      if (errorMessage === 'invalid_redirect_uri') {
        return res.status(400).json({
          success: false,
          error: 'URL de redirection invalide',
          errorCode: 'INVALID_REDIRECT_URI',
          message: `L'URL de redirection "${finalRedirectUri}" ne correspond pas à celle configurée dans le portail Discord.`,
          details: 'Vérifiez que l\'URL de redirection dans Discord correspond exactement à: http://localhost:5173/auth/callback'
        })
      }
      
      // Gestion spéciale du rate limiting
      if (errorData?.error_description?.includes('rate limited') || 
          errorData?.error_description?.includes('rate limit') ||
          axiosError.response?.status === 429) {
        const retryAfter = errorData?.retry_after || 60
        return res.status(429).json({
          success: false,
          error: 'rate_limited',
          errorCode: 'RATE_LIMITED',
          message: `Trop de tentatives de connexion. Veuillez patienter ${retryAfter} secondes avant de réessayer.`,
          retry_after: retryAfter,
          user_message: `Trop de tentatives de connexion. Veuillez patienter ${retryAfter} secondes avant de réessayer.`
        })
      }
      
      // Erreur générique
      return res.status(400).json({
        success: false,
        error: 'Erreur lors de l\'authentification Discord',
        errorCode: errorMessage?.toUpperCase() || 'UNKNOWN_ERROR',
        message: errorData?.error_description || 'Une erreur est survenue lors de la communication avec Discord.',
        user_message: errorData?.error_description || 'Une erreur est survenue lors de la communication avec Discord.',
        details: errorMessage
      })
    }

    const tokenData = tokenResponse.data
    const { access_token, refresh_token } = tokenData

    // Vérifier le token et obtenir les infos utilisateur
    const verifyResult = await verifyUserToken(access_token)
    
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        error: verifyResult.error || 'Erreur lors de la vérification'
      })
    }

    // Créer une session côté serveur avec les tokens sensibles
    const sessionToken = createSession(
      { access_token, refresh_token },
      verifyResult.user
    )

    // Retourner uniquement le token de session (non-sensible) et les données utilisateur
    res.json({
      success: true,
      sessionToken, // Token non-sensible à stocker côté client
      user: verifyResult.user, // Données utilisateur sans tokens
      // Ne PAS retourner les tokens Discord (stockés côté serveur uniquement)
    })
  } catch (error) {
    // Si l'erreur a déjà été gérée (axiosError avec réponse), elle ne devrait pas arriver ici
    // Mais on gère les autres erreurs (réseau, timeout, etc.)
    console.error('[Discord Auth API] ❌ Erreur inattendue lors de l\'échange du code:', error)
    
    const errorMessage = error.response?.data?.error_description || 
                        error.response?.data?.error || 
                        error.message || 
                        'Erreur lors de l\'échange du code'
    
    // Si c'est une erreur réseau ou timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({
        success: false,
        error: 'Timeout lors de la communication avec Discord',
        errorCode: 'TIMEOUT',
        message: 'La connexion avec Discord a pris trop de temps. Veuillez réessayer.'
      })
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Impossible de se connecter à Discord',
        errorCode: 'NETWORK_ERROR',
        message: 'Vérifiez votre connexion internet et réessayez.'
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      errorCode: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue lors de l\'authentification.'
    })
  }
})

/**
 * Rafraîchir un token Discord via session
 * POST /api/discord/refresh-token
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { sessionToken } = req.body
    
    if (!sessionToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token de session manquant' 
      })
    }

    // Récupérer la session
    const session = getSession(sessionToken)
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée'
      })
    }

    // Utiliser le refresh_token stocké côté serveur
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: session.tokens.refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    )

    const { access_token, refresh_token } = tokenResponse.data

    // Mettre à jour les tokens dans la session
    updateSessionTokens(sessionToken, { access_token, refresh_token })

    res.json({
      success: true,
      // Ne retourner que le token de session (les tokens Discord restent côté serveur)
      sessionToken
    })
  } catch (error) {
    console.error('[Discord Auth API] Erreur refresh:', error.response?.data || error.message)
    res.status(400).json({ 
      success: false, 
      error: 'Erreur lors du rafraîchissement du token' 
    })
  }
})

/**
 * Récupérer les informations de session
 * POST /api/discord/session
 */
router.post('/session', async (req, res) => {
  try {
    const { sessionToken } = req.body
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'Token de session manquant'
      })
    }

    const session = getSession(sessionToken)
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée'
      })
    }

    // Retourner uniquement les données utilisateur (sans tokens)
    res.json({
      success: true,
      user: session.userData
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de la session'
    })
  }
})

/**
 * Supprimer une session (déconnexion)
 * POST /api/discord/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body
    
    if (sessionToken) {
      deleteSession(sessionToken)
    }

    res.json({
      success: true,
      message: 'Session supprimée'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion'
    })
  }
})

/**
 * Synchroniser les rôles Discord (vérification périodique)
 * POST /api/discord/sync-roles
 */
router.post('/sync-roles', async (req, res) => {
  try {
    const { sessionToken } = req.body
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'Token de session manquant'
      })
    }

    // Récupérer la session
    const session = getSession(sessionToken)
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée'
      })
    }

    // Récupérer les rôles actuels avec l'access_token
    let accessToken = session.tokens.access_token
    let result = await verifyUserToken(accessToken)
    
    // Si le token a expiré, essayer de le rafraîchir
    if (!result.success && result.error && result.error.includes('expiré')) {
      try {
        // Rafraîchir le token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
          new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: session.tokens.refresh_token,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            }
          }
        )

        const { access_token, refresh_token } = tokenResponse.data
        
        // Mettre à jour les tokens dans la session
        updateSessionTokens(sessionToken, { access_token, refresh_token })
        
        // Réessayer avec le nouveau token
        accessToken = access_token
        result = await verifyUserToken(accessToken)
      } catch (refreshError) {
        console.error('[Discord Auth API] Erreur lors du rafraîchissement du token:', refreshError.response?.data || refreshError.message)
        return res.status(401).json({
          success: false,
          error: 'Token expiré et impossible à rafraîchir'
        })
      }
    }

    if (!result.success || !result.user) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Impossible de récupérer les rôles'
      })
    }

    // Comparer les anciens et nouveaux rôles
    const oldRoles = {
      isAdmin: session.userData.isAdmin,
      isVip: session.userData.isVip,
      isBoost: session.userData.isBoost,
      role: session.userData.role,
      discordRoles: session.userData.discordRoles || []
    }

    const newRoles = {
      isAdmin: result.user.isAdmin,
      isVip: result.user.isVip,
      isBoost: result.user.isBoost,
      role: result.user.role,
      discordRoles: result.user.discordRoles || []
    }

    // Mettre à jour les données utilisateur dans la session
    session.userData = {
      ...session.userData,
      ...newRoles
    }

    // Vérifier si les rôles ont changé
    const rolesChanged = 
      oldRoles.isAdmin !== newRoles.isAdmin ||
      oldRoles.isVip !== newRoles.isVip ||
      oldRoles.isBoost !== newRoles.isBoost ||
      oldRoles.role !== newRoles.role ||
      JSON.stringify(oldRoles.discordRoles) !== JSON.stringify(newRoles.discordRoles)

    res.json({
      success: true,
      user: session.userData,
      rolesChanged,
      oldRoles,
      newRoles
    })
  } catch (error) {
    console.error('[Discord Auth API] Erreur sync-roles:', error.response?.data || error.message)
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation des rôles'
    })
  }
})

/**
 * Obtenir l'URL d'autorisation Discord
 * GET /api/discord/auth-url
 */
router.get('/auth-url', (req, res) => {
  try {
    // IMPORTANT : Utiliser EXACTEMENT le même redirect_uri que dans le token exchange
    let redirectUri = req.query.redirect_uri || process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback'
    
    // Décoder le redirect_uri s'il est déjà encodé (Express peut le décoder automatiquement, mais on s'assure)
    if (typeof redirectUri === 'string') {
      try {
        // Si le redirect_uri est déjà encodé, le décoder d'abord
        const decoded = decodeURIComponent(redirectUri)
        // Vérifier si le décodage a changé quelque chose (signe qu'il était encodé)
        if (decoded !== redirectUri && decoded.match(/^https?:\/\//)) {
          redirectUri = decoded
        }
      } catch (e) {
        // Si le décodage échoue, utiliser la valeur originale
      }
    }
    
    // Nettoyer et valider le redirect_uri
    redirectUri = String(redirectUri).trim().replace(/\/$/, '')
    
    // Vérifier que le redirect_uri commence par http:// ou https://
    if (!redirectUri.match(/^https?:\/\//)) {
      // Si le redirect_uri ne commence pas par http:// ou https://, essayer de le corriger
      if (redirectUri.startsWith('//')) {
        redirectUri = 'http:' + redirectUri
      } else if (redirectUri.startsWith('localhost') || redirectUri.startsWith('127.0.0.1')) {
        redirectUri = 'http://' + redirectUri
      } else {
        // Utiliser la valeur par défaut si le format est invalide
        redirectUri = 'http://localhost:5173/auth/callback'
      }
    }
    
    // Normaliser localhost en 127.0.0.1 si nécessaire (Discord peut être strict)
    // Mais gardons localhost par défaut car c'est ce qui est configuré dans Discord
    // redirectUri = redirectUri.replace(/^http:\/\/localhost:/, 'http://127.0.0.1:')
    
    // Scopes OAuth utilisateur valides (guilds.members.read nécessite bot scope)
    const scopes = ['identify', 'email', 'guilds']
    const clientId = '1398485031189483642'
    
    // Log pour vérifier le redirect_uri utilisé
    console.log('  ⚠️  Ce redirect_uri DOIT être identique à celui du token exchange !')
    
    // Nettoyer le redirect_uri (supprimer les espaces, caractères invisibles)
    const cleanedRedirectUri = redirectUri.trim().replace(/[\u200B-\u200D\uFEFF]/g, '')
    
    // Vérification finale que le redirect_uri est valide
    if (!cleanedRedirectUri.match(/^https?:\/\/[^\s]+$/)) {
      throw new Error(`redirect_uri invalide: "${cleanedRedirectUri}"`)
    }
    
    // Utiliser le redirect_uri tel quel (ne PAS ajouter /auth/callback)
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(cleanedRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(' '))}&integration_type=0&prompt=consent`
    
    // Log détaillé pour debug
    console.log('  ⚠️  VÉRIFIEZ que ce redirect_uri correspond EXACTEMENT à celui dans Discord!')
    
    if (authUrl.includes('client_id=undefined') || authUrl.includes('client_id=null')) {
      throw new Error('Impossible de générer une URL valide')
    }
    
    res.json({
      success: true,
      url: authUrl
    })
  } catch (error) {
    console.error('[Discord Auth API] Erreur auth-url:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la génération de l\'URL'
    })
  }
})

export default router

