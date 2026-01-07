/**
 * Script pour intégrer le système de mise à jour dans l'application
 */

const fs = require('fs')
const path = require('path')

function integrateUpdateSystem() {
  console.log('🔄 Intégration du système de mise à jour...\n')

  // 1. Modifier App.jsx pour inclure le système de mise à jour
  const appPath = path.join(__dirname, '../src/App.jsx')
  let appContent = fs.readFileSync(appPath, 'utf8')

  // Ajouter les imports nécessaires
  if (!appContent.includes('CommitUpdateModal')) {
    const importLine = "import { CommitUpdateModal } from './components/CommitUpdateModal'"
    const serviceImportLine = "import { commitUpdateService } from './services/commitUpdateService'"
    
    // Trouver la ligne d'import React
    const reactImportMatch = appContent.match(/import.*from 'react'/)
    if (reactImportMatch) {
      const insertIndex = appContent.indexOf(reactImportMatch[0]) + reactImportMatch[0].length
      appContent = appContent.slice(0, insertIndex) + 
                  '\n' + importLine + 
                  '\n' + serviceImportLine + 
                  appContent.slice(insertIndex)
    }
  }

  // Ajouter le state pour le modal de mise à jour
  if (!appContent.includes('showUpdateModal')) {
    const stateMatch = appContent.match(/const \[.*?\] = useState/)
    if (stateMatch) {
      const insertIndex = appContent.indexOf(stateMatch[0]) + stateMatch[0].length
      appContent = appContent.slice(0, insertIndex) + 
                  '\n  const [showUpdateModal, setShowUpdateModal] = useState(false)' +
                  '\n  const [updateInfo, setUpdateInfo] = useState(null)' +
                  appContent.slice(insertIndex)
    }
  }

  // Ajouter l'effet pour vérifier les mises à jour
  if (!appContent.includes('checkForUpdates')) {
    const effectCode = `
  // Vérifier les mises à jour au démarrage
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        console.log('[App] Vérification des mises à jour...')
        const result = await commitUpdateService.checkForUpdates()
        
        if (result.hasUpdate) {
          console.log('[App] Mise à jour disponible!')
          setUpdateInfo(result)
          setShowUpdateModal(true)
        } else {
          console.log('[App] Application à jour')
        }
      } catch (error) {
        console.error('[App] Erreur vérification mises à jour:', error)
      }
    }

    // Vérifier après un délai pour laisser l'app se charger
    setTimeout(checkForUpdates, 3000)
  }, [])`

    // Trouver le dernier useEffect ou l'ajouter après les states
    const lastEffectMatch = appContent.match(/useEffect\([^}]+}\s*,\s*\[[^\]]*\]\s*\)/)
    if (lastEffectMatch) {
      const insertIndex = appContent.indexOf(lastEffectMatch[0]) + lastEffectMatch[0].length
      appContent = appContent.slice(0, insertIndex) + '\n' + effectCode + appContent.slice(insertIndex)
    }
  }

  // Ajouter le modal dans le JSX
  if (!appContent.includes('<CommitUpdateModal')) {
    const modalJSX = `
      {/* Modal de mise à jour */}
      <CommitUpdateModal 
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />`

    // Trouver la fin du JSX principal
    const returnMatch = appContent.match(/return\s*\(/)
    if (returnMatch) {
      // Trouver la fermeture du div principal
      const divCloseMatch = appContent.match(/<\/div>\s*\)\s*$/)
      if (divCloseMatch) {
        const insertIndex = appContent.indexOf(divCloseMatch[0])
        appContent = appContent.slice(0, insertIndex) + modalJSX + '\n    ' + appContent.slice(insertIndex)
      }
    }
  }

  fs.writeFileSync(appPath, appContent)
  console.log('✅ App.jsx mis à jour avec le système de mise à jour')

  // 2. Créer un composant de notification pour les mises à jour
  const notificationComponent = `import { useState, useEffect } from 'react'
import { Motion } from './Motion'
import { FiDownload, FiX } from 'react-icons/fi'

export function UpdateNotification({ updateInfo, onUpdate, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (updateInfo) {
      setIsVisible(true)
    }
  }, [updateInfo])

  if (!updateInfo || !isVisible) return null

  return (
    <Motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm"
    >
      <div className="flex items-start gap-3">
        <FiDownload className="text-xl mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold mb-1">Mise à jour disponible</h4>
          <p className="text-sm opacity-90 mb-3">
            {updateInfo.changedFiles?.length} fichier(s) modifié(s) • {updateInfo.updateSize?.formatted}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onUpdate}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Mettre à jour
            </button>
            <button
              onClick={() => {
                setIsVisible(false)
                onDismiss()
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX />
            </button>
          </div>
        </div>
      </div>
    </Motion.div>
  )
}`

  fs.writeFileSync(path.join(__dirname, '../src/components/UpdateNotification.jsx'), notificationComponent)
  console.log('✅ Composant UpdateNotification créé')

  // 3. Modifier le package.json pour inclure l'injection du commit hash dans le build
  const packagePath = path.join(__dirname, '../package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

  // S'assurer que l'injection du commit hash est dans le script de build
  if (!packageJson.scripts.build.includes('inject-commit-hash')) {
    packageJson.scripts.build = 'node scripts/inject-commit-hash.js && vite build'
    packageJson.scripts['build:production'] = 'node scripts/inject-commit-hash.js && vite build --mode production'
  }

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Scripts de build mis à jour')

  // 4. Créer un script de test pour le système de mise à jour
  const testScript = `/**
 * Script de test du système de mise à jour en production
 */

const { commitUpdateService } = require('../src/services/commitUpdateService.js')

// Simuler l'environnement navigateur
global.window = {
  __COMMIT_HASH__: process.env.CURRENT_COMMIT || 'test-commit',
  localStorage: {
    data: {},
    getItem(key) { return this.data[key] || null },
    setItem(key, value) { this.data[key] = value },
    removeItem(key) { delete this.data[key] }
  },
  dispatchEvent(event) {
    console.log('📡 Event:', event.type, event.detail)
  }
}

global.fetch = require('node-fetch')

async function testUpdateSystem() {
  console.log('🧪 Test du système de mise à jour en production\\n')

  try {
    // Test 1: Vérifier la configuration
    console.log('1️⃣ Vérification de la configuration...')
    const currentCommit = commitUpdateService.getCurrentCommit()
    console.log('   Commit actuel:', currentCommit?.substring(0, 7) || 'Non défini')

    // Test 2: Vérifier la connexion GitHub
    console.log('\\n2️⃣ Test de connexion GitHub...')
    const latestCommit = await commitUpdateService.getLatestCommit()
    console.log('   ✅ Connexion réussie')
    console.log('   Dernier commit:', latestCommit.sha.substring(0, 7))

    // Test 3: Vérifier les mises à jour
    console.log('\\n3️⃣ Vérification des mises à jour...')
    const updateCheck = await commitUpdateService.checkForUpdates()
    
    if (updateCheck.hasUpdate) {
      console.log('   ✅ Mise à jour détectée!')
      console.log('   Fichiers modifiés:', updateCheck.changedFiles?.length)
      console.log('   Taille:', updateCheck.updateSize?.formatted)
    } else {
      console.log('   ✅ Application à jour')
    }

    console.log('\\n🎉 Système de mise à jour fonctionnel!')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  testUpdateSystem()
}

module.exports = { testUpdateSystem }`

  fs.writeFileSync(path.join(__dirname, '../scripts/test-update-production.js'), testScript)
  console.log('✅ Script de test créé')

  console.log('\n🎯 INTÉGRATION TERMINÉE!')
  console.log('\n📋 PROCHAINES ÉTAPES:')
  console.log('   1. npm run build:production')
  console.log('   2. npm run package:production')
  console.log('   3. Installer sur le PC de test')
  console.log('   4. Faire un commit et tester la mise à jour')
  console.log('   5. node scripts/test-update-production.js')
}

// Exécuter si appelé directement
if (require.main === module) {
  integrateUpdateSystem()
}

module.exports = { integrateUpdateSystem }