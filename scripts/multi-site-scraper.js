const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Scrappeur multi-sites pour trouver des liens Buzz/Gofile
 * Sites supportés: SteamRip, AtopGames
 */
class MultiSiteScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.errors = [];
    this.sites = [
      {
        name: 'SteamRip',
        baseUrl: 'https://steamrip.com',
        searchUrl: 'https://steamrip.com/?s=',
        selectors: {
          searchResults: 'article h2 a, article h3 a, .post h2 a, .post h3 a, .entry-title a',
          downloadLinks: 'a[href*="buzzheavier"], a[href*="gofile"]',
          gameTitle: '.post-title, h1.entry-title, .entry-title',
          content: '.entry-content, .post-content, .content'
        },
        waitTime: 8000 // Plus de temps pour SteamRip
      },
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
        waitTime: 3000,
        preferBuzz: true // Privilégier Buzz sur AtopGames
      }
    ];
  }

  async init() {
    console.log('🚀 Initialisation du scrappeur multi-sites...');
    this.browser = await puppeteer.launch({
      headless: false, // Mode visible pour debug
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Nettoie le nom du jeu pour la recherche
   */
  cleanGameName(gameName) {
    return gameName
      .replace(/[^\w\s]/g, ' ') // Remplace les caractères spéciaux par des espaces
      .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
      .trim()
      .toLowerCase();
  }

  /**
   * Recherche un jeu sur un site spécifique
   */
  async searchGameOnSite(site, gameName) {
    const page = await this.browser.newPage();
    const results = [];

    try {
      console.log(`🔍 Recherche "${gameName}" sur ${site.name}...`);
      
      // Configuration de la page
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      const cleanName = this.cleanGameName(gameName);
      const searchUrl = `${site.searchUrl}${encodeURIComponent(cleanName)}`;
      
      console.log(`📍 URL de recherche: ${searchUrl}`);
      
      // Aller à la page de recherche
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Attendre que les résultats se chargent (temps variable selon le site)
      const waitTime = site.waitTime || 3000;
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Récupérer les liens des résultats de recherche
      const searchResults = await page.evaluate((selectors) => {
        const links = document.querySelectorAll(selectors.searchResults);
        return Array.from(links).map(link => ({
          title: link.textContent.trim(),
          url: link.href
        })).slice(0, 3); // Limiter à 3 résultats pour éviter trop de requêtes
      }, site.selectors);

      console.log(`📋 ${searchResults.length} résultats trouvés sur ${site.name}`);

      // Parcourir chaque résultat pour chercher des liens Buzz/Gofile
      for (const result of searchResults) {
        try {
          console.log(`🔗 Analyse de: ${result.title}`);
          console.log(`📄 Page: ${result.url}`);
          
          // Aller sur la page du jeu
          await page.goto(result.url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

          // Chercher TOUS les liens Buzz/Gofile sur la page
          const downloadLinks = await page.evaluate((siteName, preferBuzz) => {
            const allLinks = document.querySelectorAll('a[href]');
            const buzzGofileLinks = [];
            
            Array.from(allLinks).forEach(link => {
              const href = link.href;
              const text = link.textContent.trim();
              
              // Vérifier si c'est un lien Buzz ou Gofile
              if (href.includes('buzzheavier.com') || 
                  href.includes('gofile.io') || 
                  href.includes('gofile.me')) {
                
                let type = 'UNKNOWN';
                let priority = 0;
                
                if (href.includes('buzzheavier') || href.includes('buzz')) {
                  type = 'BUZZ';
                  // Si le site préfère Buzz, donner plus de priorité
                  priority = preferBuzz ? 10 : 5;
                } else if (href.includes('gofile')) {
                  type = 'GOFILE';
                  // Si le site préfère Buzz, Gofile a moins de priorité
                  priority = preferBuzz ? 3 : 8;
                }
                
                buzzGofileLinks.push({
                  text: text || 'Lien de téléchargement',
                  url: href,
                  type: type,
                  priority: priority
                });
              }
            });
            
            // Supprimer les doublons
            const uniqueLinks = [];
            const seenUrls = new Set();
            
            buzzGofileLinks.forEach(link => {
              if (!seenUrls.has(link.url)) {
                seenUrls.add(link.url);
                uniqueLinks.push(link);
              }
            });
            
            // Trier par priorité (plus haute en premier)
            uniqueLinks.sort((a, b) => b.priority - a.priority);
            
            return uniqueLinks;
          }, site.name, site.preferBuzz || false);

          if (downloadLinks.length > 0) {
            console.log(`✅ ${downloadLinks.length} liens Buzz/Gofile trouvés!`);
            downloadLinks.forEach((link, index) => {
              console.log(`  ${index + 1}. ${link.type}: ${link.url}`);
            });
            
            results.push({
              site: site.name,
              gameTitle: result.title,
              pageUrl: result.url,
              downloadLinks: downloadLinks
            });
            
            // Si on trouve des liens, pas besoin de chercher dans les autres résultats
            break;
          } else {
            console.log(`❌ Aucun lien Buzz/Gofile trouvé sur cette page`);
          }

        } catch (error) {
          console.error(`❌ Erreur lors de l'analyse de ${result.url}:`, error.message);
        }
      }

    } catch (error) {
      console.error(`❌ Erreur lors de la recherche sur ${site.name}:`, error.message);
      this.errors.push({
        site: site.name,
        gameName: gameName,
        error: error.message
      });
    } finally {
      await page.close();
    }

    return results;
  }

  /**
   * Recherche un jeu sur tous les sites
   */
  async searchGame(gameName) {
    console.log(`\n🎮 === RECHERCHE: ${gameName} ===`);
    const allResults = [];

    for (const site of this.sites) {
      const siteResults = await this.searchGameOnSite(site, gameName);
      allResults.push(...siteResults);
      
      // Pause entre les sites pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (allResults.length > 0) {
      console.log(`🎉 ${allResults.length} résultats trouvés pour "${gameName}"`);
      this.results.push({
        originalGame: gameName,
        foundResults: allResults
      });
    } else {
      console.log(`😞 Aucun résultat trouvé pour "${gameName}"`);
    }

    return allResults;
  }

  /**
   * Traite une liste de jeux
   */
  async processGames(games) {
    console.log(`🎯 Traitement de ${games.length} jeux...`);
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`\n📊 Progression: ${i + 1}/${games.length}`);
      
      await this.searchGame(game.title || game.name);
      
      // Pause entre les jeux
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  /**
   * Sauvegarde les résultats
   */
  saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Sauvegarder les résultats
    const resultsFile = `scraping-results-${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalGamesProcessed: this.results.length,
      totalLinksFound: this.results.reduce((acc, r) => acc + r.foundResults.length, 0),
      results: this.results,
      errors: this.errors
    }, null, 2));

    console.log(`💾 Résultats sauvegardés dans: ${resultsFile}`);

    // Créer un résumé
    const summary = {
      totalGames: this.results.length,
      gamesWithLinks: this.results.filter(r => r.foundResults.length > 0).length,
      totalLinks: this.results.reduce((acc, r) => acc + r.foundResults.length, 0),
      buzzLinks: 0,
      gofileLinks: 0,
      errors: this.errors.length
    };

    this.results.forEach(result => {
      result.foundResults.forEach(found => {
        found.downloadLinks.forEach(link => {
          if (link.type === 'BUZZ') summary.buzzLinks++;
          if (link.type === 'GOFILE') summary.gofileLinks++;
        });
      });
    });

    console.log('\n📊 === RÉSUMÉ ===');
    console.log(`🎮 Jeux traités: ${summary.totalGames}`);
    console.log(`✅ Jeux avec liens: ${summary.gamesWithLinks}`);
    console.log(`🔗 Total liens: ${summary.totalLinks}`);
    console.log(`🟡 Liens Buzz: ${summary.buzzLinks}`);
    console.log(`🟢 Liens Gofile: ${summary.gofileLinks}`);
    console.log(`❌ Erreurs: ${summary.errors}`);

    return resultsFile;
  }
}

/**
 * Fonction principale
 */
async function main() {
  const scraper = new MultiSiteScraper();
  
  try {
    // Lire les jeux depuis games_updated.json
    const gamesData = JSON.parse(fs.readFileSync('games_updated.json', 'utf8'));
    
    // Filtrer les jeux avec des liens non-Buzz/Gofile
    const nonBuzzGofileGames = gamesData.games.filter(game => {
      if (!game.dl || game.dl.length === 0) return false;
      
      return game.dl.some(link => {
        const linkLower = link.toLowerCase();
        return !linkLower.includes('buzz') && !linkLower.includes('gofile');
      });
    });

    console.log(`🎯 ${nonBuzzGofileGames.length} jeux avec liens non-Buzz/Gofile trouvés`);
    
    if (nonBuzzGofileGames.length === 0) {
      console.log('❌ Aucun jeu à traiter');
      return;
    }

    // Limiter à 10 jeux pour le test
    const gamesToProcess = nonBuzzGofileGames.slice(0, 10);
    console.log(`🧪 Mode test: traitement de ${gamesToProcess.length} jeux`);

    await scraper.init();
    await scraper.processGames(gamesToProcess);
    
    const resultsFile = scraper.saveResults();
    console.log(`\n🎉 Scraping terminé! Résultats dans: ${resultsFile}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  } finally {
    await scraper.close();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MultiSiteScraper };