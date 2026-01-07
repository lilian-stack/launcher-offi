/**
 * Téléchargement universel - Route vers le bon provider selon l'URL
 */

import { session } from 'electron'
import { detectProvider, convertPixelDrain } from '../utils/download-helpers.js'
import { setDownloadDestinationPath } from './state.js'
import { getHiddenWindow } from './window-manager.js'

// Import lazy des providers
let providers = null
async function loadProviders() {
  if (!providers) {
    const { GoFileProvider, BuzzHeavierProvider } = await import('./download-providers/index.js')
    // TODO: Ajouter les autres providers après extraction
    // const { VikingFileProvider } = await import('./download-providers/vikingfile.js')
    // const { MegaDBProvider } = await import('./download-providers/megadb.js')
    // const { KoysoProvider } = await import('./download-providers/koyso.js')
    
    providers = {
      gofile: GoFileProvider,
      buzzheavier: BuzzHeavierProvider,
      // vikingfile: VikingFileProvider,
      // megadb: MegaDBProvider,
      // koyso: KoysoProvider,
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

      case 'gofile': {
        const providers = await loadProviders()
        const hiddenWindow = getHiddenWindow()
        if (!hiddenWindow) {
          throw new Error('Hidden window non disponible')
        }
        const provider = new providers.gofile(hiddenWindow)
        return await provider.download(url, destinationPath)
      }

      case 'buzzheavier': {
        const providers = await loadProviders()
        const hiddenWindow = getHiddenWindow()
        if (!hiddenWindow) {
          throw new Error('Hidden window non disponible')
        }
        const provider = new providers.buzzheavier(hiddenWindow)
        return await provider.download(url, destinationPath)
      }

      default:
        throw new Error('Provider non encore extrait: ' + providerName)
    }
  } catch (error) {
    errorLog('[Downloader] Erreur lors du téléchargement:', error)
    throw error
  }
}
