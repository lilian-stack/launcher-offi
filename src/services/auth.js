// Service d'authentification
const AUTH_STORAGE_KEY = 'actoris_user'

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

  // Déconnecter l'utilisateur
  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated() {
    return this.getCurrentUser() !== null
  },
}

