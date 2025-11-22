import https from 'https'

/**
 * Récupère les données d'un jeu Steam via l'API Steam
 */
export async function getSteamGameData(appId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'store.steampowered.com',
      path: `/api/appdetails?appids=${appId}&l=french`,
      method: 'GET',
      headers: {
        'User-Agent': 'ACTORIS-Launcher',
      },
    }

    const req = https.request(options, (res) => {
      let body = ''

      res.on('data', (chunk) => {
        body += chunk
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const appData = parsed[appId]
          
          if (!appData || !appData.success) {
            reject(new Error('Jeu non trouvé sur Steam'))
            return
          }

          const data = appData.data
          
          // Extraire les informations nécessaires
          const gameInfo = {
            id: appId,
            name: data.name || '',
            short_description: data.short_description || '',
            header_image: data.header_image || '',
            movies: data.movies && data.movies.length > 0 
              ? data.movies[0].webm?.max || data.movies[0].mp4?.max || null
              : null,
            pc_requirements: data.pc_requirements || null,
          }
          
          // Log pour debug
          console.log('[steam-service] Game data retrieved:', {
            id: gameInfo.id,
            name: gameInfo.name,
            hasPcRequirements: !!gameInfo.pc_requirements,
            pcRequirementsKeys: gameInfo.pc_requirements ? Object.keys(gameInfo.pc_requirements) : null
          })
          if (gameInfo.pc_requirements) {
            console.log('[steam-service] pc_requirements structure:', JSON.stringify(gameInfo.pc_requirements, null, 2))
            if (gameInfo.pc_requirements.minimum) {
              console.log('[steam-service] minimum type:', typeof gameInfo.pc_requirements.minimum)
              console.log('[steam-service] minimum value (first 200 chars):', 
                typeof gameInfo.pc_requirements.minimum === 'string' 
                  ? gameInfo.pc_requirements.minimum.substring(0, 200)
                  : JSON.stringify(gameInfo.pc_requirements.minimum, null, 2).substring(0, 200))
            }
            if (gameInfo.pc_requirements.recommended) {
              console.log('[steam-service] recommended type:', typeof gameInfo.pc_requirements.recommended)
              console.log('[steam-service] recommended value (first 200 chars):', 
                typeof gameInfo.pc_requirements.recommended === 'string' 
                  ? gameInfo.pc_requirements.recommended.substring(0, 200)
                  : JSON.stringify(gameInfo.pc_requirements.recommended, null, 2).substring(0, 200))
            }
          }

          // Limiter la description à 200 caractères (sans HTML)
          if (gameInfo.short_description) {
            // Supprimer les balises HTML pour compter les caractères
            const textOnly = gameInfo.short_description.replace(/<[^>]*>/g, '')
            if (textOnly.length > 200) {
              gameInfo.short_description = textOnly.substring(0, 200) + '...'
            }
          }

          resolve(gameInfo)
        } catch (error) {
          reject(new Error(`Erreur lors du parsing: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

