/**
 * Service de gestion des métadonnées des jeux
 */

class GamesMetadataService {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initialise le service
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Charger les métadonnées depuis le cache local si disponible
      const cached = localStorage.getItem('games_metadata_cache');
      if (cached) {
        const data = JSON.parse(cached);
        this.cache = new Map(data);
      }
      
      this.initialized = true;
      console.log('[GamesMetadata] Service initialisé');
    } catch (error) {
      console.error('[GamesMetadata] Erreur lors de l\'initialisation:', error);
    }
  }

  /**
   * Récupère les métadonnées d'un jeu
   */
  getGameMetadata(gameId) {
    if (!gameId) return null;
    return this.cache.get(gameId) || null;
  }

  /**
   * Met à jour les métadonnées d'un jeu
   */
  setGameMetadata(gameId, metadata) {
    if (!gameId || !metadata) return;
    
    this.cache.set(gameId, {
      ...metadata,
      updatedAt: new Date().toISOString()
    });
    
    this.saveToCache();
  }

  /**
   * Récupère les métadonnées de plusieurs jeux
   */
  getMultipleGamesMetadata(gameIds) {
    if (!Array.isArray(gameIds)) return {};
    
    const result = {};
    gameIds.forEach(id => {
      const metadata = this.getGameMetadata(id);
      if (metadata) {
        result[id] = metadata;
      }
    });
    
    return result;
  }

  /**
   * Enrichit un jeu avec ses métadonnées
   */
  enrichGame(game) {
    if (!game || !game.id) return game;
    
    const metadata = this.getGameMetadata(game.id);
    if (!metadata) return game;
    
    return {
      ...game,
      ...metadata,
      // Préserver les données originales importantes
      id: game.id,
      name: game.name || metadata.name,
      image: game.image || metadata.image
    };
  }

  /**
   * Enrichit une liste de jeux avec leurs métadonnées
   */
  enrichGames(games) {
    if (!Array.isArray(games)) return games;
    
    return games.map(game => this.enrichGame(game));
  }

  /**
   * Sauvegarde le cache en localStorage
   */
  saveToCache() {
    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem('games_metadata_cache', JSON.stringify(data));
    } catch (error) {
      console.error('[GamesMetadata] Erreur lors de la sauvegarde du cache:', error);
    }
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    localStorage.removeItem('games_metadata_cache');
    console.log('[GamesMetadata] Cache vidé');
  }

  /**
   * Récupère les statistiques du cache
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      initialized: this.initialized,
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length
    };
  }

  /**
   * Met à jour les métadonnées depuis une source externe
   */
  async updateFromSource(source) {
    try {
      if (typeof source === 'function') {
        const data = await source();
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.id) {
              this.setGameMetadata(item.id, item);
            }
          });
        }
      }
    } catch (error) {
      console.error('[GamesMetadata] Erreur lors de la mise à jour depuis la source:', error);
    }
  }
}

// Instance singleton
export const gamesMetadataService = new GamesMetadataService();

// Export pour les tests
export { GamesMetadataService };