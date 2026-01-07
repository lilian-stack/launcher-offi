/**
 * Service principal pour la gestion des jeux
 * Intègre les données Supabase et les métadonnées locales
 */

import { gamesMetadataService } from './gamesMetadata.js'

class GamesService {
  constructor() {
    this.games = []
    this.lastUpdated = null
    this.isLoading = false
  }

  /**
   * Récupérer tous les jeux
   */
  async getAllGames() {
    try {
      if (this.isLoading) {
        console.log('[GamesService] Chargement en cours...')
        return this.games
      }

      this.isLoading = true
      console.log('[GamesService] 🎮 Récupération de tous les jeux...')

      // Essayer de charger depuis Supabase d'abord
      let games = await this.loadFromSupabase()
      
      // Fallback: charger depuis le fichier local
      if (!games || games.length === 0) {
        games = await this.loadFromLocal()
      }

      // Enrichir avec les métadonnées
      games = await this.enrichWithMetadata(games)

      this.games = games
      this.lastUpdated = new Date().toISOString()
      this.isLoading = false

      console.log('[GamesService] ✅ Chargé', games.length, 'jeux')
      return games

    } catch (error) {
      console.error('[GamesService] ❌ Erreur lors du chargement des jeux:', error)
      this.isLoading = false
      return []
    }
  }

  /**
   * Charger les jeux depuis Supabase
   */
  async loadFromSupabase() {
    try {
      // Configuration Supabase
      const SUPABASE_URL = 'https://fpxcefuqwvwdduzkmkrj.supabase.co'
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTI0MjksImV4cCI6MjA3OTQyODQyOX0.eav7rVxbs4fV6LxJs6y7c4zV9279X0DX0gEJtGPMdo8'

      console.log('[GamesService] 🔍 Tentative de chargement depuis Supabase...')
      
      const response = await fetch(`${SUPABASE_URL}/rest/v1/games?select=*`, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const games = await response.json()
        console.log('[GamesService] ✅ Chargé depuis Supabase:', games.length, 'jeux')
        return games
      } else {
        console.warn('[GamesService] ⚠️ Supabase non accessible')
        return null
      }
    } catch (error) {
      console.warn('[GamesService] ⚠️ Erreur Supabase:', error.message)
      return null
    }
  }

  /**
   * Charger les jeux depuis le fichier local
   */
  async loadFromLocal() {
    try {
      console.log('[GamesService] 📁 Chargement depuis le fichier local...')
      
      const response = await fetch('/processed-games.json')
      if (response.ok) {
        const data = await response.json()
        const games = Array.isArray(data) ? data : (data.games || [])
        console.log('[GamesService] ✅ Chargé depuis le fichier local:', games.length, 'jeux')
        return games
      } else {
        console.warn('[GamesService] ⚠️ Fichier local non trouvé')
        return []
      }
    } catch (error) {
      console.warn('[GamesService] ⚠️ Erreur fichier local:', error.message)
      return []
    }
  }

  /**
   * Enrichir les jeux avec les métadonnées
   */
  async enrichWithMetadata(games) {
    try {
      console.log('[GamesService] 🔧 Enrichissement avec métadonnées...')
      
      // S'assurer que le service de métadonnées est chargé
      await gamesMetadataService.loadMetadata()
      
      return games.map(game => {
        const metadata = gamesMetadataService.getGameMetadata(game.name || game.title)
        return {
          ...game,
          // Ajouter les métadonnées si disponibles
          ...(metadata && {
            genre: metadata.genre || game.genre,
            category: metadata.category || game.category,
            video: metadata.video || game.video,
            screenshots: metadata.screenshots || game.screenshots,
            tags: metadata.tags || game.tags
          })
        }
      })
    } catch (error) {
      console.warn('[GamesService] ⚠️ Erreur enrichissement:', error.message)
      return games
    }
  }

  /**
   * Rechercher des jeux
   */
  async searchGames(query) {
    const games = await this.getAllGames()
    const searchTerm = query.toLowerCase()
    
    return games.filter(game => 
      (game.name || '').toLowerCase().includes(searchTerm) ||
      (game.title || '').toLowerCase().includes(searchTerm) ||
      (game.description || '').toLowerCase().includes(searchTerm) ||
      (game.category || '').toLowerCase().includes(searchTerm) ||
      (game.genre || '').toLowerCase().includes(searchTerm)
    )
  }

  /**
   * Obtenir un jeu par ID
   */
  async getGameById(id) {
    const games = await this.getAllGames()
    return games.find(game => game.id === id)
  }

  /**
   * Obtenir les catégories uniques
   */
  async getCategories() {
    const games = await this.getAllGames()
    const categories = [...new Set(games.map(game => game.category).filter(Boolean))]
    return categories.sort()
  }

  /**
   * Obtenir les genres uniques
   */
  async getGenres() {
    const games = await this.getAllGames()
    const genres = [...new Set(games.map(game => game.genre).filter(Boolean))]
    return genres.sort()
  }

  /**
   * Forcer le rechargement des données
   */
  async refresh() {
    this.games = []
    this.lastUpdated = null
    return await this.getAllGames()
  }
}

// Instance singleton
export const gamesService = new GamesService()
export default gamesService