/**
 * Handlers IPC pour GitHub
 */
import { ipcMain } from 'electron'
import { getGithubService } from '../utils/services-loader.js'
import { log, errorLog } from '../utils/logger.js'

export function registerGithubHandlers() {
  ipcMain.handle('github:getUsers', async () => {
    try {
      log('github:getUsers called')
      const service = await getGithubService()
      const result = await service.getUsersFromGitHub()
      return result
    } catch (err) {
      errorLog('github:getUsers error', err)
      throw err
    }
  })

  ipcMain.handle('github:updateUser', async (event, email, updates) => {
    try {
      const service = await getGithubService()
      const result = await service.updateUser(email, updates)
      return result
    } catch (err) {
      errorLog('github:updateUser error', err)
      throw err
    }
  })

  ipcMain.handle('github:deleteUser', async (event, email) => {
    try {
      log('github:deleteUser called with email:', email)
      const service = await getGithubService()
      const result = await service.deleteUser(email)
      log('github:deleteUser success, result:', result)
      return result
    } catch (err) {
      errorLog('github:deleteUser error', err)
      throw err
    }
  })
}
