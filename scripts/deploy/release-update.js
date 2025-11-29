/**
 * Script pour créer une nouvelle version et build du launcher
 * Usage: node scripts/release-update.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'
import { publishToGitHub } from './github-release.js'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function releaseUpdate() {
  try {
    console.log('🚀 Démarrage du processus de release...')
    console.log('')
    
    // 1. Lire la version actuelle
    const packagePath = path.join(__dirname, '..', '..', 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))
    const currentVersion = packageJson.version
    
    console.log(`📦 Version actuelle: ${currentVersion}`)
    console.log('')
    
    // 2. Build du frontend
    console.log('🔨 Étape 1/3: Build du frontend...')
    try {
      await execAsync('npm run build', { cwd: path.join(__dirname, '..', '..') })
      console.log('✅ Build frontend terminé')
    } catch (error) {
      console.error('❌ Erreur lors du build frontend:', error.message)
      throw error
    }
    console.log('')
    
    // 3. Build Electron
    console.log('🔨 Étape 2/4: Build Electron (Windows)...')
    try {
      await execAsync('npm run make:win', { cwd: path.join(__dirname, '..', '..') })
      console.log('✅ Build Electron terminé')
    } catch (error) {
      console.error('❌ Erreur lors du build Electron:', error.message)
      throw error
    }
    console.log('')
    
    // 4. Trouver le fichier .exe généré
    const releaseDir = path.join(__dirname, '..', '..', 'release')
    if (!fs.existsSync(releaseDir)) {
      throw new Error(`Le dossier release/ n'existe pas`)
    }
    
    const allFiles = fs.readdirSync(releaseDir)
    const exeFiles = allFiles.filter(file => 
      file.endsWith('.exe') && 
      !file.includes('blockmap') &&
      (file.includes(currentVersion) || file.includes(`Setup-${currentVersion}`) || file.includes(`-${currentVersion}.exe`))
    )
    
    // Si aucun fichier avec la version exacte, prendre le plus récent .exe
    let exeFile = exeFiles[0]
    if (exeFiles.length === 0) {
      const allExeFiles = allFiles.filter(file => file.endsWith('.exe') && !file.includes('blockmap'))
      if (allExeFiles.length === 0) {
        throw new Error(`Aucun fichier .exe trouvé dans release/`)
      }
      // Prendre le plus récent
      exeFile = allExeFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(releaseDir, a))
        const statB = fs.statSync(path.join(releaseDir, b))
        return statB.mtime - statA.mtime
      })[0]
      console.warn(`⚠️  Aucun fichier .exe trouvé avec la version ${currentVersion}, utilisation du plus récent: ${exeFile}`)
    }
    
    const exePath = path.join(releaseDir, exeFile)
    console.log(`📦 Fichier trouvé: ${exeFile}`)
    console.log('')
    
    // 5. Publication sur GitHub
    console.log('🔨 Étape 3/4: Publication sur GitHub...')
    try {
      await publishToGitHub(currentVersion, exePath)
      console.log('✅ Publication GitHub terminée')
    } catch (error) {
      console.error('❌ Erreur lors de la publication GitHub:', error.message)
      console.warn('⚠️  Le build local est toujours disponible dans release/')
      // Ne pas faire échouer le script si GitHub échoue
    }
    console.log('')
    
    // 6. Résumé
    console.log('✅ Release terminée avec succès!')
    console.log('')
    console.log(`📦 Version: ${currentVersion}`)
    console.log('📁 Fichiers générés dans: release/')
    console.log('')
    console.log('📋 Prochaines étapes:')
    console.log('   1. Tester le fichier .exe dans release/')
    console.log('   2. Vérifier la release sur GitHub')
    console.log('   3. Distribuer la mise à jour aux utilisateurs')
    console.log('')
    
  } catch (error) {
    console.error('❌ Erreur lors de la release:', error.message)
    process.exit(1)
  }
}

releaseUpdate()

