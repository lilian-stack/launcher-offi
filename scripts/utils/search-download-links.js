import axios from 'axios'
import { getGamesFromSupabase, updateGameOnSupabase } from '../electron/supabase-games-service.js'
import * as cheerio from 'cheerio'

// Configuration
const MAX_GAMES_TO_PROCESS = 35 // Nombre maximum de jeux à traiter
const DELAY_BETWEEN_REQUESTS = 2000 // Délai entre chaque requête (2 secondes)
const ACCEPTED_PROVIDERS = ['buzzheavier.com', 'pixeldrain.com'] // Providers acceptés

/**
 * Vérifie si une page de téléchargement contient bien un fichier valide
 */
async function verifyDownloadPage(url) {
  try {
    console.log(`    [Vérification] Vérification de la page: ${url}`)
    const html = await httpRequest(url)
    const $ = cheerio.load(html)

    // Vérifier pour BuzzHeavier
    if (url.includes('buzzheavier.com')) {
      // Chercher les éléments caractéristiques d'une page de fichier BuzzHeavier
      const hasFileName = $('body').text().match(/\.(rar|zip|7z|iso|exe)/i)
      const hasSize = $('body').text().match(/(Size|Taille|GB|MB|KB)/i)
      const hasDownloadLink = $('a').filter((i, elem) => {
        const text = $(elem).text().toLowerCase()
        return text.includes('download') || text.includes('télécharger')
      }).length > 0
      
      // Vérifier qu'il y a des détails comme "Views" ou "Downloads"
      const hasDetails = $('body').text().match(/(Views|Downloads|Vues|Téléchargements)/i)
      
      if (hasFileName && hasSize && hasDownloadLink && hasDetails) {
        console.log(`    [Vérification] ✅ Page BuzzHeavier valide (fichier détecté)`)
        return true
      } else {
        console.log(`    [Vérification] ❌ Page BuzzHeavier invalide (pas de fichier détecté)`)
        return false
      }
    }

    // Vérifier pour PixelDrain
    if (url.includes('pixeldrain.com')) {
      // Chercher les éléments caractéristiques d'une page de fichier PixelDrain
      const hasFileName = $('body').text().match(/\.(rar|zip|7z|iso|exe)/i)
      const hasCompressedSize = $('body').text().match(/(Compressed size|Taille compressée|GB|MB|KB)/i)
      const hasDownloadButton = $('button, a').filter((i, elem) => {
        const text = $(elem).text().toLowerCase()
        return text.includes('download') || text.includes('télécharger')
      }).length > 0
      
      // Vérifier qu'il y a des informations sur le fichier (upload date, etc.)
      const hasFileInfo = $('body').text().match(/(Uploaded|Téléchargé|Compressed|Uncompressed)/i)
      
      if (hasFileName && hasCompressedSize && hasDownloadButton && hasFileInfo) {
        console.log(`    [Vérification] ✅ Page PixelDrain valide (fichier détecté)`)
        return true
      } else {
        console.log(`    [Vérification] ❌ Page PixelDrain invalide (pas de fichier détecté)`)
        return false
      }
    }

    // Si ce n'est ni BuzzHeavier ni PixelDrain, on accepte par défaut
    return true
  } catch (error) {
    console.error(`    [Vérification] Erreur lors de la vérification: ${error.message}`)
    return false
  }
}

/**
 * Fait une requête HTTP avec axios
 */
async function httpRequest(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/',
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    })
    return response.data
  } catch (error) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
    } else if (error.request) {
      throw new Error('Request timeout or network error')
    } else {
      throw error
    }
  }
}

/**
 * Recherche un jeu sur SteamRIP
 */
async function searchOnSteamRIP(gameName) {
  try {
    console.log(`  [SteamRIP] Recherche de "${gameName}"...`)
    
    // URL de recherche SteamRIP
    const searchUrl = `https://steamrip.com/?s=${encodeURIComponent(gameName)}`
    const html = await httpRequest(searchUrl)
    const $ = cheerio.load(html)

    // Chercher les liens dans les résultats - améliorer la recherche
    const links = []
    const gameNameLower = gameName.toLowerCase()
    const gameNameSlug = gameNameLower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    
    // Chercher dans plusieurs sélecteurs possibles
    $('article a, .post-title a, h2 a, h3 a, .entry-title a, .post a, a[href*="/game"], a[href*="/free-download"]').each((i, elem) => {
      const href = $(elem).attr('href')
      const text = $(elem).text().toLowerCase()
      const parentText = $(elem).parent().text().toLowerCase()
      
      if (href && href.includes('steamrip.com') && !href.includes('#') && !href.includes('javascript:')) {
        // Vérifier si le texte ou l'URL contient le nom du jeu
        const hrefLower = href.toLowerCase()
        const matchesName = text.includes(gameNameLower) || 
                           parentText.includes(gameNameLower) ||
                           hrefLower.includes(gameNameSlug) ||
                           hrefLower.includes(gameNameLower.replace(/\s+/g, '-'))
        
        if (matchesName) {
          // S'assurer que c'est un lien absolu
          const fullUrl = href.startsWith('http') ? href : `https://steamrip.com${href.startsWith('/') ? '' : '/'}${href}`
          if (!links.includes(fullUrl) && fullUrl.includes('steamrip.com')) {
            links.push(fullUrl)
          }
        }
      }
    })

    if (links.length === 0) {
      console.log(`  [SteamRIP] Aucun résultat trouvé`)
      return null
    }

    // Prendre le premier résultat
    const gamePageUrl = links[0]
    console.log(`  [SteamRIP] Page trouvée: ${gamePageUrl}`)

    // Charger la page du jeu
    const gamePageHtml = await httpRequest(gamePageUrl)
    const $game = cheerio.load(gamePageHtml)

    // Chercher les liens de téléchargement dans différents endroits
    const downloadLinks = []
    
    // Chercher spécifiquement les boutons "DOWNLOAD HERE" pour BuzzHeavier et PixelDrain
    $game('a, button').each((i, elem) => {
      const href = $game(elem).attr('href')
      const text = $game(elem).text().toLowerCase()
      const parentText = $game(elem).parent().text().toLowerCase()
      
      // Chercher les boutons qui mentionnent BuzzHeavier ou PixelDrain
      if (text.includes('buzzheavier') || text.includes('pixeldrain') || 
          parentText.includes('buzzheavier') || parentText.includes('pixeldrain') ||
          text.includes('download here') || text.includes('télécharger ici')) {
        if (href) {
          for (const provider of ACCEPTED_PROVIDERS) {
            if (href.includes(provider)) {
              const fullUrl = href.startsWith('http') ? href : `https://steamrip.com${href.startsWith('/') ? '' : '/'}${href}`
              if (!downloadLinks.includes(fullUrl)) {
                downloadLinks.push(fullUrl)
              }
              break
            }
          }
        }
      }
    })
    
    // Chercher dans tous les liens
    $game('a').each((i, elem) => {
      const href = $game(elem).attr('href')
      if (href) {
        // Vérifier si c'est un provider accepté
        for (const provider of ACCEPTED_PROVIDERS) {
          if (href.includes(provider)) {
            const fullUrl = href.startsWith('http') ? href : `https://steamrip.com${href.startsWith('/') ? '' : '/'}${href}`
            if (!downloadLinks.includes(fullUrl)) {
              downloadLinks.push(fullUrl)
            }
            break
          }
        }
      }
    })

    // Chercher aussi dans les textes qui pourraient contenir des URLs
    $game('*').each((i, elem) => {
      const text = $game(elem).text()
      if (text) {
        for (const provider of ACCEPTED_PROVIDERS) {
          const regex = new RegExp(`https?://[^\\s]*${provider.replace('.', '\\.')}[^\\s]*`, 'gi')
          const matches = text.match(regex)
          if (matches) {
            matches.forEach(match => {
              if (!downloadLinks.includes(match)) {
                downloadLinks.push(match)
              }
            })
          }
        }
      }
    })

    if (downloadLinks.length > 0) {
      // Vérifier chaque lien pour s'assurer qu'il contient bien un fichier
      for (const link of downloadLinks) {
        console.log(`  [SteamRIP] Lien trouvé: ${link}`)
        const isValid = await verifyDownloadPage(link)
        if (isValid) {
          console.log(`  [SteamRIP] ✅ Lien validé: ${link}`)
          return link
        } else {
          console.log(`  [SteamRIP] ❌ Lien invalide (pas de fichier), on continue...`)
        }
      }
    }

    console.log(`  [SteamRIP] Aucun lien accepté trouvé`)
    return null
  } catch (error) {
    console.error(`  [SteamRIP] Erreur: ${error.message}`)
    return null
  }
}

/**
 * Recherche un jeu sur SteamGG
 */
async function searchOnSteamGG(gameName) {
  try {
    console.log(`  [SteamGG] Recherche de "${gameName}"...`)
    
    // URL de recherche SteamGG
    const searchUrl = `https://steamgg.com/?s=${encodeURIComponent(gameName)}`
    const html = await httpRequest(searchUrl)
    const $ = cheerio.load(html)

    // Chercher les liens dans les résultats - améliorer la recherche
    const links = []
    const gameNameLower = gameName.toLowerCase()
    const gameNameSlug = gameNameLower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    
    // Chercher dans plusieurs sélecteurs possibles
    $('article a, .post-title a, h2 a, h3 a, .entry-title a, .post a, a[href*="/game"], a[href*="/free-download"]').each((i, elem) => {
      const href = $(elem).attr('href')
      const text = $(elem).text().toLowerCase()
      const parentText = $(elem).parent().text().toLowerCase()
      
      if (href && href.includes('steamgg.com') && !href.includes('#') && !href.includes('javascript:')) {
        // Vérifier si le texte ou l'URL contient le nom du jeu
        const hrefLower = href.toLowerCase()
        const matchesName = text.includes(gameNameLower) || 
                           parentText.includes(gameNameLower) ||
                           hrefLower.includes(gameNameSlug) ||
                           hrefLower.includes(gameNameLower.replace(/\s+/g, '-'))
        
        if (matchesName) {
          // S'assurer que c'est un lien absolu
          const fullUrl = href.startsWith('http') ? href : `https://steamgg.com${href.startsWith('/') ? '' : '/'}${href}`
          if (!links.includes(fullUrl) && fullUrl.includes('steamgg.com')) {
            links.push(fullUrl)
          }
        }
      }
    })

    if (links.length === 0) {
      console.log(`  [SteamGG] Aucun résultat trouvé`)
      return null
    }

    // Prendre le premier résultat
    const gamePageUrl = links[0]
    console.log(`  [SteamGG] Page trouvée: ${gamePageUrl}`)

    // Charger la page du jeu
    const gamePageHtml = await httpRequest(gamePageUrl)
    const $game = cheerio.load(gamePageHtml)

    // Chercher les liens de téléchargement dans différents endroits
    const downloadLinks = []
    
    // Chercher spécifiquement les boutons "DOWNLOAD HERE" pour BuzzHeavier et PixelDrain
    $game('a, button').each((i, elem) => {
      const href = $game(elem).attr('href')
      const text = $game(elem).text().toLowerCase()
      const parentText = $game(elem).parent().text().toLowerCase()
      
      // Chercher les boutons qui mentionnent BuzzHeavier ou PixelDrain
      if (text.includes('buzzheavier') || text.includes('pixeldrain') || 
          parentText.includes('buzzheavier') || parentText.includes('pixeldrain') ||
          text.includes('download here') || text.includes('télécharger ici')) {
        if (href) {
          for (const provider of ACCEPTED_PROVIDERS) {
            if (href.includes(provider)) {
              const fullUrl = href.startsWith('http') ? href : `https://steamgg.com${href.startsWith('/') ? '' : '/'}${href}`
              if (!downloadLinks.includes(fullUrl)) {
                downloadLinks.push(fullUrl)
              }
              break
            }
          }
        }
      }
    })
    
    // Chercher dans tous les liens
    $game('a').each((i, elem) => {
      const href = $game(elem).attr('href')
      if (href) {
        // Vérifier si c'est un provider accepté
        for (const provider of ACCEPTED_PROVIDERS) {
          if (href.includes(provider)) {
            const fullUrl = href.startsWith('http') ? href : `https://steamgg.com${href.startsWith('/') ? '' : '/'}${href}`
            if (!downloadLinks.includes(fullUrl)) {
              downloadLinks.push(fullUrl)
            }
            break
          }
        }
      }
    })

    // Chercher aussi dans les textes qui pourraient contenir des URLs
    $game('*').each((i, elem) => {
      const text = $game(elem).text()
      if (text) {
        for (const provider of ACCEPTED_PROVIDERS) {
          const regex = new RegExp(`https?://[^\\s]*${provider.replace('.', '\\.')}[^\\s]*`, 'gi')
          const matches = text.match(regex)
          if (matches) {
            matches.forEach(match => {
              if (!downloadLinks.includes(match)) {
                downloadLinks.push(match)
              }
            })
          }
        }
      }
    })

    if (downloadLinks.length > 0) {
      // Vérifier chaque lien pour s'assurer qu'il contient bien un fichier
      for (const link of downloadLinks) {
        console.log(`  [SteamGG] Lien trouvé: ${link}`)
        const isValid = await verifyDownloadPage(link)
        if (isValid) {
          console.log(`  [SteamGG] ✅ Lien validé: ${link}`)
          return link
        } else {
          console.log(`  [SteamGG] ❌ Lien invalide (pas de fichier), on continue...`)
        }
      }
    }

    console.log(`  [SteamGG] Aucun lien accepté trouvé`)
    return null
  } catch (error) {
    console.error(`  [SteamGG] Erreur: ${error.message}`)
    return null
  }
}

/**
 * Recherche un lien de téléchargement pour un jeu
 */
async function searchDownloadLink(game) {
  const gameName = game.name || game.title || ''
  console.log(`\n🔍 Recherche pour: ${gameName}`)

  // Essayer SteamRIP d'abord
  let downloadUrl = await searchOnSteamRIP(gameName)
  
  // Si pas trouvé, essayer SteamGG
  if (!downloadUrl) {
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS))
    downloadUrl = await searchOnSteamGG(gameName)
  }

  return downloadUrl
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de la recherche de liens de téléchargement...\n')

  try {
    // Récupérer les jeux depuis Supabase
    console.log('📥 Récupération des jeux depuis Supabase...')
    const result = await getGamesFromSupabase()
    const allGames = result.games || []

    // Filtrer les jeux sans lien de téléchargement
    const gamesWithoutLink = allGames.filter(game => {
      const hasLink = game.downloadUrl && game.downloadUrl.trim() !== ''
      return !hasLink
    })

    console.log(`✅ ${gamesWithoutLink.length} jeux sans lien de téléchargement trouvés\n`)

    if (gamesWithoutLink.length === 0) {
      console.log('✨ Aucun jeu à traiter!')
      return
    }

    // Limiter le nombre de jeux à traiter
    const gamesToProcess = gamesWithoutLink.slice(0, MAX_GAMES_TO_PROCESS)
    console.log(`📋 Traitement de ${gamesToProcess.length} jeux (limite: ${MAX_GAMES_TO_PROCESS})\n`)

    // Rechercher les liens pour chaque jeu
    const results = []
    for (let i = 0; i < gamesToProcess.length; i++) {
      const game = gamesToProcess[i]
      console.log(`\n[${i + 1}/${gamesToProcess.length}] ${game.name || game.title || game.id}`)
      
      try {
        const downloadUrl = await searchDownloadLink(game)
        
        if (downloadUrl) {
          results.push({
            game,
            downloadUrl,
            found: true
          })
          console.log(`✅ Lien trouvé: ${downloadUrl}`)
        } else {
          results.push({
            game,
            downloadUrl: null,
            found: false
          })
          console.log(`❌ Aucun lien trouvé`)
        }

        // Délai entre chaque jeu
        if (i < gamesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS))
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${game.name || game.title}: ${error.message}`)
        results.push({
          game,
          downloadUrl: null,
          found: false,
          error: error.message
        })
      }
    }

    // Afficher le récapitulatif
    console.log('\n' + '='.repeat(80))
    console.log('📊 RÉCAPITULATIF')
    console.log('='.repeat(80))
    
    const foundLinks = results.filter(r => r.found)
    const notFound = results.filter(r => !r.found)

    console.log(`\n✅ Liens trouvés: ${foundLinks.length}`)
    foundLinks.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.game.name || result.game.title || result.game.id}`)
      console.log(`     → ${result.downloadUrl}`)
    })

    console.log(`\n❌ Aucun lien trouvé: ${notFound.length}`)
    notFound.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.game.name || result.game.title || result.game.id}`)
      if (result.error) {
        console.log(`     Erreur: ${result.error}`)
      }
    })

    // Demander confirmation avant de mettre à jour
    console.log('\n' + '='.repeat(80))
    console.log(`\n💾 ${foundLinks.length} jeu(x) seront mis à jour avec un lien de téléchargement.`)
    console.log('⚠️  Appuyez sur Ctrl+C pour annuler, ou attendez 5 secondes pour continuer...\n')

    // Attendre 5 secondes
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Mettre à jour les jeux dans Supabase
    console.log('\n💾 Mise à jour des jeux dans Supabase...\n')
    
    let updated = 0
    let errors = 0

    for (const result of foundLinks) {
      try {
        await updateGameOnSupabase(result.game.id, { downloadUrl: result.downloadUrl })
        console.log(`✅ ${result.game.name || result.game.title || result.game.id} mis à jour`)
        updated++
      } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour de ${result.game.name || result.game.title || result.game.id}: ${error.message}`)
        errors++
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('✨ TERMINÉ')
    console.log('='.repeat(80))
    console.log(`✅ ${updated} jeu(x) mis à jour`)
    if (errors > 0) {
      console.log(`❌ ${errors} erreur(s)`)
    }
    console.log('')

  } catch (error) {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  }
}

// Lancer le script
main().catch(error => {
  console.error('❌ Erreur:', error)
  process.exit(1)
})

