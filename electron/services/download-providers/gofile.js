/**
 * Provider GoFile pour téléchargement
 * Utilise l'API GoFile v2 pour télécharger les fichiers
 */

import { BaseProvider } from './base-provider.js'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fetchJSON, downloadHttpToFile } from '../../utils/download-helpers.js'

export class GoFileProvider extends BaseProvider {
  constructor(hiddenWindow) {
    super('GoFile', hiddenWindow)
  }

  /**
   * Télécharge depuis GoFile en utilisant l'API GoFile v2
   */
  async download(url, destinationPath = null) {
    try {
      // Extraire l'ID du contenu depuis l'URL
      const contentIdMatch = url.match(/gofile\.io\/d\/([a-zA-Z0-9]+)/)
      if (!contentIdMatch) {
        throw new Error('[GoFile] URL invalide. Format attendu: https://gofile.io/d/xxxxx')
      }
      
      const contentId = contentIdMatch[1]

      const destFolder = destinationPath || app.getPath('downloads')
      const absoluteDestFolder = path.resolve(destFolder)

      // Créer le dossier s'il n'existe pas
      if (!fs.existsSync(absoluteDestFolder)) {
        fs.mkdirSync(absoluteDestFolder, { recursive: true })
      }

      // Appeler l'API GoFile v2 pour obtenir les fichiers
      const apiUrl = `https://api.gofile.io/contents/${contentId}`
      const apiResponse = await fetchJSON(apiUrl)
      
      if (!apiResponse || !apiResponse.data) {
        throw new Error('[GoFile] Réponse API invalide')
      }

      // Extraire les fichiers depuis data.children
      const children = apiResponse.data.children
      if (!children || Object.keys(children).length === 0) {
        throw new Error('[GoFile] Aucun fichier trouvé dans la réponse API')
      }

      // Filtrer les fichiers (type === "file") et extraire les liens
      const downloadLinks = []
      for (const [fileName, fileData] of Object.entries(children)) {
        if (fileData.type === 'file' && fileData.link) {
          downloadLinks.push({
            name: fileName,
            url: fileData.link,
            size: fileData.size || null
          })
        }
      }

      if (downloadLinks.length === 0) {
        throw new Error('[GoFile] Aucun lien de téléchargement trouvé dans les fichiers')
      }

      // Télécharger chaque fichier directement
      const downloadedFiles = []
      for (const file of downloadLinks) {
        try {
          const fileName = file.name || path.basename(file.url)
          const filePath = path.join(absoluteDestFolder, fileName)
          
          // Utiliser downloadHttpToFile pour télécharger directement
          await downloadHttpToFile(file.url, filePath, (received, total) => {
            // Progression optionnelle (peut être loggée)
          })
          
          downloadedFiles.push(filePath)
        } catch (fileErr) {
          throw new Error(`[GoFile] Erreur lors du téléchargement de ${file.name}: ${fileErr.message}`)
        }
      }

      return { 
        success: true, 
        downloadUrl: downloadLinks[0].url, 
        provider: 'gofile',
        files: downloadedFiles
      }

    } catch (error) {
      throw error
    }
  }
}
