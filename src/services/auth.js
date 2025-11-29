// Service d'authentification avec token JWT persistant
const AUTH_STORAGE_KEY = 'actoris_user'
const TOKEN_STORAGE_KEY = 'actoris_token'
const REFRESH_TOKEN_STORAGE_KEY = 'actoris_refresh_token'

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

  // Récupérer le token JWT
  getToken() {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },

  // Sauvegarder le token JWT
  setToken(token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  },

  // Récupérer le refresh token
  getRefreshToken() {
    try {
      return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
    } catch {
      return null
    }
  },

  // Sauvegarder le refresh token
  setRefreshToken(refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
  },

  // Sauvegarder les tokens et l'utilisateur
  setAuthData(user, token, refreshToken) {
    this.setCurrentUser(user)
    this.setToken(token)
    this.setRefreshToken(refreshToken)
  },

  // Déconnecter l'utilisateur
  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated() {
    const user = this.getCurrentUser()
    const token = this.getToken()
    return user !== null && token !== null
  },

  // Vérifier si le token est valide (non expiré)
  isTokenValid() {
    const token = this.getToken()
    if (!token) return false

    try {
      // Décoder le JWT (sans vérifier la signature)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expirationTime = payload.exp * 1000 // Convertir en millisecondes
      return Date.now() < expirationTime
    } catch {
      return false
    }
  },

  // Restaurer la session depuis le localStorage
  async restoreSession() {
    if (!this.isAuthenticated()) {
      return null
    }

    // Vérifier si le token est toujours valide
    if (!this.isTokenValid()) {
      const refreshToken = this.getRefreshToken()
      
      // Essayer de rafraîchir le token
      if (refreshToken && window.electron && window.electron.discord && window.electron.discord.refreshToken) {
        try {
          const result = await window.electron.discord.refreshToken(refreshToken)
          if (result && result.token) {
            this.setToken(result.token)
            if (result.refreshToken) {
              this.setRefreshToken(result.refreshToken)
            }
            return this.getCurrentUser()
          }
        } catch (err) {
          console.error('[Auth] Erreur lors du rafraîchissement du token:', err)
          this.logout()
          return null
        }
      } else {
        // Pas de refresh token, déconnecter
        this.logout()
        return null
      }
    }

    return this.getCurrentUser()
  },
}

