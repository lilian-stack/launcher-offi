import { getGamesFromSupabase, updateGameOnSupabase } from '../electron/supabase-games-service.js'

/**
 * Met à jour la catégorie des jeux existants sans lien de téléchargement
 */
async function updateGamesCategory() {
  try {
    console.log('📥 Récupération des jeux depuis Supabase...')
    const { games } = await getGamesFromSupabase()
    
    console.log(`📊 ${games.length} jeux trouvés`)
    
    let updated = 0
    let skipped = 0
    
    for (const game of games) {
      // Si le jeu n'a pas de downloadUrl (ou downloadUrl est vide), mettre la catégorie "Pas trouvé"
      if (!game.downloadUrl || game.downloadUrl === '' || game.downloadUrl === null) {
        // Vérifier si la catégorie n'est pas déjà "Pas trouvé"
        if (game.category !== 'Pas trouvé') {
          console.log(`📝 Mise à jour de "${game.name}" : catégorie "Pas trouvé"`)
          await updateGameOnSupabase(game.id, { category: 'Pas trouvé' })
          updated++
        } else {
          skipped++
        }
      } else {
        // Si le jeu a un downloadUrl, ne pas mettre "Pas trouvé"
        if (game.category === 'Pas trouvé') {
          console.log(`📝 Mise à jour de "${game.name}" : suppression de la catégorie "Pas trouvé" (lien de téléchargement présent)`)
          await updateGameOnSupabase(game.id, { category: null })
          updated++
        } else {
          skipped++
        }
      }
    }
    
    console.log(`\n✅ ${updated} jeux mis à jour`)
    console.log(`⏭️  ${skipped} jeux ignorés (déjà à jour)`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error)
    process.exit(1)
  }
}

// Exécuter le script
updateGamesCategory()

