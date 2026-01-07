/**
 * Handlers IPC pour Steam
 */
import electron from 'electron';
const { ipcMain } = electron
import { getSteamService } from '../utils/services-loader.mjs'
import { log, errorLog } from '../utils/logger.mjs'

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
