/**
 * Handlers IPC pour Steam
 */
import { ipcMain } from 'electron'
import { getSteamService } from '../utils/services-loader.js'
import { log, errorLog } from '../utils/logger.js'

export function registerSteamHandlers() {
  ipcMain.handle('steam:getGameData', async (event, appId) => {
    try {
      const service = await getSteamService()
      const result = await service.getSteamGameData(appId)
      return result
    } catch (err) {
      errorLog('steam:getGameData error', err)
      throw err
    }
  })
}
