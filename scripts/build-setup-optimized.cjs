/**
 * Script optimisé pour créer le setup .exe
 * Nettoie, build et crée l'installateur Windows
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 Build optimisé pour setup .exe\n')
console.log('='.repeat(60))

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function exec(command, options = {}) {
  try {
    execSync(command, {
      stdio: 'inherit',
      shell: true,
      ...options
    })
    return true
  } catch (error) {
    log(`❌ Erreur: ${error.message}`, 'red')
    return false
  }
}

// Fonction pour fermer les processus Electron
function killElectronProcesses() {
  try {
    log('   🔍 Vérification des processus Electron...', 'yellow')
    if (process.platform === 'win32') {
      // Sur Windows, tuer les processus electron
      execSync('taskkill /F /IM electron.exe /T 2>nul', { stdio: 'ignore' })
      execSync('taskkill /F /IM "Actoris.exe" /T 2>nul', { stdio: 'ignore' })
    } else {
      // Sur Linux/Mac
      execSync('pkill -f electron 2>/dev/null', { stdio: 'ignore' })
    }
    log('   ✅ Processus Electron fermés', 'green')
  } catch (error) {
    // Ignorer les erreurs si aucun processus n'est trouvé
  }
}

// Fonction pour supprimer un dossier avec retry
function removeDirWithRetry(dir, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
        return true
      }
      return true // Le dossier n'existe pas, c'est bon
    } catch (error) {
      if (i < maxRetries - 1) {
        log(`   ⚠️  Tentative ${i + 1}/${maxRetries} échouée, attente de 1 seconde...`, 'yellow')
        // Attendre 1 seconde avant de réessayer
        try {
          execSync('timeout /t 1 /nobreak >nul 2>&1', { shell: true })
        } catch (e) {
          // Fallback si timeout n'existe pas
          const start = Date.now()
          while (Date.now() - start < 1000) {}
        }
      } else {
        throw error
      }
    }
  }
  return false
}

// Étape 1: Nettoyage
log('\n📦 Étape 1/4: Nettoyage des fichiers précédents...', 'cyan')
killElectronProcesses()

// Attendre un peu pour que les processus se ferment
log('   ⏳ Attente de 2 secondes pour la fermeture des processus...', 'yellow')
try {
  execSync('timeout /t 2 /nobreak >nul 2>&1', { shell: true })
} catch (e) {
  const start = Date.now()
  while (Date.now() - start < 2000) {}
}

const toClean = ['dist', 'release', 'out']
toClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    log(`   🗑️  Suppression de ${dir}...`, 'yellow')
    try {
      if (removeDirWithRetry(dir)) {
        log(`   ✅ ${dir} supprimé`, 'green')
      } else {
        log(`   ⚠️  Impossible de supprimer ${dir}, mais on continue...`, 'yellow')
      }
    } catch (error) {
      log(`   ⚠️  Erreur lors de la suppression de ${dir}: ${error.message}`, 'yellow')
      log(`   💡 Astuce: Fermez l'application Actoris si elle est ouverte et réessayez`, 'yellow')
    }
  }
})

// Étape 2: Build Vite
log('\n⚙️  Étape 2/4: Build du frontend avec Vite...', 'cyan')
if (!exec('npm run build')) {
  log('❌ Échec du build Vite', 'red')
  process.exit(1)
}
log('✅ Build Vite terminé', 'green')

// Vérifier que dist existe
if (!fs.existsSync('dist')) {
  log('❌ Le dossier dist n\'existe pas après le build!', 'red')
  process.exit(1)
}

// Étape 3: Vérification des fichiers nécessaires
log('\n🔍 Étape 3/4: Vérification des fichiers nécessaires...', 'cyan')
const requiredFiles = [
  'dist/index.html',
  'electron/main.js',
  'build/icon.ico'
]

let allFilesExist = true
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    log(`   ✅ ${file}`, 'green')
  } else {
    log(`   ❌ ${file} manquant!`, 'red')
    allFilesExist = false
  }
})

if (!allFilesExist) {
  log('❌ Certains fichiers nécessaires sont manquants!', 'red')
  process.exit(1)
}

// Étape 4: Création du setup .exe avec electron-builder
log('\n📦 Étape 4/4: Création du setup .exe avec electron-builder...', 'cyan')
log('   ⏳ Cela peut prendre plusieurs minutes...\n', 'yellow')

if (!exec('npx electron-builder --win --x64')) {
  log('❌ Échec de la création du setup', 'red')
  process.exit(1)
}

// Vérifier que le fichier .exe a été créé
log('\n🔍 Vérification du fichier créé...', 'cyan')
const possibleDirs = ['dist', 'release', 'out']
let exeFile = null
let exePath = null

for (const dir of possibleDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir)
    const found = files.find(f => f.endsWith('.exe') && (f.includes('Setup') || f.includes('setup')))
    if (found) {
      exeFile = found
      exePath = path.join(dir, found)
      break
    }
  }
}

if (exeFile && exePath && fs.existsSync(exePath)) {
  const stats = fs.statSync(exePath)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  
  log('', 'reset')
  log('='.repeat(60), 'cyan')
  log('✅ BUILD RÉUSSI! 🎉', 'green')
  log('='.repeat(60), 'cyan')
  log(`\n📦 Fichier créé: ${exeFile}`, 'green')
  log(`📁 Emplacement: ${path.resolve(exePath)}`, 'blue')
  log(`💾 Taille: ${sizeMB} MB`, 'blue')
  log('\n🚀 Vous pouvez maintenant distribuer ce fichier!', 'cyan')
  log('', 'reset')
} else {
  log('⚠️  Aucun fichier .exe trouvé dans dist, release ou out', 'yellow')
  log('   Vérifiez les logs ci-dessus pour plus d\'informations', 'yellow')
}

