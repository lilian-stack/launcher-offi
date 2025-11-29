import https from 'https'

// Vérifier si on est en mode développement
const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true'

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
          // Récupérer la vidéo en essayant plusieurs formats et sources
          // Prioriser les vidéos "highlight" (trailer principal)
          // Essayer mp4 en priorité car plus compatible et moins sujet aux 404
          let videoUrl = null
          if (data.movies && data.movies.length > 0) {
            if (isDev) {
              console.log('[steam-service] Movies disponibles:', data.movies.length)
            }
            
            // Trier les vidéos : highlight en premier
            const sortedMovies = [...data.movies].sort((a, b) => {
              if (a.highlight && !b.highlight) return -1
              if (!a.highlight && b.highlight) return 1
              return 0
            })
            
            // Essayer toutes les vidéos disponibles, en commençant par les highlight
            // PRIORISER MP4 car plus fiable que WEBM (moins de 404)
            for (let i = 0; i < sortedMovies.length; i++) {
              const movie = sortedMovies[i]
              
              if (isDev) {
                console.log(`[steam-service] Movie ${i} (${movie.highlight ? 'highlight' : 'normal'}):`, {
                  id: movie.id,
                  name: movie.name,
                  hasWebm: !!movie.webm,
                  hasMp4: !!movie.mp4
                })
              }
              
              // PRIORITÉ MODIFIÉE : mp4.max > mp4.480 > webm.max > webm.480
              // MP4 est généralement plus fiable et compatible
              if (movie.mp4?.max) {
                videoUrl = movie.mp4.max
                if (isDev) {
                  console.log('[steam-service] Vidéo trouvée (mp4.max):', videoUrl)
                }
                break
              } else if (movie.mp4?.['480']) {
                videoUrl = movie.mp4['480']
                if (isDev) {
                  console.log('[steam-service] Vidéo trouvée (mp4.480):', videoUrl)
                }
                break
              } else if (movie.webm?.max) {
                videoUrl = movie.webm.max
                if (isDev) {
                  console.log('[steam-service] Vidéo trouvée (webm.max):', videoUrl)
                }
                break
              } else if (movie.webm?.['480']) {
                videoUrl = movie.webm['480']
                if (isDev) {
                  console.log('[steam-service] Vidéo trouvée (webm.480):', videoUrl)
                }
                break
              } else if (movie.mp4) {
                // Si mp4 est un objet, essayer les différentes qualités
                if (typeof movie.mp4 === 'object') {
                  videoUrl = movie.mp4.max || movie.mp4['480'] || movie.mp4['360'] || Object.values(movie.mp4)[0]
                } else {
                  videoUrl = movie.mp4
                }
                if (videoUrl) {
                  if (isDev) {
                    console.log('[steam-service] Vidéo trouvée (mp4):', videoUrl)
                  }
                  break
                }
              } else if (movie.webm) {
                // Si webm est un objet, essayer les différentes qualités
                if (typeof movie.webm === 'object') {
                  videoUrl = movie.webm.max || movie.webm['480'] || movie.webm['360'] || Object.values(movie.webm)[0]
                } else {
                  videoUrl = movie.webm
                }
                if (videoUrl) {
                  if (isDev) {
                    console.log('[steam-service] Vidéo trouvée (webm):', videoUrl)
                  }
                  break
                }
              }
            }
            
            if (!videoUrl) {
              if (isDev) {
                console.warn('[steam-service] Aucune vidéo valide trouvée dans les', data.movies.length, 'vidéos disponibles')
              }
            } else if (isDev) {
              console.log('[steam-service] Vidéo sélectionnée:', videoUrl)
            }
          } else {
            if (isDev) {
              console.log('[steam-service] Aucune vidéo disponible pour ce jeu')
            }
          }

          const gameInfo = {
            id: appId,
            name: data.name || '',
            short_description: data.short_description || '',
            header_image: data.header_image || '',
            movies: videoUrl, // Utiliser la vidéo trouvée ou null
            pc_requirements: data.pc_requirements || null,
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

