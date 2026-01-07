/**
 * Handlers IPC pour Discord RPC
 */
import electron from 'electron';
const { ipcMain } = electron
import { getDiscordRPCService } from '../utils/services-loader.mjs'
import { log, errorLog } from '../utils/logger.mjs'

export function registerDiscordRPCHandlers() {
  ipcMain.handle('discord-rpc:init', async () => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.initDiscordRPC()
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:init error', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('discord-rpc:setPresence', async (event, presence) => {
    try {
      const service = await getDiscordRPCService()
      const result = await service.setDiscordPresence(presence)
      return { success: result }
    } catch (err) {
      errorLog('discord-rpc:setPresence error', err)
      return { success: false, error: err.message }
    }
  })
}
