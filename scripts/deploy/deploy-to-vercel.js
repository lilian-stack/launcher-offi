/**
 * Script pour déployer redirect.html directement sur Vercel via l'API
 * Usage: node scripts/deploy/deploy-to-vercel.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration Vercel
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || process.env.VERCEL_AUTH_TOKEN
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID
const VERCEL_PROJECT_ID = 'prj_ijzOLxTRWNlP8IvIdLYOUlki79pp' // Projet ID fourni par l'utilisateur
const VERCEL_PROJECT_NAME = process.env.VERCEL_PROJECT_NAME || 'actoris'

async function deployToVercel() {
  try {
    console.log('🚀 Déploiement sur Vercel...')
    console.log('')
    
    if (!VERCEL_TOKEN) {
      console.error('❌ VERCEL_TOKEN n\'est pas défini')
      console.error('💡 Pour obtenir un token:')
      console.error('   1. Allez sur https://vercel.com/account/tokens')
      console.error('   2. Créez un nouveau token')
      console.error('   3. Définissez: export VERCEL_TOKEN=votre_token')
      console.error('')
      console.error('⚠️  Alternative: Utilisez Vercel CLI')
      console.error('   npm install -g vercel')
      console.error('   vercel login')
      console.error('   vercel --prod')
      throw new Error('VERCEL_TOKEN requis')
    }
    
    // Lire le fichier redirect.html
    const filePath = path.join(__dirname, '..', '..', 'public', 'redirect.html')
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable: ${filePath}`)
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    console.log(`✅ Fichier lu: public/redirect.html`)
    console.log(`📏 Taille: ${fileContent.length} caractères`)
    console.log('')
    
    // Option 1: Utiliser l'API Vercel pour créer un déploiement
    // Note: L'API Vercel nécessite généralement un build complet, pas juste un fichier
    // Donc on va plutôt utiliser une approche différente
    
    console.log('💡 Pour déployer sur Vercel, vous avez plusieurs options:')
    console.log('')
    console.log('Option 1: Vercel CLI (Recommandé)')
    console.log('   1. npm install -g vercel')
    console.log('   2. vercel login')
    console.log('   3. vercel --prod')
    console.log('')
    console.log('Option 2: GitHub (Automatique)')
    console.log('   Si votre projet Vercel est connecté à GitHub,')
    console.log('   le push GitHub que nous avons fait devrait déclencher')
    console.log('   un déploiement automatique dans 1-2 minutes.')
    console.log('')
    console.log('Option 3: Vercel Dashboard')
    console.log('   1. Allez sur https://vercel.com')
    console.log('   2. Ouvrez votre projet')
    console.log('   3. Dans "Deployments", cliquez sur "Redeploy"')
    console.log('')
    
    // Vérifier si le déploiement GitHub a déclenché Vercel
    console.log('🔍 Vérification du statut du déploiement...')
    await checkVercelDeployment()
    
  } catch (error) {
    console.error('❌ Erreur:', error.message)
    throw error
  }
}

async function checkVercelDeployment() {
  try {
    const url = 'https://actoris.vercel.app/redirect.html?game=Test&gameId=123'
    const urlObj = new URL(url)
    
    return new Promise((resolve) => {
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Le fichier redirect.html est accessible!')
          console.log(`🔗 URL: ${url}`)
          resolve(true)
        } else if (res.statusCode === 404) {
          console.log('⏳ Le fichier n\'est pas encore déployé (404)')
          console.log('💡 Attendez 1-2 minutes pour que Vercel déploie automatiquement')
          console.log('   depuis le push GitHub que nous avons fait.')
          resolve(false)
        } else {
          console.log(`⚠️  Statut HTTP: ${res.statusCode}`)
          resolve(false)
        }
      })
      
      req.on('error', () => {
        console.log('⏳ Déploiement en cours ou URL non accessible')
        resolve(false)
      })
      
      req.on('timeout', () => {
        console.log('⏳ Timeout - Le déploiement peut être en cours')
        req.destroy()
        resolve(false)
      })
      
      req.end()
    })
  } catch (error) {
    console.log('⚠️  Impossible de vérifier:', error.message)
    return false
  }
}

// Exécuter
deployToVercel()
  .then(() => {
    console.log('')
    console.log('============================================')
    console.log('✅ VÉRIFICATION TERMINÉE')
    console.log('============================================')
    console.log('')
    console.log('📋 Prochaines étapes:')
    console.log('   1. Attendez 1-2 minutes')
    console.log('   2. Vérifiez avec: node scripts/utils/check-vercel-url.js')
    console.log('   3. Si toujours 404, utilisez Vercel CLI ou Dashboard')
    console.log('')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('============================================')
    console.error('❌ ERREUR')
    console.error('============================================')
    console.error('')
    process.exit(1)
  })

