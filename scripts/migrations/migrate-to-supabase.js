/**
 * Script pour migrer tous les jeux depuis GitHub vers Supabase
 * Usage: node scripts/migrate-to-supabase.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getGamesFromGitHub } from '../electron/github-games-service.js'
import { addGameToSupabase } from '../electron/supabase-games-service.js'
import { SUPABASE_CONFIG } from '../electron/supabase-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Fonction principale
 */
async function main() {
  try {
    // Vérifier la configuration Supabase
    if (!SUPABASE_CONFIG.URL || SUPABASE_CONFIG.URL.includes('your-project')) {
      console.error('[Migration] ❌ Erreur: Configuration Supabase manquante')
      console.log('[Migration] Veuillez configurer SUPABASE_URL et SUPABASE_ANON_KEY dans electron/supabase-config.js')
      console.log('[Migration] Ou définir les variables d\'environnement:')
      console.log('[Migration]   - SUPABASE_URL=https://your-project.supabase.co')
      console.log('[Migration]   - SUPABASE_ANON_KEY=your-anon-key')
      console.log('[Migration]   - SUPABASE_SERVICE_KEY=your-service-key (pour les opérations admin)')
      process.exit(1)
    }
    
    console.log('[Migration] 🚀 Démarrage de la migration GitHub → Supabase...')
    console.log(`[Migration] 📦 Supabase URL: ${SUPABASE_CONFIG.URL}`)
    console.log(`[Migration] 📄 Table: ${SUPABASE_CONFIG.GAMES_TABLE}`)

    // 1. Récupérer les jeux depuis GitHub
    let gamesData
    try {
      console.log('[Migration] 📥 Récupération des jeux depuis GitHub...')
      const githubToken = process.env.GITHUB_TOKEN || null
      gamesData = await getGamesFromGitHub(githubToken)
      
      if (!gamesData.games || gamesData.games.length === 0) {
        console.log('[Migration] ⚠️ Aucun jeu trouvé sur GitHub')
        // Essayer de charger depuis un backup local
        const backupPath = path.join(__dirname, '..', 'games-backup.json')
        if (fs.existsSync(backupPath)) {
          console.log('[Migration] 🔄 Tentative de chargement depuis le backup local...')
          try {
            const backupContent = fs.readFileSync(backupPath, 'utf-8')
            gamesData = JSON.parse(backupContent)
            console.log(`[Migration] ✅ ${gamesData.games?.length || 0} jeux chargés depuis le backup`)
          } catch (backupError) {
            console.error('[Migration] ❌ Erreur lors du chargement du backup:', backupError.message)
            console.log('[Migration] ⚠️ Aucun jeu trouvé, migration annulée')
            return
          }
        } else {
          console.log('[Migration] ⚠️ Aucun backup local trouvé, migration annulée')
          return
        }
      } else {
        console.log(`[Migration] ✅ ${gamesData.games.length} jeux récupérés depuis GitHub`)
      }
    } catch (error) {
      console.error('[Migration] ❌ Erreur lors de la récupération depuis GitHub:', error.message)
      
      // Essayer de charger depuis un backup local
      const backupPath = path.join(__dirname, '..', 'games-backup.json')
      if (fs.existsSync(backupPath)) {
        console.log('[Migration] 🔄 Tentative de chargement depuis le backup local...')
        try {
          const backupContent = fs.readFileSync(backupPath, 'utf-8')
          gamesData = JSON.parse(backupContent)
          console.log(`[Migration] ✅ ${gamesData.games?.length || 0} jeux chargés depuis le backup`)
        } catch (backupError) {
          console.error('[Migration] ❌ Erreur lors du chargement du backup:', backupError.message)
          throw error
        }
      } else {
        throw error
      }
    }

    // 2. Sauvegarder localement (backup avant migration)
    const backupPath = path.join(__dirname, '..', 'games-backup-before-supabase.json')
    fs.writeFileSync(backupPath, JSON.stringify(gamesData, null, 2), 'utf-8')
    console.log(`[Migration] 💾 Backup local créé: ${backupPath}`)

    // 3. Migrer vers Supabase
    console.log('[Migration] 📤 Migration vers Supabase...')
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < gamesData.games.length; i++) {
      const game = gamesData.games[i]
      try {
        const gameName = game.name || game.id || `Jeu ${i + 1}`
        console.log(`[Migration] [${i + 1}/${gamesData.games.length}] Migration du jeu: ${gameName}`)
        await addGameToSupabase(game)
        successCount++
        
        // Afficher la progression tous les 10 jeux
        if ((i + 1) % 10 === 0) {
          console.log(`[Migration] 📊 Progression: ${i + 1}/${gamesData.games.length} jeux traités`)
        }
      } catch (error) {
        console.error(`[Migration] ❌ Erreur pour le jeu ${game.id || `index ${i}`}:`, error.message)
        errorCount++
      }
      
      // Petit délai pour éviter de surcharger l'API Supabase
      if (i < gamesData.games.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    console.log(`[Migration] ✅ Migration terminée!`)
    console.log(`[Migration]   - ${successCount} jeux migrés avec succès`)
    if (errorCount > 0) {
      console.log(`[Migration]   - ${errorCount} erreurs`)
    }
    
    console.log('[Migration] 🎉 Tous les jeux sont maintenant sur Supabase!')
  } catch (error) {
    console.error('[Migration] ❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

// Exécuter le script
main()

