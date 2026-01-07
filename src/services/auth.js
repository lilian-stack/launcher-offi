// Service d'authentification avec session sécurisée
// Les tokens sensibles sont stockés côté serveur uniquement
const AUTH_STORAGE_KEY = 'actoris_user'
const SESSION_TOKEN_KEY = 'actoris_session_token' // Token non-sensible uniquement

export const authService = {
  // Récupérer l'utilisateur connecté
  getCurrentUser() {
    try {
      const userStr = localStorage.getItem(AUTH_STORAGE_KEY)
      return userStr ? JSON.parse(userStr) : null
    } catch {
      return null
    }
  },

  // Sauvegarder l'utilisateur connecté
  setCurrentUser(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  },

  // Récupérer le token de session (non-sensible)
  getSessionToken() {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY)
    } catch {
      return null
    }
  },

  // Sauvegarder le token de session (non-sensible)
  setSessionToken(sessionToken) {
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
  },

  // Sauvegarder l'utilisateur et le token de session
  setAuthData(user, sessionToken) {
    this.setCurrentUser(user)
    this.setSessionToken(sessionToken)
  },

  // Déconnecter l'utilisateur (supprimer la session côté serveur)
  async logout() {
    const sessionToken = this.getSessionToken()
    
    // Supprimer la session côté serveur
    if (sessionToken && window.electron && window.electron.discord && window.electron.discord.logout) {
      try {
        await window.electron.discord.logout(sessionToken)
      } catch (err) {
        console.error('[Auth] Erreur lors de la déconnexion:', err)
      }
    }
    
    // Nettoyer le localStorage
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(SESSION_TOKEN_KEY)
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated() {
    const user = this.getCurrentUser()
    const sessionToken = this.getSessionToken()
    return user !== null && sessionToken !== null
  },

  // Restaurer la session depuis le serveur
  async restoreSession() {
    const sessionToken = this.getSessionToken()
    
    if (!sessionToken) {
      return null
    }

    // Vérifier la session côté serveur
    if (window.electron && window.electron.discord && window.electron.discord.getSession) {
      try {
        const result = await window.electron.discord.getSession(sessionToken)
        if (result && result.success && result.user) {
          // Mettre à jour les données utilisateur
          this.setCurrentUser(result.user)
          return result.user
        } else {
          // Session invalide, déconnecter
          this.logout()
          return null
        }
      } catch (err) {
        console.error('[Auth] Erreur lors de la restauration de la session:', err)
        // En cas d'erreur, utiliser les données locales si disponibles
        return this.getCurrentUser()
      }
    }

    // Fallback : utiliser les données locales
    return this.getCurrentUser()
  },

  // Synchroniser les rôles Discord (vérification périodique)
  async syncRoles() {
    const sessionToken = this.getSessionToken()
    
    if (!sessionToken) {
      return { success: false, error: 'Aucune session active' }
    }

    if (window.electron && window.electron.discord && window.electron.discord.syncRoles) {
      try {
        const result = await window.electron.discord.syncRoles(sessionToken)
        if (result && result.success && result.user) {
          // Mettre à jour les données utilisateur
          this.setCurrentUser(result.user)
          return {
            success: true,
            user: result.user,
            rolesChanged: result.rolesChanged || false,
            oldRoles: result.oldRoles,
            newRoles: result.newRoles
          }
        } else {
          return {
            success: false,
            error: result?.error || 'Erreur lors de la synchronisation'
          }
        }
      } catch (err) {
        console.error('[Auth] Erreur lors de la synchronisation des rôles:', err)
        return {
          success: false,
          error: err.message || 'Erreur lors de la synchronisation des rôles'
        }
      }
    }

    return { success: false, error: 'Les fonctions Discord ne sont pas disponibles' }
  },
}

