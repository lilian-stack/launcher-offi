import { DownloadProvider } from './base-provider.mjs';

export class VikingFileProvider extends DownloadProvider {
  constructor(hiddenWindow) {
    super('VikingFile', hiddenWindow);
  }

  async download(url, destinationPath) {
    this.log(`Lancement avec fenêtre cachée Electron pour télécharger…`);

    return new Promise(async (resolve, reject) => {
      try {
        await this.setupDownloadBehavior(destinationPath);

        // Configurer le contexte de téléchargement
        let downloadDetected = false;
        this.hiddenWindow._pendingDownload = {
          active: true,
          destinationPath: this.destinationPath,
          resolve: (res) => {
            downloadDetected = true;
            this.cleanup();
            this.log('Téléchargement détecté et lancé');
            resolve(res);
          },
          reject: (err) => {
            this.cleanup();
            reject(err);
          }
        };

        // Charger la page VikingFile
        this.log('Accès à la page…');
        await this.hiddenWindow.loadURL(url, { waitUntil: 'networkidle' });

        // Attendre que la page soit complètement chargée (plus longtemps pour les scripts/pubs)
        await this.hiddenWindow.webContents.executeJavaScript(`
          new Promise(resolve => {
            if (document.readyState === 'complete') {
              setTimeout(resolve, 5000); // Attendre 5s supplémentaires pour les scripts
            } else {
              window.addEventListener('load', () => setTimeout(resolve, 5000));
            }
          })
        `, true);

        // Attendre encore un peu pour que les scripts se chargent
        await new Promise(resolve => setTimeout(resolve, 10000));

        this.log('Recherche du bouton de téléchargement…');

        // Chercher et cliquer sur le bouton de téléchargement
        const buttonFound = await this.hiddenWindow.webContents.executeJavaScript(`
          (function() {
            // Sélecteurs spécifiques à VikingFile
            const selectors = [
              'a.btn-download',
              'a[download]',
              '#direct_link',
              'a[href*=".zip"]',
              'a[href*=".rar"]',
              'a[href*=".7z"]',
              'button.download',
              '.download-button',
              'a[href*="download"]',
              'button[class*="download"]',
              '[class*="download"]',
              '[id*="download"]',
              'a.btn.btn-primary',
              'button[type="submit"]',
              '#downloadButton',
              '.direct-download'
            ];
            
            for (const selector of selectors) {
              try {
                const element = document.querySelector(selector);
                if (element && (element.href || element.onclick || element.tagName === 'BUTTON' || element.tagName === 'A')) {
                  element.click();
                  return { found: true, selector: selector, href: element.href || 'N/A' };
                }
              } catch (e) {}
            }
            
            // Chercher les boutons avec le texte "Download" ou "Télécharger"
            const buttons = Array.from(document.querySelectorAll('button, a'));
            for (const button of buttons) {
              const text = (button.textContent || button.innerText || '').toLowerCase();
              if (text.includes('download') || text.includes('télécharger') || text.includes('télécharg') || text.includes('free download')) {
                button.click();
                return { found: true, type: 'text-match', text: text.substring(0, 50) };
              }
            }
            
            // Si aucun bouton trouvé, chercher tous les liens et cliquer sur celui qui contient un fichier
            const links = Array.from(document.querySelectorAll('a[href]'));
            for (const link of links) {
              const href = link.href.toLowerCase();
              if (href.includes('.zip') || href.includes('.rar') || href.includes('.7z') || href.includes('download')) {
                link.click();
                return { found: true, href: link.href };
              }
            }
            
            return { found: false };
          })()
        `, true);

        if (!buttonFound || !buttonFound.found) {
          await this.handleError('Bouton de téléchargement introuvable', true);
          return reject(new Error('[VikingFile] Bouton de téléchargement introuvable. Vérifiez le screenshot de debug.'));
        }

        this.log(`Bouton trouvé et cliqué: ${buttonFound.selector || buttonFound.href}`);
        this.log('Attente de la détection du téléchargement…');

        // Attendre que le téléchargement soit détecté (max 20 secondes pour VikingFile)
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (downloadDetected) {
            clearInterval(checkInterval);
            return;
          }

          if (Date.now() - startTime > 20000) {
            clearInterval(checkInterval);
            this.cleanup();
            reject(new Error('[VikingFile] Timeout: téléchargement non détecté'));
          }
        }, 500);

      } catch (error) {
        this.cleanup();
        this.errorLog('Erreur lors du téléchargement:', error);
        reject(error);
      }
    });
  }
}
