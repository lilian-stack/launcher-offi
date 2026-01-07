/**
 * Script pour mettre à jour le casier Lockr unique avec l'URL de redirection Netlify
 * Usage: node scripts/utils/update-unique-lockr-redirect.js
 */

import { updateLocker, extractLockerId } from '../../electron/lockr-service.js'

// Configuration
const UNIQUE_LOCKR_URL = 'https://lockr.net/7dhjn5m8'
const NETLIFY_REDIRECT_URL = 'https://inquisitive-peony-762c3b.netlify.app/redirect'
const LOCKER_TITLE = 'Game Launcher Premium'

async function updateUniqueLockrRedirect() {
  try {
    console.log('═══════════════════════════════════════════════════════')
    console.log('🔄 MISE À JOUR DU CASIER LOCKR UNIQUE')
    console.log('═══════════════════════════════════════════════════════')
    console.log('')
    console.log(`🔗 URL du casier: ${UNIQUE_LOCKR_URL}`)
    console.log(`🎯 URL de redirection: ${NETLIFY_REDIRECT_URL}`)
    console.log(`📋 Titre: ${LOCKER_TITLE}`)
    console.log('')
    
    // Extraire l'ID du casier depuis l'URL
    const lockerId = extractLockerId(UNIQUE_LOCKR_URL)
    
    if (!lockerId) {
      console.error('❌ Impossible d\'extraire l\'ID du casier depuis l\'URL')
      console.error(`   URL fournie: ${UNIQUE_LOCKR_URL}`)
      console.error('')
      console.error('💡 Vérifiez que l\'URL est correcte')
      process.exit(1)
    }
    
    console.log(`✅ ID du casier extrait: ${lockerId}`)
    console.log('')
    console.log('📤 Mise à jour du casier Lockr...')
    console.log('')
    
    // Mettre à jour le casier avec l'URL Netlify
    const result = await updateLocker(lockerId, NETLIFY_REDIRECT_URL, LOCKER_TITLE)
    
    if (result.success) {
      console.log('═══════════════════════════════════════════════════════')
      console.log('✅ CASIER LOCKR MIS À JOUR AVEC SUCCÈS!')
      console.log('═══════════════════════════════════════════════════════')
      console.log('')
      console.log(`🔗 URL du casier: ${result.lockerUrl || UNIQUE_LOCKR_URL}`)
      console.log(`🎯 Redirection vers: ${NETLIFY_REDIRECT_URL}`)
      console.log('')
      console.log('💡 Le casier redirigera maintenant directement vers Netlify')
      console.log('   après validation, sans afficher les anciennes offres.')
      console.log('')
    } else {
      console.error('═══════════════════════════════════════════════════════')
      console.error('❌ ÉCHEC DE LA MISE À JOUR')
      console.error('═══════════════════════════════════════════════════════')
      console.error('')
      console.error(`❌ Erreur: ${result.error}`)
      console.error('')
      console.error('💡 Vérifiez:')
      console.error('   1. Que la clé API Lockr est correcte dans lockr-service.js')
      console.error('   2. Que vous avez les permissions pour modifier ce casier')
      console.error('   3. Que l\'URL du casier est correcte')
      console.error('')
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Erreur critique:', error)
    console.error('')
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Exécuter le script
updateUniqueLockrRedirect()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
