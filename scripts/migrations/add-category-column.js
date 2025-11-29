import https from 'https'
import { SUPABASE_CONFIG } from '../electron/supabase-config.js'

/**
 * Script pour ajouter la colonne 'category' à la table 'games' dans Supabase
 * 
 * ⚠️ IMPORTANT : Ce script nécessite la clé SERVICE_ROLE de Supabase
 * car il modifie la structure de la table (ALTER TABLE)
 */

const SUPABASE_URL = SUPABASE_CONFIG.URL
const SUPABASE_SERVICE_KEY = SUPABASE_CONFIG.SERVICE_KEY

// Fonction pour exécuter une requête SQL via l'API Supabase
function executeSQL(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`)
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data)
            resolve(result)
          } catch (e) {
            resolve(data)
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(JSON.stringify({ query }))
    req.end()
  })
}

// Fonction alternative : utiliser l'API REST pour vérifier si la colonne existe
async function checkColumnExists() {
  try {
    // Essayer de récupérer un jeu avec la colonne category
    const url = new URL(`${SUPABASE_URL}/rest/v1/games?select=category&limit=1`)
    
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
          } else if (res.statusCode === 400 && data.includes('column') && data.includes('category')) {
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

async function addCategoryColumn() {
  try {
    console.log('🔍 Vérification de l\'existence de la colonne "category"...')
    
    const columnExists = await checkColumnExists()
    
    if (columnExists) {
      console.log('✅ La colonne "category" existe déjà dans la table "games"')
      return
    }
    
    console.log('📝 La colonne "category" n\'existe pas. Ajout en cours...')
    console.log('⚠️  Note: Vous devez ajouter cette colonne manuellement dans Supabase')
    console.log('')
    console.log('📋 Instructions pour ajouter la colonne dans Supabase:')
    console.log('')
    console.log('1. Allez sur https://supabase.com/dashboard')
    console.log('2. Sélectionnez votre projet')
    console.log('3. Allez dans "SQL Editor"')
    console.log('4. Exécutez cette requête SQL:')
    console.log('')
    console.log('   ALTER TABLE games ADD COLUMN IF NOT EXISTS category TEXT;')
    console.log('')
    console.log('Ou via l\'interface:')
    console.log('1. Allez dans "Table Editor"')
    console.log('2. Sélectionnez la table "games"')
    console.log('3. Cliquez sur "Add Column"')
    console.log('4. Nom: category')
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
    console.log('6. Nom: category')
    console.log('7. Type: text')
    console.log('8. Nullable: Oui')
    console.log('9. Cliquez sur "Save"')
    console.log('')
  }
}

// Exécuter le script
addCategoryColumn()

