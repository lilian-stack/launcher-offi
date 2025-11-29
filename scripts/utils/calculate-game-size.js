/**
 * Script pour calculer la taille d'un jeu dans Supabase
 * Usage: node scripts/calculate-game-size.js
 */

const game = {
  "id": "2651280",
  "name": "Marvel's Spider-Man 2",
  "short_description": "Dépassez vos limites. Ensemble. L'incroyable puissance du symbiote force Peter Parker et Miles Morales à se dépasser et à trouver le bon équilibre entre leurs vies, leurs amitiés et leurs responsabili...",
  "header_image": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2651280/header.jpg?t=1763569811",
  "movies": "https://video.akamai.steamstatic.com/store_trailers/257093509/movie_max.mp4?t=1738262051",
  "pc_requirements": {
    "minimum": "<strong>Minimale :</strong><br><ul class=\"bb_ul\"><li>Système d'exploitation et processeur 64 bits nécessaires<br></li><li><strong>Système d'exploitation :</strong> Windows 10/11 (version 1909 or higher)<br></li><li><strong>Processeur :</strong> Intel Core i3-8100 or AMD Ryzen 3 3100<br></li><li><strong>Mémoire vive :</strong> 16 GB de mémoire<br></li><li><strong>Graphiques :</strong> NVIDIA GeForce GTX 1650 or AMD Radeon RX 5500 XT<br></li><li><strong>Espace disque :</strong> 140 GB d'espace disque disponible<br></li><li><strong>Notes supplémentaires :</strong> SSD Required</li></ul>",
    "recommended": "<strong>Recommandée :</strong><br><ul class=\"bb_ul\"><li>Système d'exploitation et processeur 64 bits nécessaires<br></li><li><strong>Système d'exploitation :</strong> Windows 10/11 (version 1909 or higher)<br></li><li><strong>Processeur :</strong> Intel Core i5-8400 or AMD Ryzen 5 3600<br></li><li><strong>Mémoire vive :</strong> 16 GB de mémoire<br></li><li><strong>Graphiques :</strong> NVIDIA GeForce RTX 3060 or AMD Radeon RX 5700<br></li><li><strong>Espace disque :</strong> 140 GB d'espace disque disponible<br></li><li><strong>Notes supplémentaires :</strong> SSD Required</li></ul>"
  },
  "addedAt": "2025-11-23T00:25:53.753Z",
  "updatedAt": "2025-11-23T00:25:53.753Z"
}

// Convertir en JSON
const gameJson = JSON.stringify(game)
const sizeBytes = Buffer.byteLength(gameJson, 'utf8')

// Conversions
const sizeKB = sizeBytes / 1024
const sizeMB = sizeBytes / (1024 * 1024)

console.log('📊 Calcul de la taille du jeu "Marvel\'s Spider-Man 2"')
console.log('')
console.log('💾 Taille en base de données:')
console.log(`   - ${sizeBytes.toLocaleString()} octets`)
console.log(`   - ${sizeKB.toFixed(2)} KB`)
console.log(`   - ${sizeMB.toFixed(4)} MB`)
console.log('')

// Calculer combien de jeux similaires peuvent tenir dans 500 MB
const freeLimitMB = 500
const maxGames = Math.floor(freeLimitMB / sizeMB)

console.log('📈 Estimation avec ce type de jeu:')
console.log(`   - ~${maxGames.toLocaleString()} jeux similaires peuvent tenir dans 500 MB`)
console.log('')

// Détail par champ
console.log('📋 Détail par champ:')
const fields = {
  'id': game.id,
  'name': game.name,
  'short_description': game.short_description,
  'header_image': game.header_image,
  'movies': game.movies,
  'pc_requirements': game.pc_requirements,
  'addedAt': game.addedAt,
  'updatedAt': game.updatedAt
}

Object.entries(fields).forEach(([key, value]) => {
  const fieldSize = Buffer.byteLength(JSON.stringify(value), 'utf8')
  const fieldSizeKB = fieldSize / 1024
  console.log(`   - ${key}: ${fieldSize.toLocaleString()} octets (${fieldSizeKB.toFixed(2)} KB)`)
})

console.log('')
console.log('💡 Note: La taille réelle en base peut être légèrement différente')
console.log('   à cause de l\'indexation et du format de stockage PostgreSQL.')

