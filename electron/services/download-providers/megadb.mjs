import { DownloadProvider } from './base-provider.mjs';

export class MegaDBProvider extends DownloadProvider {
  constructor(hiddenWindow) {
    super('MegaDB', hiddenWindow);
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

        // Charger la page MegaDB/Mega
        this.log('Accès à la page…');
        await this.hiddenWindow.loadURL(url, { waitUntil: 'domcontentloaded' });

        // Attendre que la page soit chargée et que le reCAPTCHA soit résolu (si présent)
        await this.hiddenWindow.webContents.executeJavaScript(`
          new Promise(resolve => {
            const startTime = Date.now();
            
            const checkReady = () => {
              // Vérifier si le reCAPTCHA est résolu (si présent)
              const recaptcha = document.querySelector('.g-recaptcha-response');
              const recaptchaChecked = recaptcha && recaptcha.value && recaptcha.value.length > 0;
              
              // Vérifier si le bouton de téléchargement est disponible
              const downloadBtn = document.querySelector('a[href*="download"], button[class*="download"], .download-btn, .btn-download, a.btn.btn-primary, button[type="submit"], #downloadButton, .direct-download, [data-download], a[data-action="download"]');
              
              // Si le bouton est disponible et (pas de reCAPTCHA ou reCAPTCHA résolu), on peut continuer
              if (downloadBtn && (!recaptcha || recaptchaChecked)) {
                resolve();
                return;
              }
              
              // Sinon, attendre un peu et réessayer (max 3 secondes)
              if (Date.now() - startTime < 3000) {
                setTimeout(checkReady, 300);
              } else {
                resolve(); // Continuer même si le reCAPTCHA n'est pas résolu
              }
            };
            
            if (document.readyState === 'complete') {
              setTimeout(checkReady, 1500); // Attendre 1.5s pour les scripts initiaux
            } else {
              window.addEventListener('load', () => setTimeout(checkReady, 1500));
            }
          })
        `, true);

        this.log('Recherche du bouton de téléchargement…');

        // Chercher et cliquer sur le bouton de téléchargement
        const buttonFound = await this.hiddenWindow.webContents.executeJavaScript(`
          (function() {
            // Sélecteurs possibles pour MegaDB/Mega (prioriser "Free Download")
            const selectors = [
              'button:contains("Free Download")',
              'a:contains("Free Download")',
              'button[class*="download"]',
              'a[href*="download"]',
              '.download-btn',
              '.btn-download',
              'a.btn.btn-primary',
              'button[type="submit"]',
              '#downloadButton',
              '.direct-download',
              '[data-download]',
              'a[data-action="download"]'
            ];
            
            let downloadBtn = null;
            
            // Chercher d'abord par texte "Free Download" (le plus commun sur MegaDB)
            const allButtons = Array.from(document.querySelectorAll('a, button'));
            downloadBtn = allButtons.find(el => {
              const text = el.textContent.toLowerCase().trim();
              return text === 'free download' || text === 'télécharger gratuit' || text.includes('free download');
            });
            
            // Si pas trouvé, essayer les sélecteurs
            if (!downloadBtn) {
              for (const selector of selectors) {
                try {
                  downloadBtn = document.querySelector(selector);
                  if (downloadBtn) {
                    break;
                  }
                } catch (e) {
                  // Ignorer les sélecteurs invalides (comme :contains)
                }
              }
            }
            
            // Chercher aussi par texte générique
            if (!downloadBtn) {
              downloadBtn = allButtons.find(el => {
                const text = el.textContent.toLowerCase();
                return (text.includes('download') || text.includes('télécharger')) && 
                       !text.includes('premium') && 
                       !text.includes('vip');
              });
            }
            
            if (downloadBtn) {
              // Vérifier si le bouton est visible et cliquable
              const style = window.getComputedStyle(downloadBtn);
              if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                downloadBtn.click();
                return { found: true, href: downloadBtn.href || null };
              }
            }
            
            return { found: false };
          })()
        `, true);

        if (!buttonFound || !buttonFound.found) {
          await this.handleError('Bouton de téléchargement introuvable', true);
          return reject(new Error('[MegaDB] Bouton de téléchargement introuvable. Vérifiez le screenshot de debug.'));
        }

        this.log(`Bouton trouvé et cliqué: ${buttonFound.href || 'bouton cliqué'}`);
        this.log('Attente de la détection du téléchargement…');

        // Attendre que le téléchargement soit détecté (max 10 secondes)
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
          if (downloadDetected) {
            clearInterval(checkInterval);
            return;
          }

          if (Date.now() - startTime > 10000) {
            clearInterval(checkInterval);
            this.cleanup();
            reject(new Error('[MegaDB] Timeout: téléchargement non détecté'));
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
