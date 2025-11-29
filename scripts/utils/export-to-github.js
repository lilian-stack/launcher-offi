/**
 * Script pour migrer tous les jeux depuis Firebase vers GitHub (migration unique)
 * Ce script récupère une dernière fois les jeux depuis Firebase et les pousse sur GitHub
 * Après cette migration, le système utilisera uniquement GitHub (plus de Firebase)
 * Usage: node scripts/export-to-github.js
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getGamesFromFirebase } from '../electron/firebase-games-service.js'
import { updateGamesOnGitHub } from '../electron/github-games-service.js'
import { GITHUB_CONFIG } from '../electron/github-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)



/**
 * Fonction principale
 */
async function main() {
  try {
    // Vérifier si le token GitHub est fourni (variable d'environnement ou config)
    const githubToken = process.env.GITHUB_TOKEN || GITHUB_CONFIG.TOKEN
    if (!githubToken) {
      console.error('[Export] ❌ Erreur: GITHUB_TOKEN n\'est pas défini')
      console.log('[Export] Veuillez définir la variable d\'environnement GITHUB_TOKEN')
      console.log('[Export] Exemple (Windows): set GITHUB_TOKEN=votre_token_github')
      console.log('[Export] Exemple (Linux/Mac): export GITHUB_TOKEN=votre_token_github')
      process.exit(1)
    }
    
    console.log('[Export] 🚀 Démarrage de l\'export...')
    console.log(`[Export] 📦 Repository: lilian-stack/ACTORIS.games`)
    console.log(`[Export] 📄 Fichier: game.json`)

    // 1. Récupérer les jeux depuis Firebase (dernière fois avant migration vers GitHub)
    let gamesData
    try {
      console.log('[Export] 📥 Récupération des jeux depuis Firebase (dernière fois)...')
      gamesData = await getGamesFromFirebase()
      
      if (!gamesData.games || gamesData.games.length === 0) {
        console.log('[Export] ⚠️ Aucun jeu trouvé dans Firebase')
        console.log('[Export] ℹ️  Vérification sur GitHub...')
        // Essayer de récupérer depuis GitHub si Firebase est vide
        try {
          const { getGamesFromGitHub } = await import('../electron/github-games-service.js')
          gamesData = await getGamesFromGitHub(githubToken)
          if (gamesData && gamesData.games && gamesData.games.length > 0) {
            console.log(`[Export] ✅ ${gamesData.games.length} jeux trouvés sur GitHub`)
            console.log('[Export] ℹ️  Utilisation des données GitHub')
          } else {
            console.log('[Export] ⚠️ Aucun jeu trouvé nulle part')
            return
          }
        } catch (githubError) {
          console.error('[Export] ❌ Erreur lors de la récupération depuis GitHub:', githubError.message)
          return
        }
      } else {
        console.log(`[Export] ✅ ${gamesData.games.length} jeux récupérés depuis Firebase`)
      }
    } catch (error) {
      console.error('[Export] ❌ Erreur lors de la récupération depuis Firebase:', error.message)
      
      // Si Firebase échoue (quota dépassé, etc.), essayer de récupérer depuis GitHub
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('403')) {
        console.log('[Export] 🔄 Firebase indisponible (quota dépassé), tentative de récupération depuis GitHub...')
        try {
          const { getGamesFromGitHub } = await import('../electron/github-games-service.js')
          gamesData = await getGamesFromGitHub(githubToken)
          if (gamesData && gamesData.games && gamesData.games.length > 0) {
            console.log(`[Export] ✅ ${gamesData.games.length} jeux récupérés depuis GitHub`)
            console.log('[Export] ⚠️ Utilisation des données GitHub (Firebase indisponible)')
          } else {
            throw new Error('Aucun jeu trouvé sur GitHub')
          }
        } catch (githubError) {
          console.error('[Export] ❌ Impossible de récupérer les jeux depuis GitHub:', githubError.message)
          throw new Error('Impossible de récupérer les jeux depuis Firebase ou GitHub')
        }
      } else {
        throw error
      }
    }

    // 2. Sauvegarder localement (backup)
    const backupPath = path.join(__dirname, '..', 'games-backup.json')
    fs.writeFileSync(backupPath, JSON.stringify(gamesData, null, 2), 'utf-8')
    console.log(`[Export] 💾 Backup local créé: ${backupPath}`)

    // 3. Pousser sur GitHub (utiliser le nouveau service)
    console.log('[Export] 📤 Déploiement sur GitHub...')
    await updateGamesOnGitHub(gamesData, githubToken)
    
    console.log('[Export] ✅ Export terminé avec succès!')
  } catch (error) {
    console.error('[Export] ❌ Erreur lors de l\'export:', error)
    process.exit(1)
  }
}

// Exécuter le script
main()

