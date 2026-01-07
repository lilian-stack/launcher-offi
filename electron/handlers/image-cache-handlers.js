/**
 * Handlers IPC pour le cache d'images
 */
import { ipcMain } from 'electron'
import { getImageCacheService } from '../utils/services-loader.js'
import { log, errorLog } from '../utils/logger.js'

export function registerImageCacheHandlers() {
  ipcMain.handle('image-cache:cacheImage', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = await service.cacheImage(url)
      return { success: true, path: result }
    } catch (err) {
      errorLog('image-cache:cacheImage error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:getCachedImagePath', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = service.getCachedImagePath(url)
      return { success: true, path: result }
    } catch (err) {
      errorLog('image-cache:getCachedImagePath error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:isImageCached', async (event, url) => {
    try {
      const service = await getImageCacheService()
      const result = service.isImageCached(url)
      return { success: true, cached: result }
    } catch (err) {
      errorLog('image-cache:isImageCached error', err)
      return { success: false, cached: false }
    }
  })

  ipcMain.handle('image-cache:preloadImage', async (event, url) => {
    try {
      const service = await getImageCacheService()
      await service.preloadImage(url)
      return { success: true }
    } catch (err) {
      errorLog('image-cache:preloadImage error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('image-cache:clearCache', async () => {
    try {
      const service = await getImageCacheService()
      service.clearCache()
      return { success: true }
    } catch (err) {
      errorLog('image-cache:clearCache error', err)
      return { success: false, error: err.message }
    }
  })
}
