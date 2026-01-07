/**
 * Provider BuzzHeavier pour téléchargement
 * Détecte automatiquement les liens directs vs pages nécessitant un clic
 */

import electron from 'electron';
const { BaseProvider } from './base-provider.mjs'
import { app, session } = electron
import path from 'node:path'
import fs from 'node:fs'
import { getActiveDownload, setDownloadDestinationPath } from '../state.mjs'
import { TIMEOUTS } from '../../utils/constants.mjs'

// Import lazy pour éviter les dépendances circulaires
let confirmDownloadToRedirect = null
export function injectConfirmDownloadToRedirect(fn) {
  confirmDownloadToRedirect = fn
}

export class BuzzHeavierProvider extends BaseProvider {
  constructor(hiddenWindow) {
    super('BuzzHeavier', hiddenWindow)
  }

  /**
   * Détecte si c'est un lien direct ou une page nécessitant un clic
   */
  isDirectLink(url) {
    return url.includes('/download/') || 
           url.includes('dlproxy') || 
           url.includes('.zip') || 
           url.includes('.rar') ||
           url.includes('.7z') ||
           url.includes('solaris.dlproxy.uk') ||
           url.includes('cdn') ||
           url.includes('direct')
  }

  /**
   * Télécharge depuis BuzzHeavier
   */
  async download(url, destinationPath = null) {
    // Détection automatique : lien direct ou page BuzzHeavier
    if (this.isDirectLink(url)) {
      return await this.downloadDirect(url, destinationPath)
    }
    
    // Page BuzzHeavier nécessitant un clic
    return await this.downloadWithClick(url, destinationPath)
  }

  /**
   * Télécharge un lien direct
   */
  async downloadDirect(url, destinationPath) {
    if (!this.hiddenWindow || this.hiddenWindow.isDestroyed()) {
      throw new Error('Hidden window non disponible')
    }

    const absoluteDestFolder = destinationPath || path.join(app.getPath('downloads'), 'Actoris Games')
    
    if (!fs.existsSync(absoluteDestFolder)) {
      fs.mkdirSync(absoluteDestFolder, { recursive: true })
    }
    
    const urlPath = new URL(url).pathname
    const fileName = path.basename(urlPath) || 'download.zip'
    const filePath = path.join(absoluteDestFolder, fileName)
    
    setDownloadDestinationPath(destinationPath || null)
    this.hiddenWindow.webContents.downloadURL(url)
    
    await new Promise(resolve => setTimeout(resolve, TIMEOUTS.DOWNLOAD_CHECK))
    
    return { success: true, method: 'direct_download', filePath }
  }

  /**
   * Télécharge depuis une page BuzzHeavier nécessitant un clic
   */
  async downloadWithClick(url, destinationPath) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.hiddenWindow || this.hiddenWindow.isDestroyed()) {
          throw new Error('Hidden window non disponible')
        }

        const destFolder = destinationPath || app.getPath('downloads')
        const absoluteDestFolder = path.resolve(destFolder)

        if (!fs.existsSync(absoluteDestFolder)) {
          fs.mkdirSync(absoluteDestFolder, { recursive: true })
        }

        // Configurer le comportement de téléchargement
        try {
          await this.setupDownloadBehavior(absoluteDestFolder)
        } catch (cdpError) {
          // Continuer même si CDP échoue
        }

        // Créer le contexte de téléchargement
        let downloadDetected = false
        this.hiddenWindow._pendingDownload = this.createDownloadContext(
          absoluteDestFolder,
          (res) => {
            downloadDetected = true
            this.hiddenWindow._pendingDownload = null
            this.detachDebugger()
            resolve(res)
          },
          (err) => {
            this.hiddenWindow._pendingDownload = null
            this.detachDebugger()
            reject(err)
          }
        )

        // Charger la page
        await this.hiddenWindow.loadURL(url, { waitUntil: 'networkidle' })

        // Attendre que la page soit chargée
        await this.hiddenWindow.webContents.executeJavaScript(`
          new Promise(resolve => {
            if (document.readyState === 'complete') {
              resolve()
            } else {
              window.addEventListener('load', resolve)
            }
          })
        `, true)

        // Chercher le bouton de téléchargement
        const selectors = [
          'a[href*="download"]',
          'a[href*="pixeldrain"]',
          '.btn-download',
          '#download',
          'a.download',
          '[class*="download"]',
          '[id*="download"]',
          'button[class*="download"]',
          'button[id*="download"]'
        ]

        const textMatches = ['download', 'télécharger', 'télécharg']
        
        const buttonFound = await this.findButtonWithSelectors(selectors, textMatches)

        if (!buttonFound || !buttonFound.found) {
          this.detachDebugger()
          
          // Fallback: essayer de convertir directement en PixelDrain si on trouve un ID
          const idMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/)
          if (idMatch) {
            const fileId = idMatch[1]
            const directLink = `https://pixeldrain.com/api/file/${fileId}?download`
            this.hiddenWindow._pendingDownload = null
            setDownloadDestinationPath(destinationPath || null)
            session.defaultSession.downloadURL(directLink)
            
            // Envoyer la confirmation si nécessaire
            const activeDownload = getActiveDownload()
            if (activeDownload && activeDownload.redirectUrl && confirmDownloadToRedirect) {
              setTimeout(async () => {
                try {
                  await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                } catch (err) {
                  // Ignorer les erreurs
                }
              }, TIMEOUTS.DOWNLOAD_CHECK)
            }
            
            return resolve({ success: true, downloadUrl: directLink })
          }
          
          this.hiddenWindow._pendingDownload = null
          return reject(new Error('[BuzzHeavier] Bouton de téléchargement introuvable'))
        }

        // Attendre que le téléchargement soit détecté (max 15 secondes)
        const startTime = Date.now()
        const checkInterval = setInterval(() => {
          if (downloadDetected) {
            clearInterval(checkInterval)
            return
          }

          if (Date.now() - startTime > 15000) {
            clearInterval(checkInterval)
            try {
              this.hiddenWindow._pendingDownload = null
            } catch (e) {}
            
            this.detachDebugger()
            
            // Fallback: conversion directe
            const idMatch = url.match(/buzzheavier\.com\/([a-zA-Z0-9]+)/)
            if (idMatch) {
              const fileId = idMatch[1]
              const directLink = `https://pixeldrain.com/api/file/${fileId}?download`
              setDownloadDestinationPath(destinationPath || null)
              session.defaultSession.downloadURL(directLink)
              
              const activeDownload = getActiveDownload()
              if (activeDownload && activeDownload.redirectUrl && confirmDownloadToRedirect) {
                setTimeout(async () => {
                  try {
                    await confirmDownloadToRedirect(activeDownload.redirectUrl, activeDownload.gameName, activeDownload.gameId)
                  } catch (err) {
                    // Ignorer
                  }
                }, TIMEOUTS.DOWNLOAD_CHECK)
              }
              
              return resolve({ success: true, downloadUrl: directLink })
            }
            
            reject(new Error('[BuzzHeavier] Timeout: téléchargement non détecté'))
          }
        }, TIMEOUTS.DOWNLOAD_CHECK)

      } catch (error) {
        try {
          this.hiddenWindow._pendingDownload = null
        } catch (e) {}
        
        this.detachDebugger()
        throw error
      }
    })
  }
}
