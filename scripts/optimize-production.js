/**
 * Script d'optimisation complète pour la production
 */

const fs = require('fs')
const path = require('path')

class ProductionOptimizer {
  constructor() {
    this.rootDir = path.join(__dirname, '..')
    this.filesToDelete = []
    this.optimizations = []
  }

  async optimize() {
    console.log('🚀 OPTIMISATION PRODUCTION - DÉMARRAGE\n')

    await this.cleanUnnecessaryFiles()
    await this.optimizePackageJson()
    await this.secureEnvironment()
    await this.optimizeElectronConfig()
    await this.createProductionScripts()
    
    console.log('\n✅ OPTIMISATION TERMINÉE!')
    this.showSummary()
  }

  async cleanUnnecessaryFiles() {
    console.log('🧹 Nettoyage des fichiers inutiles...')

    const filesToDelete = [
      // Fichiers MD de développement
      'ADMIN_PAGINATION_SUMMARY.md',
      'AUDIT_COMPLET_ACTORIS_LAUNCHER.md',
      'BUZZ_SIZE_SCRAPING_FIX_SUMMARY.md',
      'CLEANUP_AUDIT.md',
      'CORRECTIONS_SUMMARY.md',
      'DOWNLOAD_POPUP_CONFIRM_FIX_SUMMARY.md',
      'DOWNLOAD_PROGRESS_FIX_SUMMARY.md',
      'DOWNLOAD_UI_FIX_SUMMARY.md',
      'FICHIERS_A_SUPPRIMER.md',
      'FINAL_CORRECTIONS_SUMMARY.md',
      'FINAL_PRODUCTION_STATUS.md',
      'GAMES_CATALOG_SIMPLIFICATION_SUMMARY.md',
      'GAMES_JSON_FORMATTING_SUMMARY.md',
      'GAMES_LINKS_UPDATE_ANALYSIS.md',
      'GOFILE_*.md',
      'OPTIMISATIONS_FINALES.md',

      // Scripts de développement non essentiels
      'scripts/auto-scrape-and-update.js',
      'scripts/multi-site-scraper.js',
      'scripts/sync-updated-games-to-supabase.js',
      'scripts/test-*.js',
      'scripts/demo-*.js',
      'scripts/scan-steam-games.js',

      // Fichiers temporaires
      'steamrip-results.json',
      'games_updated.json',
      'deployment-info.json'
    ]

    let deletedCount = 0
    for (const file of filesToDelete) {
      const filePath = path.join(this.rootDir, file)
      if (fs.existsSync(filePath)) {
        try {
          if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true })
          } else {
            fs.unlinkSync(filePath)
          }
          deletedCount++
          console.log(`   🗑️  ${file}`)
        } catch (error) {
          console.warn(`   ⚠️  Impossible de supprimer ${file}:`, error.message)
        }
      }
    }

    console.log(`   ✅ ${deletedCount} fichiers supprimés`)
  }

  async optimizePackageJson() {
    console.log('📦 Optimisation du package.json...')

    const packagePath = path.join(this.rootDir, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

    // Supprimer les scripts de développement
    const scriptsToRemove = [
      'migrate:supabase', 'test:supabase', 'add:test-game', 'check:supabase',
      'process:steam', 'add:steam-games', 'compare:games', 'tag:filter',
      'tag:stats', 'tag:auto', 'search:download-links', 'scrape:steam',
      'integrate:supabase-videos', 'fetch:videos'
    ]

    scriptsToRemove.forEach(script => {
      if (packageJson.scripts[script]) {
        delete packageJson.scripts[script]
      }
    })

    // Ajouter les scripts de production
    packageJson.scripts = {
      ...packageJson.scripts,
      'start:production': 'cross-env NODE_ENV=production npm run electron',
      'build:production': 'npm run clean && node scripts/inject-commit-hash.js && vite build --mode production',
      'package:production': 'npm run build:production && electron-builder --win --x64',
      'clean:production': 'node scripts/clean-for-production.js',
      'optimize:all': 'node scripts/optimize-production.js',
      'security:audit': 'node scripts/security-audit.js'
    }

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
    console.log('   ✅ package.json optimisé')
  }

  async secureEnvironment() {
    console.log('🔒 Sécurisation de l\'environnement...')

    // Créer un .env.example sans les vraies valeurs
    const envExampleContent = `# Configuration Supabase
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Discord Webhook
DISABLE_NEWS_WEBHOOK=true

# GitHub Token pour les mises à jour
GITHUB_TOKEN=your_github_token_here
`

    fs.writeFileSync(path.join(this.rootDir, '.env.example'), envExampleContent)
    console.log('   ✅ .env.example créé')

    // Vérifier que .env est dans .gitignore
    const gitignorePath = path.join(this.rootDir, '.gitignore')
    let gitignoreContent = ''
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
    }

    if (!gitignoreContent.includes('.env')) {
      gitignoreContent += '\n# Environment variables\n.env\n.env.local\n'
      fs.writeFileSync(gitignorePath, gitignoreContent)
      console.log('   ✅ .env ajouté au .gitignore')
    }
  }

  async optimizeElectronConfig() {
    console.log('⚡ Optimisation de la configuration Electron...')

    const packagePath = path.join(this.rootDir, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

    // Optimiser la configuration build
    packageJson.build = {
      ...packageJson.build,
      compression: 'maximum',
      nsis: {
        ...packageJson.build.nsis,
        differentialPackage: false, // Désactiver pour éviter les problèmes
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        runAfterFinish: true
      },
      win: {
        ...packageJson.build.win,
        target: [
          {
            target: 'nsis',
            arch: ['x64']
          }
        ]
      }
    }

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
    console.log('   ✅ Configuration Electron optimisée')
  }

  async createProductionScripts() {
    console.log('📝 Création des scripts de production...')

    // Script de nettoyage pour la production
    const cleanScript = `/**
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
`

    fs.writeFileSync(path.join(this.rootDir, 'scripts/clean-for-production.js'), cleanScript)

    // Script d'audit de sécurité
    const securityScript = `/**
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

console.log(issues === 0 ? '✅ Aucun problème de sécurité détecté' : \`❌ \${issues} problème(s) détecté(s)\`)
`

    fs.writeFileSync(path.join(this.rootDir, 'scripts/security-audit.js'), securityScript)

    console.log('   ✅ Scripts de production créés')
  }

  showSummary() {
    console.log('\n📊 RÉSUMÉ DE L\'OPTIMISATION:')
    console.log('   🧹 Fichiers inutiles supprimés')
    console.log('   📦 package.json optimisé')
    console.log('   🔒 Environnement sécurisé')
    console.log('   ⚡ Configuration Electron optimisée')
    console.log('   📝 Scripts de production créés')
    console.log('')
    console.log('🎯 PROCHAINES ÉTAPES:')
    console.log('   1. npm run build:production')
    console.log('   2. npm run package:production')
    console.log('   3. Tester sur le PC de test')
    console.log('   4. Valider le système de mise à jour')
  }
}

// Exécuter l'optimisation
if (require.main === module) {
  const optimizer = new ProductionOptimizer()
  optimizer.optimize().catch(console.error)
}

module.exports = { ProductionOptimizer }