// Configuration Discord OAuth2 - CLIENT UNIQUEMENT
// ⚠️ ATTENTION : Les secrets (CLIENT_SECRET, tokens) sont maintenant sur le SERVEUR
// Ce fichier contient uniquement les informations publiques nécessaires au client

// CLIENT_ID par défaut - TOUJOURS défini
const DEFAULT_CLIENT_ID = '1398485031189483642'
// Pour ton application actuelle, Discord est configuré avec http://localhost:5173/auth/callback
// donc on garde cette URL comme redirect_uri par défaut
const DEFAULT_REDIRECT_URI = 'http://localhost:5173/auth/callback'

// Récupérer le CLIENT_ID depuis les variables d'environnement ou utiliser la valeur par défaut
const getClientId = () => {
  try {
    // En Electron, process.env peut ne pas être disponible dans le renderer
    const envClientId = typeof process !== 'undefined' && process.env?.DISCORD_CLIENT_ID
    // Vérifier que la valeur n'est pas vide, undefined, null, ou la string "undefined"
    if (envClientId && 
        envClientId !== 'undefined' && 
        envClientId !== 'null' && 
        String(envClientId).trim() !== '') {
      const cleaned = String(envClientId).trim()
      if (cleaned.length >= 10) {
        return cleaned
      }
    }
  } catch (err) {
    console.warn('[Discord Config] Erreur lors de la récupération de DISCORD_CLIENT_ID:', err)
  }
  // Fallback hardcodé - TOUJOURS retourner une valeur valide
  return DEFAULT_CLIENT_ID
}

const getRedirectUri = () => {
  try {
    const envRedirectUri = typeof process !== 'undefined' && process.env?.DISCORD_REDIRECT_URI
    if (envRedirectUri && String(envRedirectUri).trim() !== '') {
      return String(envRedirectUri).trim()
    }
  } catch (err) {
    console.warn('[Discord Config] Erreur lors de la récupération de DISCORD_REDIRECT_URI:', err)
  }
  return DEFAULT_REDIRECT_URI
}

// FORCER la valeur du CLIENT_ID pour éviter undefined
const CLIENT_ID_VALUE = getClientId()
const REDIRECT_URI_VALUE = getRedirectUri()

// Vérification finale - si CLIENT_ID est toujours undefined/null, utiliser le fallback
const FINAL_CLIENT_ID = (CLIENT_ID_VALUE && 
                         CLIENT_ID_VALUE !== 'undefined' && 
                         CLIENT_ID_VALUE !== 'null' && 
                         String(CLIENT_ID_VALUE).trim() !== '' &&
                         String(CLIENT_ID_VALUE).trim().length >= 10) 
                         ? String(CLIENT_ID_VALUE).trim() 
                         : DEFAULT_CLIENT_ID

// Vérification de sécurité finale
if (!FINAL_CLIENT_ID || FINAL_CLIENT_ID === 'undefined' || FINAL_CLIENT_ID === 'null') {
  console.error('[Discord Config] ❌ ERREUR CRITIQUE: CLIENT_ID est undefined/null!')
  console.error('[Discord Config] ❌ Utilisation du fallback forcé')
}

export const DISCORD_CONFIG = {
  // Client ID (peut être public, utilisé pour OAuth)
  // FORCER la valeur pour éviter undefined - TOUJOURS utiliser DEFAULT_CLIENT_ID si problème
  CLIENT_ID: FINAL_CLIENT_ID || DEFAULT_CLIENT_ID,

  // URL de redirection (doit être configurée dans les paramètres OAuth2 de Discord)
  REDIRECT_URI: REDIRECT_URI_VALUE || DEFAULT_REDIRECT_URI,
  
  // ⚠️ CLIENT_SECRET, GUILD_ID, ROLES sont maintenant sur le SERVEUR uniquement
  // Voir server/discord-auth-api.js pour la configuration serveur
}

// Log pour vérification (seulement en dev)
if (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'development' || process.env?.VITE_DEV_SERVER === 'true')) {
}
