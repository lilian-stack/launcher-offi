/**
 * Script de build optimisé pour réduire la taille du package Electron
 * Nettoie les fichiers inutiles avant le build
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Fonction helper pour supprimer un dossier récursivement
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
      return true
    } catch (err) {
      return false
    }
  }
  return false
}

console.log('🧹 Nettoyage avant build...\n')

// 1. Supprimer les dossiers de build précédents
const toClean = ['dist', 'out', 'node_modules/.cache']
toClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`   ❌ Suppression de ${dir}...`)
    if (removeDir(dir)) {
      console.log(`   ✅ ${dir} supprimé`)
    } else {
      console.log(`   ⚠️  Erreur lors de la suppression de ${dir}`)
    }
  }
})

// 2. Nettoyer node_modules des fichiers inutiles
console.log('\n🗑️  Nettoyage de node_modules...')
function cleanNodeModules(dir, depth = 0) {
  if (!fs.existsSync(dir)) return 0
  if (depth > 10) return 0 // Limite de profondeur pour éviter les problèmes
  
  let cleaned = 0
  
  try {
    const items = fs.readdirSync(dir)
    
    items.forEach(item => {
      // Ignorer certains dossiers
      if (item.startsWith('.') && item !== '.bin') return
      
      const fullPath = path.join(dir, item)
      
      try {
        const stat = fs.statSync(fullPath)
        
        if (stat.isDirectory()) {
          // Supprimer les dossiers inutiles
          const dirsToRemove = ['test', '__tests__', 'tests', 'examples', 'example', 'docs', 'coverage', '.nyc_output', 'typings', 'types']
          if (dirsToRemove.includes(item)) {
            if (removeDir(fullPath)) {
              cleaned++
            }
          } else if (item !== 'node_modules' && item !== '.bin') {
            // Récursion limitée
            cleaned += cleanNodeModules(fullPath, depth + 1)
          }
        } else {
          // Supprimer les fichiers inutiles
          const fileName = item.toLowerCase()
          if (
            fileName.includes('readme') ||
            fileName.includes('changelog') ||
            fileName.includes('license') ||
            item.endsWith('.d.ts') ||
            item.endsWith('.map') ||
            (item.endsWith('.md') && !item.includes('index'))
          ) {
            fs.removeSync(fullPath)
            cleaned++
          }
        }
      } catch (err) {
        // Ignorer les erreurs de permissions
      }
    })
  } catch (err) {
    // Ignorer les erreurs
  }
  
  return cleaned
}

const cleaned = cleanNodeModules('node_modules')
console.log(`   ✅ ${cleaned} fichiers/dossiers supprimés`)

// 3. Analyser la taille des plus gros modules
console.log('\n📊 Analyse des modules volumineux...')
function getDirectorySize(dir) {
  let size = 0
  if (!fs.existsSync(dir)) return 0
  
  try {
    const items = fs.readdirSync(dir)
    items.forEach(item => {
      try {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)
        if (stat.isFile()) {
          size += stat.size
        } else if (stat.isDirectory() && !item.startsWith('.')) {
          size += getDirectorySize(fullPath)
        }
      } catch (err) {
        // Ignorer les erreurs
      }
    })
  } catch (err) {
    // Ignorer les erreurs
  }
  return size
}

if (fs.existsSync('node_modules')) {
  try {
    const modules = fs.readdirSync('node_modules')
      .filter(m => !m.startsWith('.'))
      .map(m => {
        try {
          return {
            name: m,
            size: getDirectorySize(path.join('node_modules', m))
          }
        } catch (err) {
          return { name: m, size: 0 }
        }
      })
      .sort((a, b) => b.size - a.size)
      .slice(0, 20)
    
    console.log('\n📦 Top 20 modules les plus volumineux:')
    modules.forEach((m, i) => {
      const sizeMB = (m.size / 1024 / 1024).toFixed(2)
      console.log(`   ${(i + 1).toString().padStart(2)}. ${m.name.padEnd(40)} ${sizeMB.padStart(8)} MB`)
    })
  } catch (err) {
    console.log('   ⚠️  Erreur lors de l\'analyse:', err.message)
  }
}

// 4. Build du frontend (si nécessaire)
if (!fs.existsSync('dist')) {
  console.log('\n🎨 Build du frontend React...')
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
    console.log('   ✅ Frontend buildé avec succès')
  } catch (err) {
    console.error('   ❌ Erreur lors du build du frontend:', err.message)
    process.exit(1)
  }
}

// 5. Build final avec electron-builder
console.log('\n🚀 Build final avec electron-builder...')
console.log('   (Utilisez: npm run build:setup)\n')
