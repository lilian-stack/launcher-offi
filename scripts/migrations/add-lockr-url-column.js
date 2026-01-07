/**
 * Script pour ajouter la colonne 'lockr_url' à la table 'games' dans Supabase
 * 
 * ⚠️ IMPORTANT : Ce script nécessite la clé SERVICE_ROLE de Supabase
 * car il modifie la structure de la table (ALTER TABLE)
 */

import https from 'https'
import { SUPABASE_CONFIG } from '../../electron/supabase-config.js'

const SUPABASE_URL = SUPABASE_CONFIG.URL
const SUPABASE_SERVICE_KEY = SUPABASE_CONFIG.SERVICE_KEY

// Fonction pour vérifier si la colonne existe
async function checkColumnExists() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/games?select=lockr_url&limit=1`)
    
    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }

      const req = https.request(url, options, (res) => {
        let data = ''
        
        res.on('data', (chunk) => {
          data += chunk
        })
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(true) // La colonne existe
          } else if (res.statusCode === 400 && data.includes('column') && data.includes('lockr_url')) {
            resolve(false) // La colonne n'existe pas
          } else {
            resolve(false) // Par défaut, on considère qu'elle n'existe pas
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.end()
    })
  } catch (error) {
    console.error('Erreur lors de la vérification:', error)
    return false
  }
}

async function addLockrUrlColumn() {
  try {
    console.log('🔍 Vérification de l\'existence de la colonne "lockr_url"...')
    
    const columnExists = await checkColumnExists()
    
    if (columnExists) {
      console.log('✅ La colonne "lockr_url" existe déjà dans la table "games"')
      return
    }
    
    console.log('📝 La colonne "lockr_url" n\'existe pas. Ajout en cours...')
    console.log('⚠️  Note: Vous devez ajouter cette colonne manuellement dans Supabase')
    console.log('')
    console.log('📋 Instructions pour ajouter la colonne dans Supabase:')
    console.log('')
    console.log('1. Allez sur https://supabase.com/dashboard')
    console.log('2. Sélectionnez votre projet')
    console.log('3. Allez dans "SQL Editor"')
    console.log('4. Exécutez cette requête SQL:')
    console.log('')
    console.log('   ALTER TABLE games ADD COLUMN IF NOT EXISTS lockr_url TEXT;')
    console.log('')
    console.log('Ou via l\'interface:')
    console.log('1. Allez dans "Table Editor"')
    console.log('2. Sélectionnez la table "games"')
    console.log('3. Cliquez sur "Add Column"')
    console.log('4. Nom: lockr_url')
    console.log('5. Type: text')
    console.log('6. Nullable: Oui')
    console.log('7. Cliquez sur "Save"')
    console.log('')
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.log('')
    console.log('📋 Instructions manuelles pour ajouter la colonne:')
    console.log('')
    console.log('1. Allez sur https://supabase.com/dashboard')
    console.log('2. Sélectionnez votre projet')
    console.log('3. Allez dans "Table Editor"')
    console.log('4. Sélectionnez la table "games"')
    console.log('5. Cliquez sur "Add Column"')
    console.log('6. Nom: lockr_url')
    console.log('7. Type: text')
    console.log('8. Nullable: Oui')
    console.log('9. Cliquez sur "Save"')
    console.log('')
  }
}

// Exécuter le script
addLockrUrlColumn()

