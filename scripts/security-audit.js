/**
 * Script d'audit de sécurité
 */

const fs = require('fs')
const path = require('path')

console.log('🔒 Audit de sécurité...')

let issues = 0

// Vérifier les fichiers sensibles
const sensitiveFiles = ['.env', 'secrets.json', 'private.key']
sensitiveFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, '..', file))) {
    console.log('⚠️  Fichier sensible détecté:', file)
    issues++
  }
})

// Vérifier les tokens hardcodés
const jsFiles = ['src/**/*.js', 'src/**/*.jsx', 'electron/**/*.js']
// TODO: Implémenter la vérification des tokens hardcodés

console.log(issues === 0 ? '✅ Aucun problème de sécurité détecté' : `❌ ${issues} problème(s) détecté(s)`)
