/**
 * Hook afterPack pour electron-builder
 * Copie les node_modules dans le package après le packaging
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

// Fonction pour calculer la taille d'un dossier
function getDirectorySize(dir) {
  let size = 0
  try {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        size += getDirectorySize(filePath)
      } else {
        size += stats.size
      }
    }
  } catch (err) {
    // Ignorer les erreurs
  }
  return size
}

// Fonction pour copier récursivement (compatible avec toutes les versions de Node.js)
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src)
  const stats = exists && fs.statSync(src)
  const isDirectory = exists && stats.isDirectory()
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      )
    })
  } else {
    if (!fs.existsSync(path.dirname(dest))) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
    }
    fs.copyFileSync(src, dest)
  }
}

exports.default = async function(context) {
  const { appOutDir } = context
  
  console.log('📦 [afterPack] Installation des dépendances du serveur...')
  console.log('📁 [afterPack] Dossier de sortie:', appOutDir)
  
  // Nettoyer les doublons Electron si présents
  const duplicateElectronPath = path.join(appOutDir, 'resources', 'app', 'dist', 'win-unpacked')
  if (fs.existsSync(duplicateElectronPath)) {
    console.log('🧹 [afterPack] Suppression des doublons Electron...')
    try {
      fs.rmSync(duplicateElectronPath, { recursive: true, force: true })
      console.log('✅ [afterPack] Doublons Electron supprimés (~168 MB économisés)')
    } catch (err) {
      console.warn('⚠️  [afterPack] Impossible de supprimer les doublons:', err.message)
    }
  }
  
  // Nettoyer les binaires 7zip inutiles (garder seulement Windows x64)
  const sevenZipBase = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '7zip-bin')
  if (fs.existsSync(sevenZipBase)) {
    console.log('🧹 [afterPack] Nettoyage des binaires 7zip inutiles...')
    const platformsToRemove = ['linux', 'mac', 'arm', 'arm64', 'ia32']
    let cleanedSize = 0
    for (const platform of platformsToRemove) {
      const platformPath = path.join(sevenZipBase, platform)
      if (fs.existsSync(platformPath)) {
        try {
          const size = getDirectorySize(platformPath)
          fs.rmSync(platformPath, { recursive: true, force: true })
          cleanedSize += size
          console.log(`   ✅ ${platform} supprimé`)
        } catch (err) {
          console.warn(`   ⚠️  Impossible de supprimer ${platform}:`, err.message)
        }
      }
    }
    if (cleanedSize > 0) {
      console.log(`✅ [afterPack] ${(cleanedSize / 1024 / 1024).toFixed(2)} MB économisés (7zip-bin)`)
    }
  }
  
  // Obtenir le chemin du projet source (parent du dossier scripts)
  const projectRoot = path.resolve(__dirname, '..')
  const sourceNodeModules = path.join(projectRoot, 'node_modules')
  
  console.log('📁 [afterPack] Chemin projet source:', projectRoot)
  console.log('📁 [afterPack] Chemin node_modules source:', sourceNodeModules)
  
  // Modules nécessaires pour le serveur backend
  const serverDependencies = [
    'express',
    'ws',
    'cors',
    'dotenv',
    'axios',
    'discord.js',
    'body-parser',
    'node-fetch',
    'depd',
    'whatwg-url',
    'compression',
    '@supabase/supabase-js', // Pour charger les secrets depuis Supabase
  ]
  
  // 🔧 Dépendances critiques qui DOIVENT être dans app.asar.unpacked
  const criticalDeps = [
    'electron-store',
    'conf',
    'env-paths',
    'dot-prop',
    'atomically', // Dépendance de conf
    'node-7z',
    '7zip-bin',
    'debug',
    'ms',
    'finalhandler',
    'merge-descriptors',
    'lodash.defaultto',
    'lodash.flattendeep',
    'lodash.defaultsdeep', // Dépendance de node-7z
    'lodash.isempty', // Dépendance de node-7z
    'lodash.negate', // Dépendance de node-7z
    'lodash.isplainobject',
    'lodash.isstring',
    'lodash',
    'normalize-path', // Dépendance de node-7z
    'keytar'
  ]
  
  // Copier les dépendances critiques dans app.asar.unpacked/node_modules
  console.log('📦 [afterPack] Copie des dépendances critiques dans app.asar.unpacked...')
  const unpackedDir = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules')
  
  // Vérifier que le dossier source existe
  if (!fs.existsSync(sourceNodeModules)) {
    console.error(`❌ [afterPack] node_modules source non trouvé: ${sourceNodeModules}`)
    throw new Error(`node_modules source non trouvé: ${sourceNodeModules}`)
  }
  
  // Créer le dossier si nécessaire
  if (!fs.existsSync(unpackedDir)) {
    fs.mkdirSync(unpackedDir, { recursive: true })
  }
  
  for (const dep of criticalDeps) {
    const source = path.join(sourceNodeModules, dep)
    const dest = path.join(unpackedDir, dep)
    
    if (fs.existsSync(source)) {
      try {
        // Supprimer la destination si elle existe
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true })
        }
        // Copier récursivement (utiliser une fonction compatible)
        copyRecursiveSync(source, dest)
        console.log(`✅ [afterPack] ${dep} copié dans app.asar.unpacked`)
      } catch (err) {
        console.error(`❌ [afterPack] Erreur lors de la copie de ${dep}:`, err.message)
      }
    } else {
      console.warn(`⚠️  [afterPack] ${dep} non trouvé dans node_modules`)
    }
  }
  
  try {
    // Installer seulement les dépendances de production nécessaires
    // Utiliser --prefer-offline pour accélérer si les packages sont déjà en cache
    // Utiliser --no-audit et --no-fund pour éviter les vérifications inutiles
    const installCommand = `npm install --production --no-save --prefer-offline --no-audit --no-fund --prefix "${appOutDir}" ${serverDependencies.join(' ')}`
    console.log('🔧 [afterPack] Commande:', installCommand)
    
    execSync(installCommand, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_prefix: appOutDir,
        npm_config_progress: 'false', // Désactiver la barre de progression pour accélérer
        npm_config_loglevel: 'error', // Seulement les erreurs
      }
    })
    
    console.log('✅ [afterPack] Dépendances installées avec succès!')
    
    // Créer un package.json avec "type": "module" dans le dossier d'installation
    const packageJsonPath = path.join(appOutDir, 'package.json')
    console.log('📄 [afterPack] Création de package.json avec type: module...')
    console.log('📁 [afterPack] Chemin:', packageJsonPath)
    
    try {
      let existingPackageJson = {}
      if (fs.existsSync(packageJsonPath)) {
        try {
          existingPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
          console.log('📄 [afterPack] package.json existant trouvé, fusion avec la config...')
        } catch (error) {
          console.log('⚠️ [afterPack] Erreur lecture package.json existant:', error.message)
        }
      }
      
      const packageJson = {
        ...existingPackageJson,
        "type": "module",
        "name": existingPackageJson.name || "actoris-launcher",
        "version": existingPackageJson.version || "1.0.0",
        "description": existingPackageJson.description || "Actoris Launcher"
      }
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8')
      console.log('✅ [afterPack] package.json créé/mis à jour avec type: module')
      
      // Vérifier que le fichier existe bien
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf-8')
        console.log('✅ [afterPack] package.json contenu:', content.substring(0, 200) + '...')
      } else {
        console.error('❌ [afterPack] package.json N\'EXISTE PAS après création!')
        throw new Error('package.json non créé')
      }
    } catch (error) {
      console.error('❌ [afterPack] Erreur lors de la création de package.json:', error.message)
      throw error
    }
    
    // Créer aussi un package.json dans le dossier server/ si il existe
    const serverDir = path.join(appOutDir, 'server')
    if (fs.existsSync(serverDir)) {
      const serverPackageJsonPath = path.join(serverDir, 'package.json')
      console.log('📄 [afterPack] Création de package.json dans server/...')
      try {
        const serverPackageJson = {
          "type": "module",
          "name": "actoris-launcher-server",
          "version": "1.0.0"
        }
        fs.writeFileSync(serverPackageJsonPath, JSON.stringify(serverPackageJson, null, 2), 'utf-8')
        console.log('✅ [afterPack] package.json créé dans server/')
      } catch (error) {
        console.error('⚠️ [afterPack] Erreur lors de la création de package.json dans server/:', error.message)
        // Ne pas faire échouer le build si ça échoue
      }
    }
    
    // Vérifier que les node_modules ont bien été installés
    const nodeModulesPath = path.join(appOutDir, 'node_modules')
    if (fs.existsSync(nodeModulesPath)) {
      console.log('✅ [afterPack] node_modules trouvé dans:', nodeModulesPath)
      
      // Vérifier que les modules critiques du serveur existent
      // Note: electron-store, conf, dot-prop sont inclus dans le build principal via build.files
      // et n'ont pas besoin d'être installés ici (ce sont des dépendances Electron, pas du serveur)
      const requiredModules = ['express', 'ws', 'cors', 'dotenv', 'axios', 'discord.js', 'body-parser', 'node-fetch', 'depd', 'whatwg-url', 'compression']
      let allModulesFound = true
      requiredModules.forEach(module => {
        const modulePath = path.join(nodeModulesPath, module)
        if (fs.existsSync(modulePath)) {
          console.log(`  ✅ [afterPack] ${module} trouvé`)
        } else {
          console.log(`  ❌ [afterPack] ${module} NON trouvé`)
          allModulesFound = false
        }
      })
      
      if (!allModulesFound) {
        console.error('❌ [afterPack] Certains modules critiques sont manquants!')
        throw new Error('Modules critiques manquants')
      }
    } else {
      console.error('❌ [afterPack] node_modules non trouvé après installation!')
      throw new Error('node_modules non trouvé')
    }
  } catch (error) {
    console.error('❌ [afterPack] Erreur lors de l\'installation des dépendances:', error.message)
    throw error
  }
}

