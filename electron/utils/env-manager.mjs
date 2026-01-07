/**
 * Gestionnaire de configuration environnement (.env)
 * Utilise secure-config.js pour les secrets sensibles (keytar)
 */
import electron from 'electron';
const { app } = electron
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { log, errorLog } from './logger.mjs'
import { API_URL } from './config.mjs'
import { initializeSecureConfig, getAllEnvVars } from './secure-config.mjs'

/**
 * Créer le fichier .env s'il n'existe pas
 */
export function ensureEnvFile() {
  try {
    const envPath = path.join(app.getPath('userData'), '.env')
    
    log('[Setup] 🔍 Vérification du fichier .env...')
    log('[Setup] 📁 Chemin:', envPath)
    
    if (!fs.existsSync(envPath)) {
      log('[Setup] 📝 Création du fichier .env...')
      
      const envTemplate = `# Configuration Discord (SERVEUR UNIQUEMENT - JAMAIS dans le client)
# ⚠️ IMPORTANT : Remplir ces valeurs depuis votre serveur Discord
DISCORD_TOKEN=
DISCORD_CLIENT_ID=1398485031189483642
DISCORD_CLIENT_SECRET=
DISCORD_GUILD_ID=1332072935682478202

# Rôles Discord
DISCORD_ROLE_MEMBER=1332077241722605700
DISCORD_ROLE_VIP=1351995593383350302
DISCORD_ROLE_BOOST=1332111013205770282
DISCORD_ROLE_ADMIN=1332076547422683268

# Configuration serveur
PORT=3001
WS_PORT=8080

# URLs
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
API_URL=http://127.0.0.1:3001
WS_URL=ws://127.0.0.1:8080

# Configuration générale
NODE_ENV=production
`
      
      fs.writeFileSync(envPath, envTemplate, 'utf8')
      log('[Setup] ✅ Fichier .env créé avec succès')
    } else {
      log('[Setup] ✅ Fichier .env existe déjà')
    }
  } catch (err) {
    errorLog('[Setup] ❌ Erreur lors de la création du .env:', err)
  }
}

/**
 * Charger le fichier .env et les secrets depuis keytar
 * Utilise secure-config pour les secrets sensibles
 */
export async function loadEnvFile() {
  try {
    // 1. Initialiser le système de configuration sécurisée
    await initializeSecureConfig()
    
    // 2. Charger toutes les variables (secrets depuis keytar + autres depuis .env)
    const envVars = await getAllEnvVars()
    
    // 3. Définir les variables dans process.env pour compatibilité
    for (const [key, value] of Object.entries(envVars)) {
      if (value) {
        process.env[key] = value
      }
    }
    
    log('[Setup] ✅ Configuration chargée (secrets depuis keytar + .env)')
    log('[Setup] 🔗 DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI)
    
    // Vérifier les variables critiques
    const criticalVars = [
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
      'DISCORD_TOKEN',
      'DISCORD_GUILD_ID'
    ]
    
    const missingVars = criticalVars.filter(v => !process.env[v])
    if (missingVars.length > 0) {
      log('[Setup] ⚠️ Variables manquantes:', missingVars.join(', '))
      log('[Setup] ⚠️ Le serveur backend nécessite ces variables pour fonctionner correctement')
      log('[Setup] 💡 Utilisez setSecret() pour définir les secrets manquants')
    }
    
    return true
  } catch (err) {
    errorLog('[Setup] ❌ Erreur lors du chargement de la configuration:', err)
    return false
  }
}

/**
 * Obtenir toutes les variables d'environnement (pour passer au backend)
 */
export async function getAllEnvironmentVariables() {
  return await getAllEnvVars()
}

/**
 * Initialiser le service Discord
 */
export async function initializeDiscordService() {
  try {
    const { getDiscordService } = await import('./services-loader.mjs')
    const service = await getDiscordService()
    
    if (!service) {
      errorLog('[Main] ❌ discordService est null après chargement')
      return false
    }
    
    if (typeof service.getDiscordAuthUrl !== 'function') {
      errorLog('[Main] ❌ getDiscordAuthUrl n\'est pas une fonction!')
      return false
    }
    
    log('[Main] ✅ Service Discord initialisé et vérifié avec succès')
    return true
  } catch (err) {
    errorLog('[Main] ❌ Erreur lors de l\'initialisation du service Discord:', err)
    return false
  }
}
