const { MultiSiteScraper } = require('./multi-site-scraper');
const fs = require('fs');

/**
 * Scrappeur automatique qui met à jour games_updated.json en temps réel
 */
class AutoScrapeAndUpdate {
  constructor() {
    this.scraper = null;
    this.gamesData = null;
    this.otherLinksGames = [];
    this.stats = {
      processed: 0,
      updated: 0,
      notFound: 0,
      errors: 0,
      buzzLinks: 0,
      gofileLinks: 0
    };
    this.updatedGames = [];
  }

  /**
   * Charge et filtre les jeux
   */
  loadAndFilterGames() {
    console.log('📚 Chargement des jeux...');
    
    this.gamesData = JSON.parse(fs.readFileSync('games_updated.json', 'utf8'));
    
    // Filtrer les jeux "Liens non Buzz/Gofile"
    this.otherLinksGames = this.gamesData.games.filter(game => {
      const hasLinks = (game.downloadUrl && game.downloadUrl.trim() !== '') || 
                       (game.dl && game.dl.length > 0);
      if (!hasLinks) return false;
      
      const links = game.dl || [game.downloadUrl].filter(Boolean);
      return links.some(link => {
        const linkLower = link.toLowerCase();
        return !linkLower.includes('buzz') && 
               !linkLower.includes('gofile') &&
               linkLower.trim() !== '';
      });
    });

    console.log(`🎯 ${this.otherLinksGames.length} jeux à traiter`);
    return this.otherLinksGames.length;
  }

  /**
   * Initialise le scrappeur AtopGames uniquement
   */
  async initScraper() {
    console.log('🚀 Initialisation du scrappeur AtopGames...');
    
    this.scraper = new MultiSiteScraper();
    
    // Configuration AtopGames uniquement
    this.scraper.sites = [
      {
        name: 'AtopGames',
        baseUrl: 'https://atopgames.com',
        searchUrl: 'https://atopgames.com/?s=',
        selectors: {
          searchResults: '.post-title a, .entry-title a, h2 a, h3 a',
          downloadLinks: 'a[href*="buzzheavier"], a[href*="gofile"]',
          gameTitle: '.post-title, h1.entry-title, .entry-title',
          content: '.entry-content, .post-content, .content'
        },
        waitTime: 4000,
        preferBuzz: true
      }
    ];
    
    await this.scraper.init();
    console.log('✅ Scrappeur initialisé');
  }

  /**
   * Met à jour un jeu dans games_updated.json
   */
  updateGameInCatalog(game, newLinks) {
    try {
      // Créer une sauvegarde avant modification
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `games_updated.json.backup-auto-${timestamp}`;
      fs.copyFileSync('games_updated.json', backupFile);
      
      // Trouver le jeu dans le catalogue
      const gameIndex = this.gamesData.games.findIndex(g => g.id === game.id);
      if (gameIndex === -1) {
        console.log(`❌ Jeu non trouvé dans le catalogue: ${game.title || game.name}`);
        return false;
      }

      // Ajouter les nouveaux liens (privilégier Buzz)
      const buzzLinks = newLinks.filter(link => link.type === 'BUZZ');
      const gofileLinks = newLinks.filter(link => link.type === 'GOFILE');
      
      // Prendre le meilleur lien Buzz, sinon Gofile
      const bestLink = buzzLinks.length > 0 ? buzzLinks[0] : gofileLinks[0];
      
      if (bestLink) {
        // Remplacer les anciens liens par le nouveau
        this.gamesData.games[gameIndex].dl = [bestLink.url];
        
        // Mettre à jour le statut
        if (this.gamesData.games[gameIndex].status) {
          this.gamesData.games[gameIndex].status.provider = bestLink.type;
          this.gamesData.games[gameIndex].status.lastUpdated = new Date().toISOString();
          this.gamesData.games[gameIndex].status.source = 'atopgames-scraping';
        }

        // Sauvegarder immédiatement
        fs.writeFileSync('games_updated.json', JSON.stringify(this.gamesData, null, 2));
        
        console.log(`✅ Jeu mis à jour: ${game.title || game.name}`);
        console.log(`   Nouveau lien ${bestLink.type}: ${bestLink.url}`);
        
        // Enregistrer pour les stats
        this.updatedGames.push({
          name: game.title || game.name,
          oldLinks: game.dl || [],
          newLink: bestLink.url,
          type: bestLink.type
        });
        
        if (bestLink.type === 'BUZZ') this.stats.buzzLinks++;
        if (bestLink.type === 'GOFILE') this.stats.gofileLinks++;
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour de ${game.title || game.name}:`, error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Traite un jeu
   */
  async processGame(game, index, total) {
    const gameName = game.title || game.name;
    
    console.log(`\n📊 [${index + 1}/${total}] ${gameName}`);
    console.log(`📎 Liens actuels: ${game.dl ? game.dl.length : 0}`);
    
    if (game.dl && game.dl.length > 0) {
      game.dl.forEach((link, linkIndex) => {
        try {
          const domain = new URL(link).hostname;
          console.log(`  ${linkIndex + 1}. ${domain}`);
        } catch (e) {
          console.log(`  ${linkIndex + 1}. ${link.substring(0, 30)}...`);
        }
      });
    }

    try {
      // Rechercher sur AtopGames
      console.log(`🔍 Recherche sur AtopGames...`);
      const results = await this.scraper.searchGame(gameName);
      
      if (results.length > 0) {
        const atopResult = results.find(r => r.site === 'AtopGames');
        if (atopResult && atopResult.downloadLinks.length > 0) {
          console.log(`🎉 ${atopResult.downloadLinks.length} liens trouvés!`);
          
          atopResult.downloadLinks.forEach(link => {
            console.log(`  🔗 ${link.type}: ${link.url}`);
          });
          
          // Mettre à jour immédiatement
          const updated = this.updateGameInCatalog(game, atopResult.downloadLinks);
          if (updated) {
            this.stats.updated++;
            console.log(`💾 Catalogue mis à jour automatiquement`);
          }
        } else {
          console.log(`❌ Aucun lien Buzz/Gofile trouvé`);
          this.stats.notFound++;
        }
      } else {
        console.log(`😞 Jeu non trouvé sur AtopGames`);
        this.stats.notFound++;
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du traitement:`, error.message);
      this.stats.errors++;
    }
    
    this.stats.processed++;
  }

  /**
   * Lance le scraping automatique complet
   */
  async runAutoScraping(maxGames = null) {
    console.log('🤖 === SCRAPING AUTOMATIQUE AVEC MISE À JOUR ===\n');
    
    try {
      // 1. Charger les jeux
      const totalGames = this.loadAndFilterGames();
      if (totalGames === 0) {
        console.log('✅ Aucun jeu à traiter');
        return;
      }

      // 2. Limiter si demandé
      const gamesToProcess = maxGames ? 
        this.otherLinksGames.slice(0, maxGames) : 
        this.otherLinksGames;
      
      console.log(`🎯 Traitement de ${gamesToProcess.length} jeux`);
      if (maxGames && maxGames < totalGames) {
        console.log(`   (limité à ${maxGames} sur ${totalGames} total)`);
      }

      // 3. Initialiser le scrappeur
      await this.initScraper();

      // 4. Traiter chaque jeu
      for (let i = 0; i < gamesToProcess.length; i++) {
        const game = gamesToProcess[i];
        
        await this.processGame(game, i, gamesToProcess.length);
        
        // Pause entre les jeux (sauf le dernier)
        if (i < gamesToProcess.length - 1) {
          console.log(`⏳ Pause de 5 secondes...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // 5. Afficher les résultats finaux
      this.showFinalStats();

    } catch (error) {
      console.error('❌ Erreur fatale:', error);
    } finally {
      if (this.scraper) {
        await this.scraper.close();
        console.log('🔒 Navigateur fermé');
      }
    }
  }

  /**
   * Affiche les statistiques finales
   */
  showFinalStats() {
    console.log('\n🎉 === SCRAPING AUTOMATIQUE TERMINÉ ===');
    console.log(`📊 Statistiques:`);
    console.log(`  🎮 Jeux traités: ${this.stats.processed}`);
    console.log(`  ✅ Jeux mis à jour: ${this.stats.updated}`);
    console.log(`  ❌ Jeux non trouvés: ${this.stats.notFound}`);
    console.log(`  🚫 Erreurs: ${this.stats.errors}`);
    console.log(`  🟡 Liens Buzz ajoutés: ${this.stats.buzzLinks}`);
    console.log(`  🟢 Liens Gofile ajoutés: ${this.stats.gofileLinks}`);
    
    if (this.stats.processed > 0) {
      const successRate = Math.round((this.stats.updated / this.stats.processed) * 100);
      console.log(`  📈 Taux de succès: ${successRate}%`);
    }

    if (this.updatedGames.length > 0) {
      console.log(`\n📋 Jeux mis à jour:`);
      this.updatedGames.forEach((game, index) => {
        console.log(`  ${index + 1}. ${game.name}`);
        console.log(`     ${game.type}: ${game.newLink}`);
      });
    }

    console.log(`\n💾 Le fichier games_updated.json a été mis à jour automatiquement`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  const scraper = new AutoScrapeAndUpdate();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    // Mode test avec 5 jeux
    console.log('🧪 Mode test: 5 jeux seulement\n');
    await scraper.runAutoScraping(5);
  } else if (args.includes('--small')) {
    // Mode petit avec 20 jeux
    console.log('📦 Mode petit: 20 jeux\n');
    await scraper.runAutoScraping(20);
  } else if (args.includes('--full')) {
    // Mode complet - tous les jeux
    console.log('🚀 Mode complet: tous les jeux\n');
    await scraper.runAutoScraping();
  } else {
    // Mode par défaut avec 10 jeux
    console.log('💡 Options disponibles:');
    console.log('  --test  : Test avec 5 jeux');
    console.log('  --small : 20 jeux');
    console.log('  --full  : Tous les jeux (~200)');
    console.log('  défaut  : 10 jeux\n');
    
    await scraper.runAutoScraping(10);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AutoScrapeAndUpdate };