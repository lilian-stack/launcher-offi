/**
 * Script pour vérifier et tester l'URL Vercel
 * Usage: node scripts/utils/check-vercel-url.js
 */

import { VERCEL_BASE_URL, getRedirectUrl } from '../../electron/vercel-config.js'
import https from 'https'
import http from 'http'

async function checkVercelUrl() {
  console.log('[Script] ============================================')
  console.log('[Script] 🔍 VÉRIFICATION DE L\'URL VERCEL')
  console.log('[Script] ============================================\n')
  
  console.log(`[Script] 📋 URL configurée: ${VERCEL_BASE_URL}`)
  
  // Tester l'URL de base
  const baseUrl = VERCEL_BASE_URL.replace(/\/$/, '')
  const redirectUrl = `${baseUrl}/redirect.html?game=Test&gameId=123`
  
  console.log(`[Script] 🔗 URL de redirection test: ${redirectUrl}\n`)
  
  // Tester si l'URL est accessible
  const urlObj = new URL(redirectUrl)
  const isHttps = urlObj.protocol === 'https:'
  
  console.log(`[Script] 🔄 Test de connexion à ${urlObj.hostname}...`)
  
  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`[Script] 📡 Statut HTTP: ${res.statusCode}`)
      
      if (res.statusCode === 200) {
        console.log(`[Script] ✅ L'URL est accessible!`)
        console.log(`[Script] ✅ Le fichier redirect.html est déployé correctement`)
        resolve(true)
      } else if (res.statusCode === 404) {
        console.log(`[Script] ❌ Erreur 404: Le fichier redirect.html n'est pas trouvé`)
        console.log(`[Script] 💡 Solution: Déployez le fichier public/redirect.html sur Vercel`)
        resolve(false)
      } else {
        console.log(`[Script] ⚠️ Statut inattendu: ${res.statusCode}`)
        resolve(false)
      }
    })
    
    req.on('error', (err) => {
      console.error(`[Script] ❌ Erreur de connexion: ${err.message}`)
      console.log(`[Script] 💡 Vérifiez que l'URL Vercel est correcte`)
      resolve(false)
    })
    
    req.on('timeout', () => {
      console.error(`[Script] ❌ Timeout: La connexion a pris trop de temps`)
      req.destroy()
      resolve(false)
    })
    
    req.end()
  })
}

checkVercelUrl()
  .then((success) => {
    if (success) {
      console.log(`\n[Script] ============================================`)
      console.log(`[Script] ✅ Vérification terminée avec succès`)
      console.log(`[Script] ============================================`)
      process.exit(0)
    } else {
      console.log(`\n[Script] ============================================`)
      console.log(`[Script] ⚠️ Vérification terminée avec des erreurs`)
      console.log(`[Script] ============================================`)
      process.exit(1)
    }
  })
  .catch((err) => {
    console.error(`[Script] ❌ Erreur critique:`, err)
    process.exit(1)
  })

