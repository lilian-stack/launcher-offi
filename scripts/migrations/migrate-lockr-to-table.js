// Script pour migrer les liens Lockr existants depuis la table games vers lockr_links
// Ce script lit tous les jeux qui ont un lockr_url et les copie dans la nouvelle table

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fpxcefuqwvwdduzkmkrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateLockrLinks() {
  console.log('🔄 Début de la migration des liens Lockr...\n');
  
  try {
    // 1. Récupérer tous les jeux avec un lockr_url
    console.log('📡 Récupération des jeux avec lockr_url...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, title, name, lockr_url, LockrUrl')
      .or('lockr_url.not.is.null,LockrUrl.not.is.null');
    
    if (gamesError) {
      throw new Error(`Erreur lors de la récupération des jeux: ${gamesError.message}`);
    }
    
    if (!games || games.length === 0) {
      console.log('✅ Aucun jeu avec lockr_url trouvé. Migration terminée.');
      return;
    }
    
    console.log(`✅ ${games.length} jeux avec lockr_url trouvés\n`);
    
    // 2. Vérifier si la table lockr_links existe
    console.log('🔍 Vérification de l\'existence de la table lockr_links...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('lockr_links')
      .select('id')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST116') {
      console.error('❌ La table lockr_links n\'existe pas !');
      console.error('   Veuillez d\'abord exécuter le script SQL: scripts/supabase/create-lockr-table.sql');
      return;
    }
    
    console.log('✅ Table lockr_links trouvée\n');
    
    // 3. Migrer chaque jeu
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const game of games) {
      const gameId = game.id?.toString() || game.id;
      const gameName = game.title || game.name || 'Jeu inconnu';
      
      // Récupérer le lockr_url (peut être dans lockr_url ou LockrUrl)
      const lockrUrl = game.lockr_url || game.LockrUrl;
      
      if (!lockrUrl) {
        console.log(`⚠️  Jeu ${gameId} (${gameName}) : Pas de lockr_url, ignoré`);
        skippedCount++;
        continue;
      }
      
      // Vérifier si le lien existe déjà
      const { data: existing } = await supabase
        .from('lockr_links')
        .select('id')
        .eq('game_id', gameId)
        .eq('lockr_url', lockrUrl)
        .single();
      
      if (existing) {
        console.log(`⏭️  Jeu ${gameId} (${gameName}) : Lien déjà présent, ignoré`);
        skippedCount++;
        continue;
      }
      
      // Insérer le lien
      const { data, error } = await supabase
        .from('lockr_links')
        .insert({
          game_id: gameId,
          game_name: gameName,
          lockr_url: lockrUrl,
          is_active: true,
          is_verified: true, // Marquer comme vérifié car déjà dans la base
        });
      
      if (error) {
        console.error(`❌ Erreur pour le jeu ${gameId} (${gameName}):`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Jeu ${gameId} (${gameName}) : Lien migré avec succès`);
        successCount++;
      }
    }
    
    // 4. Résumé
    console.log('\n' + '='.repeat(50));
    console.log('📊 Résumé de la migration:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log(`   ⏭️  Ignorés: ${skippedCount}`);
    console.log(`   📦 Total: ${games.length}`);
    console.log('='.repeat(50));
    
    if (successCount > 0) {
      console.log('\n✅ Migration terminée avec succès !');
    } else {
      console.log('\n⚠️  Aucun lien n\'a été migré.');
    }
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateLockrLinks()
  .then(() => {
    console.log('\n🎉 Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });

