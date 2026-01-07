/**
 * Classe de base pour les providers de téléchargement
 * Élimine la duplication de code entre les différents providers
 */

export class DownloadProvider {
  constructor(name, hiddenWindow) {
    this.name = name
    this.hiddenWindow = hiddenWindow
    this.debuggerAttached = false
  }

  /**
   * Attache le debugger CDP si nécessaire
   */
  async attachDebugger() {
    if (!this.hiddenWindow || this.hiddenWindow.isDestroyed()) {
      throw new Error(`${this.name}: Hidden window non disponible`)
    }

    if (!this.hiddenWindow.webContents.debugger.isAttached()) {
      this.hiddenWindow.webContents.debugger.attach('1.3')
      this.debuggerAttached = true
      return true
    }
    return false
  }

  /**
   * Détache le debugger CDP
   */
  detachDebugger() {
    try {
      if (this.hiddenWindow && !this.hiddenWindow.isDestroyed() && this.hiddenWindow.webContents.debugger.isAttached()) {
        this.hiddenWindow.webContents.debugger.detach()
        this.debuggerAttached = false
      }
    } catch (e) {
      // Ignorer les erreurs de détachement
    }
  }

  /**
   * Configure le comportement de téléchargement via CDP
   */
  async setupDownloadBehavior(downloadPath) {
    try {
      await this.attachDebugger()
      await this.hiddenWindow.webContents.debugger.sendCommand('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      })
      return true
    } catch (cdpError) {
      this.detachDebugger()
      throw cdpError
    }
  }

  /**
   * Trouve le bouton de téléchargement (à override dans les sous-classes)
   */
  async findDownloadButton() {
    throw new Error('findDownloadButton() doit être implémenté dans la sous-classe')
  }

  /**
   * Méthode principale de téléchargement (template method)
   */
  async download(url, destinationPath) {
    throw new Error('download() doit être implémenté dans la sous-classe')
  }

  /**
   * Helper pour créer le contexte de téléchargement
   */
  createDownloadContext(destinationPath, resolve, reject) {
    return {
      active: true,
      destinationPath: destinationPath,
      resolve: (res) => {
        this.detachDebugger()
        resolve(res)
      },
      reject: (err) => {
        this.detachDebugger()
        reject(err)
      }
    }
  }

  /**
   * Helper pour chercher un bouton avec plusieurs sélecteurs
   */
  async findButtonWithSelectors(selectors, textMatches = []) {
    const jsCode = `
      (function() {
        const selectors = ${JSON.stringify(selectors)};
        const textMatches = ${JSON.stringify(textMatches)};
        
        // Essayer les sélecteurs CSS
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element && (element.href || element.onclick || element.tagName === 'BUTTON' || element.tagName === 'A')) {
              return { found: true, selector: selector, href: element.href || 'N/A' };
            }
          } catch (e) {}
        }
        
        // Chercher par texte
        if (textMatches.length > 0) {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          for (const button of buttons) {
            const text = (button.textContent || button.innerText || '').toLowerCase();
            for (const match of textMatches) {
              if (text.includes(match.toLowerCase())) {
                return { found: true, type: 'text-match', text: text.substring(0, 50) };
              }
            }
          }
        }
        
        return { found: false };
      })()
    `
    
    return await this.hiddenWindow.webContents.executeJavaScript(jsCode, true)
  }
}
