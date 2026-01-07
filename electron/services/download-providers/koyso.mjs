import { DownloadProvider } from './base-provider.mjs';

export class KoysoProvider extends DownloadProvider {
  constructor(hiddenWindow) {
    super('Koyso', hiddenWindow);
  }

  async download(url, destinationPath) {
    this.log(`🚀 Lancement avec fenêtre cachée Electron pour télécharger…`);
    this.log(`URL: ${url}`);

    return new Promise(async (resolve, reject) => {
      try {
        await this.setupDownloadBehavior(destinationPath);

        // 🛡️ Masquer les traces d'automatisation (anti-bot)
        // Définir un user-agent réaliste
        await this.hiddenWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Masquer navigator.webdriver et autres propriétés détectables via CDP
        await this.hiddenWindow.webContents.executeJavaScript(`
          // Masquer les traces d'automatisation
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
          });
          
          // Masquer chrome.runtime
          if (window.chrome && window.chrome.runtime) {
            Object.defineProperty(window.chrome, 'runtime', {
              get: () => undefined
            });
          }
          
          // Ajouter des propriétés pour simuler un navigateur réel
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
          });
          
          Object.defineProperty(navigator, 'languages', {
            get: () => ['fr-FR', 'fr', 'en-US', 'en']
          });
        `, true);
        
        this.log('🛡️ Protection anti-bot activée (masquage des traces d\'automatisation)');

        // Configurer le contexte de téléchargement
        let downloadDetected = false;
        this.hiddenWindow._pendingDownload = {
          active: true,
          destinationPath: this.destinationPath,
          resolve: (res) => {
            downloadDetected = true;
            
            // Le téléchargement sera géré par l'événement will-download
            // Fermer la fenêtre après un délai
            setTimeout(() => {
              this.cleanup();
            }, 2000);

            this.log('Téléchargement détecté et lancé');
            resolve(res);
          },
          reject: (err) => {
            this.cleanup();
            reject(err);
          }
        };

        // Charger la page Koyso
        this.log('📄 Chargement de la page…');
        await this.hiddenWindow.loadURL(url, { waitUntil: 'networkidle' });

        // Attendre que la page soit complètement chargée avec délai aléatoire (simulation humaine)
        const randomDelay = 3000 + Math.random() * 3000; // Entre 3 et 6 secondes
        this.log(`⏳ Attente du chargement complet (${Math.round(randomDelay/1000)}s, délai aléatoire)…`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        // Simuler des mouvements de souris pour paraître humain
        try {
          await this.hiddenWindow.webContents.executeJavaScript(`
            // Simuler un mouvement de souris
            const event = new MouseEvent('mousemove', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: 100 + Math.random() * 200,
              clientY: 100 + Math.random() * 200
            });
            document.dispatchEvent(event);
          `, true);
          this.log('🖱️ Mouvement de souris simulé');
        } catch (e) {
          // Ignorer les erreurs
        }

        this.log('🖱️ Tentative d\'appel direct de la fonction download()…');

        // Essayer d'abord d'appeler directement la fonction download() de la page
        const directCall = await this.hiddenWindow.webContents.executeJavaScript(`
          (function() {
            // Appel direct de la fonction download() si elle existe
            if (typeof download === 'function') {
              try {
                download();
                return { success: true, method: 'direct_function_call' };
              } catch (e) {
                return { success: false, error: e.message };
              }
            }
            
            // Si la fonction n'existe pas, chercher le bouton et cliquer dessus
            // Chercher le bouton "Download" ou "Télécharger"
            const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'));
            
            for (const btn of buttons) {
              const text = btn.textContent.trim().toLowerCase();
              const isVisible = btn.offsetParent !== null;
              
              // Koyso a un bouton "Download" ou "Télécharger" qui doit être visible
              if ((text === 'download' || text === 'télécharger' || text.includes('download')) && isVisible) {
                btn.click();
                return { success: true, text: btn.textContent.trim(), method: 'button_click' };
              }
            }
            
            // Chercher aussi dans div.download_div avec class="button"
            const downloadDiv = document.querySelector('div.download_div');
            if (downloadDiv) {
              const divButton = downloadDiv.querySelector('button.button, button[onclick*="download"]');
              if (divButton && divButton.offsetParent !== null) {
                divButton.click();
                return { success: true, text: divButton.textContent.trim(), method: 'download_div_click' };
              }
            }
            
            // Si pas trouvé, essayer avec un sélecteur CSS direct
            const downloadBtn = document.querySelector('button:not([style*="display: none"])');
            if (downloadBtn && downloadBtn.textContent.toLowerCase().includes('download') && downloadBtn.offsetParent !== null) {
              downloadBtn.click();
              return { success: true, text: downloadBtn.textContent.trim(), method: 'css_selector_click' };
            }
            
            return { success: false, method: 'none' };
          })()
        `, true);

        if (!directCall || !directCall.success) {
          await this.handleError(`Impossible de déclencher le téléchargement. Méthode: ${directCall?.method || 'unknown'}`, true);
          return reject(new Error(`[Koyso] ❌ Impossible de déclencher le téléchargement. Méthode: ${directCall?.method || 'unknown'}. Vérifiez le screenshot de debug.`));
        }

        this.log(`✅ Téléchargement déclenché via: ${directCall.method}${directCall.text ? ` (bouton: "${directCall.text}")` : ''}`);
        
        // Délai aléatoire avant de vérifier le téléchargement (simulation humaine)
        const randomWait = 8000 + Math.random() * 4000; // Entre 8 et 12 secondes
        this.log(`⏳ Attente du démarrage du téléchargement (${Math.round(randomWait/1000)}s, délai aléatoire)…`);
        await new Promise(resolve => setTimeout(resolve, randomWait));

        this.log('Maintien de la fenêtre ouverte (délai supplémentaire)…');
        // Ne pas fermer tout de suite, laisser le temps au téléchargement de démarrer
        const additionalWait = 3000 + Math.random() * 2000; // Entre 3 et 5 secondes
        await new Promise(resolve => setTimeout(resolve, additionalWait));

        this.log('✅ Processus terminé, le fichier sera géré par will-download');
        
        // Résoudre la promesse - le téléchargement est lancé
        this.hiddenWindow._pendingDownload = null;
        this.detachDebugger();
        resolve({ success: true, downloadUrl: url, provider: 'koyso' });

      } catch (error) {
        this.cleanup();
        this.errorLog('Erreur lors du téléchargement:', error);
        reject(error);
      }
    });
  }
}
