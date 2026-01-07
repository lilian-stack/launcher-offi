/**
 * Utilitaire pour optimiser les images
 * Convertit les images en formats modernes (WebP/AVIF) et les redimensionne
 */

/**
 * Convertit une URL d'image en format WebP si possible
 * @param {string} url - URL de l'image originale
 * @param {number} width - Largeur souhaitée (optionnel)
 * @param {number} quality - Qualité (0-100, optionnel)
 * @returns {string} URL optimisée
 */
export function optimizeImageUrl(url, width = null, quality = 85) {
  if (!url) return url
  
  // Si c'est déjà une URL Steam, utiliser les paramètres d'optimisation Steam
  if (url.includes('steamcdn-a.akamaihd.net') || url.includes('cdn.akamai.steamstatic.com')) {
    // Steam supporte déjà l'optimisation via les paramètres d'URL
    // Utiliser le CDN optimisé
    if (url.includes('steamcdn-a.akamaihd.net')) {
      url = url.replace('steamcdn-a.akamaihd.net', 'cdn.akamai.steamstatic.com')
    }
    
    // Ajouter des paramètres de taille si nécessaire
    if (width) {
      const urlObj = new URL(url)
      urlObj.searchParams.set('w', width.toString())
      return urlObj.toString()
    }
    return url
  }
  
  // Pour les autres images, retourner l'URL originale
  // (la conversion WebP/AVIF devrait être faite côté serveur)
  return url
}

/**
 * Génère un srcset pour les images responsives
 * @param {string} baseUrl - URL de base de l'image
 * @param {number[]} widths - Largeurs souhaitées
 * @returns {string} Attribut srcset
 */
export function generateSrcSet(baseUrl, widths = [320, 640, 960, 1280, 1920]) {
  return widths
    .map(width => `${optimizeImageUrl(baseUrl, width)} ${width}w`)
    .join(', ')
}

/**
 * Détermine la taille d'image appropriée selon la taille de l'écran
 * @param {number} containerWidth - Largeur du conteneur
 * @returns {number} Largeur d'image optimale
 */
export function getOptimalImageWidth(containerWidth) {
  if (containerWidth <= 320) return 320
  if (containerWidth <= 640) return 640
  if (containerWidth <= 960) return 960
  if (containerWidth <= 1280) return 1280
  return 1920
}

/**
 * Précharge une image pour améliorer le LCP
 * @param {string} url - URL de l'image à précharger
 */
export function preloadLCPImage(url) {
  if (!url || typeof document === 'undefined') return
  
  // Trouver ou créer le lien de preload
  let preloadLink = document.getElementById('lcp-image-preload')
  if (!preloadLink) {
    preloadLink = document.createElement('link')
    preloadLink.id = 'lcp-image-preload'
    preloadLink.rel = 'preload'
    preloadLink.as = 'image'
    document.head.appendChild(preloadLink)
  }
  
  // Mettre à jour l'URL
  preloadLink.href = optimizeImageUrl(url, 1920, 90)
  preloadLink.fetchPriority = 'high'
}







