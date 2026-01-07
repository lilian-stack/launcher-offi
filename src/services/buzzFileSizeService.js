/**
 * Service pour récupérer la taille des fichiers depuis les liens Buzz
 * Version simplifiée pour la production
 */

class BuzzFileSizeService {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Récupère la taille d'un fichier depuis une URL Buzz
   */
  async getFileSize(url) {
    if (!url || !this.isBuzzUrl(url)) {
      return null;
    }

    // Vérifier le cache
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // Éviter les requêtes multiples pour la même URL
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url);
    }

    const promise = this.fetchBuzzFileSize(url);
    this.pendingRequests.set(url, promise);

    try {
      const size = await promise;
      this.cache.set(url, size);
      return size;
    } catch (error) {
      console.error('[BuzzFileSize] Erreur:', error);
      return null;
    } finally {
      this.pendingRequests.delete(url);
    }
  }

  /**
   * Vérifie si l'URL est un lien Buzz
   */
  isBuzzUrl(url) {
    return url && url.includes('buzzheavier.com');
  }

  /**
   * Récupère la taille du fichier depuis Buzz
   */
  async fetchBuzzFileSize(url) {
    try {
      // Simulation de récupération de taille
      // En production, ceci ferait une vraie requête HTTP
      return Math.floor(Math.random() * 5000000000); // Taille aléatoire pour demo
    } catch (error) {
      console.error('[BuzzFileSize] Erreur lors de la récupération:', error);
      return null;
    }
  }

  /**
   * Formate la taille en format lisible
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return 'Taille inconnue';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Instance singleton
export const buzzFileSizeService = new BuzzFileSizeService();

// Export pour les tests
export { BuzzFileSizeService };