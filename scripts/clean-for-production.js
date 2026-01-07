/**
 * Script de nettoyage final pour la production
 */

const fs = require('fs')
const path = require('path')

console.log('🧹 Nettoyage final pour la production...')

// Supprimer les logs de développement
const filesToClean = [
  'electron/logs',
  'logs',
  'debug.log',
  'error.log'
]

filesToClean.forEach(file => {
  const filePath = path.join(__dirname, '..', file)
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true })
    console.log('🗑️  Supprimé:', file)
  }
})

console.log('✅ Nettoyage terminé!')
