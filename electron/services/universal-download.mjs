/**
 * Téléchargement universel - Route vers le bon provider selon l'URL
 */

import electron from 'electron';
const { session } = electron
import { detectProvider, convertPixelDrain } from '../utils/download-helpers.mjs'
import { setDownloadDestinationPath } from './state.mjs'
import { getHiddenWindow } from './window-manager.mjs'

// Import lazy des providers
let providers = null
async function loadProviders() {
  if (!providers) {
    const { 
      GoFileProvider, 
      BuzzHeavierProvider, 
      VikingFileProvider, 
      MegaDBProvider, 
      KoysoProvider 
    } = await import('./download-providers/index.mjs')
    
    providers = {
      gofile: GoFileProvider,
      buzzheavier: BuzzHeavierProvider,
      vikingfile: VikingFileProvider,
      megadb: MegaDBProvider,
      koyso: KoysoProvider,
    }
  }
  return providers
}

/**
 * Télécharge depuis n'importe quel provider supporté
 */
export async function universalDownload(url, destinationPath = null, log = () => {}, errorLog = () => {}) {
  log('[Downloader] URL reçue:', url)

  const providerName = detectProvider(url)
  log('[Downloader] Provider détecté:', providerName)

  if (providerName === 'unknown') {
    throw new Error('Provider non supporté: ' + url)
  }

  try {
    switch (providerName) {
      case 'pixeldrain': {
        const directURL = await convertPixelDrain(url)
        log('[Downloader] Lien final à télécharger:', directURL)
        setDownloadDestinationPath(destinationPath || null)
        session.defaultSession.downloadURL(directURL)
        return { success: true, downloadUrl: directURL, provider: providerName }
      }

      default: {
        const providers = await loadProviders()
        const ProviderClass = providers[providerName]
        
        if (!ProviderClass) {
          throw new Error('Provider non implémenté: ' + providerName)
        }
        
        const hiddenWindow = getHiddenWindow()
        if (!hiddenWindow) {
          throw new Error('Hidden window non disponible')
        }
        
        const provider = new ProviderClass(hiddenWindow)
        return await provider.download(url, destinationPath)
      }
    }
  } catch (error) {
    errorLog('[Downloader] Erreur lors du téléchargement:', error)
    throw error
  }
}
