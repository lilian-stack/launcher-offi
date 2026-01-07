/**
 * Gestionnaire de sessions sécurisé
 * Stocke les tokens sensibles côté serveur uniquement
 * Le client reçoit un token de session non-sensible
 */

import crypto from 'crypto'

// Stockage en mémoire des sessions (en production, utiliser Redis ou une base de données)
const sessions = new Map()

// Durée de vie d'une session (7 jours)
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000

/**
 * Créer une nouvelle session avec les tokens Discord
 * @param {Object} tokens - Tokens Discord (access_token, refresh_token)
 * @param {Object} userData - Données utilisateur (sans tokens)
 * @returns {string} Token de session (non-sensible)
 */
export function createSession(tokens, userData) {
  // Générer un token de session unique et sécurisé
  const sessionToken = crypto.randomBytes(32).toString('hex')
  
  // Stocker les tokens sensibles côté serveur uniquement
  const session = {
    tokens: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    },
    userData: {
      // Ne stocker que les données non-sensibles
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      email: userData.email,
      isAdmin: userData.isAdmin || false,
      isVip: userData.isVip || false,
      isBoost: userData.isBoost || false,
      role: userData.role || 'member',
      discordRoles: userData.discordRoles || [],
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  }
  
  sessions.set(sessionToken, session)
  
  // Nettoyer les sessions expirées périodiquement
  cleanupExpiredSessions()
  
  return sessionToken
}

/**
 * Récupérer une session par son token
 * @param {string} sessionToken - Token de session
 * @returns {Object|null} Session ou null si invalide/expirée
 */
export function getSession(sessionToken) {
  if (!sessionToken) return null
  
  const session = sessions.get(sessionToken)
  
  if (!session) return null
  
  // Vérifier si la session est expirée
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionToken)
    return null
  }
  
  return session
}

/**
 * Mettre à jour les tokens d'une session
 * @param {string} sessionToken - Token de session
 * @param {Object} newTokens - Nouveaux tokens
 */
export function updateSessionTokens(sessionToken, newTokens) {
  const session = sessions.get(sessionToken)
  
  if (!session) return false
  
  session.tokens = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || session.tokens.refresh_token,
  }
  
  // Prolonger la session
  session.expiresAt = Date.now() + SESSION_DURATION
  
  return true
}

/**
 * Supprimer une session
 * @param {string} sessionToken - Token de session
 */
export function deleteSession(sessionToken) {
  if (sessionToken) {
    sessions.delete(sessionToken)
  }
}

/**
 * Nettoyer les sessions expirées
 */
function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token)
    }
  }
}

// Nettoyer toutes les 30 minutes
setInterval(cleanupExpiredSessions, 30 * 60 * 1000)

/**
 * Obtenir les statistiques des sessions (pour debug)
 */
export function getSessionStats() {
  return {
    total: sessions.size,
    active: Array.from(sessions.values()).filter(s => Date.now() < s.expiresAt).length,
  }
}


