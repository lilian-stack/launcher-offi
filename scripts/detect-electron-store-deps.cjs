/**
 * Script pour détecter automatiquement toutes les dépendances transitives
 * de electron-store et les ajouter à la configuration electron-builder
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🔍 Détection des dépendances de electron-store...\n')

// Fonction récursive pour obtenir toutes les dépendances
function getAllDependencies(moduleName, visited = new Set(), depth = 0) {
  if (visited.has(moduleName) || depth > 10) return []
  visited.add(moduleName)

  const modulePath = path.join(process.cwd(), 'node_modules', moduleName)
  const packageJsonPath = path.join(modulePath, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    return []
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const deps = Object.keys(packageJson.dependencies || {})
    
    let allDeps = [moduleName]
    
    for (const dep of deps) {
      allDeps = allDeps.concat(getAllDependencies(dep, visited, depth + 1))
    }
    
    return [...new Set(allDeps)]
  } catch (error) {
    console.warn(`⚠️  Impossible de lire ${moduleName}: ${error.message}`)
    return [moduleName]
  }
}

// Obtenir toutes les dépendances de electron-store
const allDeps = getAllDependencies('electron-store')
console.log(`✅ ${allDeps.length} dépendances trouvées:\n`)
allDeps.forEach(dep => {
  console.log(`   - ${dep}`)
})

console.log('\n📝 Modules à ajouter dans package.json:\n')
console.log('Dans "build.files":')
allDeps.forEach(dep => {
  console.log(`      "node_modules/${dep}/**/*",`)
})

console.log('\nDans "build.asarUnpack":')
allDeps.forEach(dep => {
  console.log(`      "node_modules/${dep}/**/*",`)
})

