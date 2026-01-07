const fs = require('fs');

/**
 * Synchronise les jeux mis à jour depuis games_updated.json vers Supabase
 */
class SupabaseSyncService {
  constructor() {
    this.supabaseUrl = 'https://fpxcefuqwvwdduzkmkrj.supabase.co';
    // Utiliser la SERVICE_KEY pour les mises à jour
    this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA';
    this.stats = {
      processed: 0,
      updated: 0,
      errors: 0,
      buzzUpdates: 0,
      gofileUpdates: 0
    };
  }

  /**
   * Charge les jeux depuis games_updated.json
   */
  loadGamesFromFile() {
    try {
      console.log('📚 Chargement des jeux depuis games_updated.json...');
      const data = JSON.parse(fs.readFileSync('games_updated.json', 'utf8'));
      const games = data.games || [];
      console.log(`✅ ${games.length} jeux chargés`);
      return games;
    } catch (error) {
      console.error('❌ Erreur lors du chargement:', error.message);
      return [];
    }
  }

  /**
   * Trouve les jeux récemment mis à jour (avec source atopgames-scraping)
   */
  findRecentlyUpdatedGames(games) {
    const recentlyUpdated = games.filter(game => {
      return game.status && 
             game.status.source === 'atopgames-scraping' &&
             game.status.lastUpdated;
    });

    console.log(`🔍 ${recentlyUpdated.length} jeux récemment mis à jour trouvés`);
    
    recentlyUpdated.forEach(game => {
      const provider = game.status.provider || 'UNKNOWN';
      const link = game.dl && game.dl.length > 0 ? game.dl[0] : 'Aucun lien';
      console.log(`  📦 ${game.name || game.title} - ${provider}: ${link.substring(0, 50)}...`);
    });

    return recentlyUpdated;
  }

  /**
   * Met à jour un jeu dans Supabase
   */
  async updateGameInSupabase(game) {
    try {
      const gameName = game.name || game.title;
      console.log(`🔄 Mise à jour de "${gameName}" dans Supabase...`);

      // Préparer les données à mettre à jour (utiliser download_url au lieu de dl)
      const newDownloadUrl = game.dl && game.dl.length > 0 ? game.dl[0] : null;
      
      if (!newDownloadUrl) {
        console.log(`⚠️ Aucun lien de téléchargement trouvé pour "${gameName}"`);
        return false;
      }

      const updateData = {
        download_url: newDownloadUrl
      };

      // Chercher le jeu dans Supabase par nom
      const searchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/games?name=eq.${encodeURIComponent(gameName)}`,
        {
          method: 'GET',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Erreur de recherche: ${searchResponse.status}`);
      }

      const existingGames = await searchResponse.json();
      
      if (existingGames.length === 0) {
        console.log(`⚠️ Jeu "${gameName}" non trouvé dans Supabase`);
        return false;
      }

      const existingGame = existingGames[0];
      console.log(`✅ Jeu trouvé dans Supabase (ID: ${existingGame.id})`);

      // Mettre à jour le jeu
      const updateResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/games?id=eq.${existingGame.id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Erreur de mise à jour: ${updateResponse.status}`);
      }

      console.log(`✅ "${gameName}" mis à jour dans Supabase`);
      
      // Compter les stats
      if (game.status.provider === 'BUZZ') {
        this.stats.buzzUpdates++;
      } else if (game.status.provider === 'GOFILE') {
        this.stats.gofileUpdates++;
      }
      
      this.stats.updated++;
      return true;

    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour de "${game.name || game.title}":`, error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Synchronise tous les jeux récemment mis à jour
   */
  async syncRecentUpdates() {
    console.log('🚀 === SYNCHRONISATION SUPABASE ===\n');

    try {
      // 1. Charger les jeux
      const games = this.loadGamesFromFile();
      if (games.length === 0) {
        console.log('❌ Aucun jeu à traiter');
        return;
      }

      // 2. Trouver les jeux récemment mis à jour
      const recentlyUpdated = this.findRecentlyUpdatedGames(games);
      if (recentlyUpdated.length === 0) {
        console.log('✅ Aucun jeu récemment mis à jour à synchroniser');
        return;
      }

      // 3. Synchroniser chaque jeu
      console.log(`\n🔄 Synchronisation de ${recentlyUpdated.length} jeux...\n`);
      
      for (let i = 0; i < recentlyUpdated.length; i++) {
        const game = recentlyUpdated[i];
        this.stats.processed++;
        
        console.log(`📊 [${i + 1}/${recentlyUpdated.length}] Traitement en cours...`);
        await this.updateGameInSupabase(game);
        
        // Pause entre les requêtes
        if (i < recentlyUpdated.length - 1) {
          console.log('⏳ Pause de 1 seconde...\n');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 4. Afficher les résultats
      this.showResults();

    } catch (error) {
      console.error('❌ Erreur fatale:', error);
    }
  }

  /**
   * Synchronise tous les jeux (pas seulement les récents)
   */
  async syncAllGames() {
    console.log('🚀 === SYNCHRONISATION COMPLÈTE SUPABASE ===\n');

    try {
      // 1. Charger les jeux
      const games = this.loadGamesFromFile();
      if (games.length === 0) {
        console.log('❌ Aucun jeu à traiter');
        return;
      }

      // 2. Synchroniser tous les jeux
      console.log(`\n🔄 Synchronisation de ${games.length} jeux...\n`);
      
      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        this.stats.processed++;
        
        console.log(`📊 [${i + 1}/${games.length}] ${game.name || game.title}`);
        await this.updateGameInSupabase(game);
        
        // Pause entre les requêtes (plus courte pour éviter que ça prenne trop de temps)
        if (i < games.length - 1 && i % 10 === 9) {
          console.log('⏳ Pause de 2 secondes...\n');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // 3. Afficher les résultats
      this.showResults();

    } catch (error) {
      console.error('❌ Erreur fatale:', error);
    }
  }

  /**
   * Affiche les résultats de la synchronisation
   */
  showResults() {
    console.log('\n🎉 === SYNCHRONISATION TERMINÉE ===');
    console.log(`📊 Statistiques:`);
    console.log(`  🎮 Jeux traités: ${this.stats.processed}`);
    console.log(`  ✅ Jeux mis à jour: ${this.stats.updated}`);
    console.log(`  ❌ Erreurs: ${this.stats.errors}`);
    console.log(`  🟡 Mises à jour Buzz: ${this.stats.buzzUpdates}`);
    console.log(`  🟢 Mises à jour Gofile: ${this.stats.gofileUpdates}`);
    
    if (this.stats.processed > 0) {
      const successRate = Math.round((this.stats.updated / this.stats.processed) * 100);
      console.log(`  📈 Taux de succès: ${successRate}%`);
    }

    console.log(`\n💾 Les changements sont maintenant visibles dans le panel admin!`);
    console.log(`🔗 Panel admin: https://supabase.com/dashboard/project/fpxcefuqwvwdduzkmkrj/editor/17487`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  const syncService = new SupabaseSyncService();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--all')) {
    // Synchroniser tous les jeux
    console.log('🌍 Mode complet: synchronisation de tous les jeux\n');
    await syncService.syncAllGames();
  } else {
    // Mode par défaut: seulement les jeux récemment mis à jour
    console.log('🎯 Mode récent: synchronisation des jeux récemment mis à jour\n');
    await syncService.syncRecentUpdates();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SupabaseSyncService };