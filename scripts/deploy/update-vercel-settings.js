/**
 * Script pour mettre à jour les paramètres du projet Vercel via l'API
 * Désactive le build automatique pour servir uniquement des fichiers statiques
 */

import https from 'https'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const PROJECT_ID = 'prj_ijzOLxTRWNlP8IvIdLYOUlki79pp'
const TEAM_ID = 'team_s3JSaY0OzaZzhVE8ZAcVYOiD'

if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN n\'est pas défini')
  console.error('💡 Obtenez un token sur: https://vercel.com/account/tokens')
  process.exit(1)
}

const updateProjectSettings = () => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      buildCommand: '',
      outputDirectory: '.',
      installCommand: '',
      framework: null,
      public: true
    })

    const options = {
      hostname: 'api.vercel.com',
      path: `/v10/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Paramètres du projet mis à jour avec succès!')
          resolve(JSON.parse(responseData))
        } else {
          console.error(`❌ Erreur ${res.statusCode}:`, responseData)
          reject(new Error(`Erreur ${res.statusCode}`))
        }
      })
    })

    req.on('error', (error) => {
      console.error('❌ Erreur de requête:', error.message)
      reject(error)
    })

    req.write(data)
    req.end()
  })
}

updateProjectSettings()
  .then(() => {
    console.log('')
    console.log('📋 Prochaines étapes:')
    console.log('   1. Redéployez: npx vercel --prod --force')
    console.log('   2. Vérifiez: node scripts/utils/check-vercel-url.js')
    console.log('')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('❌ Échec de la mise à jour')
    console.error('')
    process.exit(1)
  })

