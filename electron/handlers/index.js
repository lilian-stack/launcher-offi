/**
 * Export centralisé de tous les handlers IPC
 * Ce module enregistre tous les handlers IPC de l'application
 */

import { ipcMain } from 'electron'

/**
 * Enregistre tous les handlers IPC avec leurs dépendances
 * @param {Object} dependencies - Objet contenant toutes les dépendances nécessaires
 * @param {Object} dependencies.download - Dépendances pour download-handlers
 * @param {Function} dependencies.getGamesService - Service de jeux
 * @param {Function} dependencies.getGameExtractor - Extractor de jeux
 * @param {Function} dependencies.getLockrService - Service Lockr
 * @param {Function} dependencies.getAdsService - Service de publicités
 * @param {Function} dependencies.getDiscordRPCService - Service Discord RPC
 * @param {Object} dependencies.installedGamesStore - Store des jeux installés
 * @param {BrowserWindow} dependencies.mainWindow - Fenêtre principale
 * @param {Object} dependencies.scanCache - Cache de scan
 * @param {Set} dependencies.uninstallingGames - Set des jeux en désinstallation
 * @param {Object} dependencies.BrowserWindow - Classe BrowserWindow
 * @param {Function} dependencies.killGameProcesses - Fonction pour tuer les processus de jeux
 * @param {Function} dependencies.forceDeleteFolder - Fonction pour forcer la suppression
 * @param {Function} dependencies.countFilesRecursive - Fonction pour compter les fichiers
 * @param {Function} dependencies.deleteDirectoryWithProgress - Fonction pour supprimer avec progression
 * @param {Function} dependencies.log - Fonction de log
 * @param {Function} dependencies.errorLog - Fonction de log d'erreur
 * @param {Object} dependencies.autoUpdater - Auto-updater
 */
export async function registerAllHandlers(dependencies = {}) {
  // ============================================
  // Handlers de téléchargement
  // ============================================
  if (dependencies.download) {
    const { injectDownloadDependencies } = await import('./download-handlers.js')
    injectDownloadDependencies(dependencies.download)
  }
  const { downloadHandlers } = await import('./download-handlers.js')
  Object.entries(downloadHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })

  // ============================================
  // Handlers de fenêtre
  // ============================================
  if (dependencies.mainWindow) {
    const { registerWindowHandlers } = await import('./window-handlers.js')
    registerWindowHandlers(dependencies.mainWindow)
  }
  const { windowHandlers, appHandlers } = await import('./window-handlers.js')
  Object.entries(windowHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })
  Object.entries(appHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })

  // ============================================
  // Handlers de jeux
  // ============================================
  const { injectDependencies: injectGamesDependencies, registerGamesHandlers } = await import('./games-handlers.js')
  if (dependencies.games) {
    injectGamesDependencies(dependencies.games)
  }
  registerGamesHandlers()

  // ============================================
  // Handlers d'authentification
  // ============================================
  const { injectDependencies: injectAuthDependencies, registerAuthHandlers } = await import('./auth-handlers.js')
  if (dependencies.auth) {
    injectAuthDependencies(dependencies.auth)
  }
  registerAuthHandlers()

  // ============================================
  // Handlers Discord RPC
  // ============================================
  const { registerDiscordRPCHandlers } = await import('./discord-rpc-handlers.js')
  registerDiscordRPCHandlers()

  // ============================================
  // Handlers WebSocket
  // ============================================
  const { injectDependencies: injectWebsocketDependencies, registerWebsocketHandlers } = await import('./websocket-handlers.js')
  if (dependencies.websocket) {
    injectWebsocketDependencies(dependencies.websocket)
  }
  registerWebsocketHandlers()

  // ============================================
  // Handlers Supabase
  // ============================================
  const { registerSupabaseHandlers } = await import('./supabase-handlers.js')
  registerSupabaseHandlers()

  // ============================================
  // Handlers GitHub
  // ============================================
  const { registerGithubHandlers } = await import('./github-handlers.js')
  registerGithubHandlers()

  // ============================================
  // Handlers Steam
  // ============================================
  const { registerSteamHandlers } = await import('./steam-handlers.js')
  registerSteamHandlers()

  // ============================================
  // Handlers Lockr
  // ============================================
  const { injectDependencies: injectLockrDependencies, registerLockrHandlers } = await import('./lockr-handlers.js')
  if (dependencies.lockr) {
    injectLockrDependencies(dependencies.lockr)
  }
  registerLockrHandlers()

  // ============================================
  // Handlers User Library
  // ============================================
  const { injectDependencies: injectUserLibraryDependencies, registerUserLibraryHandlers } = await import('./user-library-handlers.js')
  if (dependencies.userLibrary) {
    injectUserLibraryDependencies(dependencies.userLibrary)
  }
  registerUserLibraryHandlers()

  // ============================================
  // Handlers SQLite Library
  // ============================================
  const { injectDependencies: injectSQLiteLibraryDependencies, registerSQLiteLibraryHandlers } = await import('./sqlite-library-handlers.js')
  if (dependencies.sqliteLibrary) {
    injectSQLiteLibraryDependencies(dependencies.sqliteLibrary)
  }
  registerSQLiteLibraryHandlers()

  // ============================================
  // Handlers Image Cache
  // ============================================
  const { registerImageCacheHandlers } = await import('./image-cache-handlers.js')
  registerImageCacheHandlers()

  // ============================================
  // Handlers Shell
  // ============================================
  const { registerShellHandlers } = await import('./shell-handlers.js')
  registerShellHandlers()

  // ============================================
  // Handlers Support
  // ============================================
  const { injectDependencies: injectSupportDependencies, registerSupportHandlers } = await import('./support-handlers.js')
  if (dependencies.support) {
    injectSupportDependencies(dependencies.support)
  }
  registerSupportHandlers()

  // ============================================
  // Handlers Updates
  // ============================================
  const { injectDependencies: injectUpdatesDependencies, registerUpdatesHandlers } = await import('./updates-handlers.js')
  if (dependencies.updates) {
    injectUpdatesDependencies(dependencies.updates)
  }
  registerUpdatesHandlers()

  console.log('[Handlers] ✅ Tous les handlers IPC ont été enregistrés')
}
