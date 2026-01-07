/**
 * Handlers IPC pour WebSocket
 */
import electron from 'electron';
const { ipcMain } = electron
import { getWebsocketService } from '../utils/services-loader.mjs'
import { log, errorLog } from '../utils/logger.mjs'

let dependencies = {}

export function injectDependencies(deps) {
  dependencies = { ...dependencies, ...deps }
}

export function registerWebsocketHandlers() {
  ipcMain.handle('websocket:connect', async (event, manualRetry = false) => {
    try {
      log(`websocket:connect called (manualRetry: ${manualRetry})`)
      const service = await getWebsocketService()
      const { mainWindow } = dependencies
      
      service.connectWebSocket(
        (message) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('websocket:message', message)
          }
        },
        (error) => {
          errorLog('websocket error:', error)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('websocket:error', error)
          }
        },
        () => {
          log('websocket connected')
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('websocket:connected')
          }
        },
        () => {
          log('websocket disconnected')
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('websocket:disconnected')
          }
        },
        manualRetry
      )
      return { success: true }
    } catch (err) {
      errorLog('websocket:connect error', err)
      throw err
    }
  })

  ipcMain.handle('websocket:disconnect', async () => {
    try {
      log('websocket:disconnect called')
      const service = await getWebsocketService()
      service.disconnectWebSocket()
      return { success: true }
    } catch (err) {
      errorLog('websocket:disconnect error', err)
      throw err
    }
  })

  ipcMain.handle('websocket:send', async (event, message) => {
    try {
      log('websocket:send called')
      const service = await getWebsocketService()
      const success = service.sendWebSocketMessage(message)
      return { success }
    } catch (err) {
      errorLog('websocket:send error', err)
      throw err
    }
  })

  ipcMain.handle('websocket:isConnected', async () => {
    const service = await getWebsocketService()
    return service.isWebSocketConnected()
  })
}
