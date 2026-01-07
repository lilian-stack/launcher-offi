/**
 * Export centralisé de tous les handlers IPC
 * Ce module enregistre tous les handlers IPC de l'application
 */

import electron from 'electron';
const { ipcMain } = electron

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
    const { injectDownloadDependencies } = await import('./download-handlers.mjs')
    injectDownloadDependencies(dependencies.download)
  }
  const { downloadHandlers } = await import('./download-handlers.mjs')
  Object.entries(downloadHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })

  // ============================================
  // Handlers de fenêtre
  // ============================================
  if (dependencies.mainWindow) {
    const { registerWindowHandlers } = await import('./window-handlers.mjs')
    registerWindowHandlers(dependencies.mainWindow)
  }
  const { windowHandlers, appHandlers } = await import('./window-handlers.mjs')
  Object.entries(windowHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })
  Object.entries(appHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, handler)
  })

  // ============================================
  // Handlers de jeux
  // ============================================
  const { injectDependencies: injectGamesDependencies, registerGamesHandlers } = await import('./games-handlers.mjs')
  if (dependencies.games) {
    injectGamesDependencies(dependencies.games)
  }
  registerGamesHandlers()

  // ============================================
  // Handlers d'authentification
  // ============================================
  const { injectDependencies: injectAuthDependencies, registerAuthHandlers } = await import('./auth-handlers.mjs')
  if (dependencies.auth) {
    injectAuthDependencies(dependencies.auth)
  }
  registerAuthHandlers()

  // ============================================
  // Handlers Discord RPC
  // ============================================
  const { registerDiscordRPCHandlers } = await import('./discord-rpc-handlers.mjs')
  registerDiscordRPCHandlers()

  // ============================================
  // Handlers WebSocket
  // ============================================
  const { injectDependencies: injectWebsocketDependencies, registerWebsocketHandlers } = await import('./websocket-handlers.mjs')
  if (dependencies.websocket) {
    injectWebsocketDependencies(dependencies.websocket)
  }
  registerWebsocketHandlers()

  // ============================================
  // Handlers Supabase
  // ============================================
  const { registerSupabaseHandlers } = await import('./supabase-handlers.mjs')
  registerSupabaseHandlers()

  // ============================================
  // Handlers GitHub
  // ============================================
  const { registerGithubHandlers } = await import('./github-handlers.mjs')
  registerGithubHandlers()

  // ============================================
  // Handlers Steam
  // ============================================
  const { registerSteamHandlers } = await import('./steam-handlers.mjs')
  registerSteamHandlers()

  // ============================================
  // Handlers Lockr
  // ============================================
  const { injectDependencies: injectLockrDependencies, registerLockrHandlers } = await import('./lockr-handlers.mjs')
  if (dependencies.lockr) {
    injectLockrDependencies(dependencies.lockr)
  }
  registerLockrHandlers()

  // ============================================
  // Handlers User Library
  // ============================================
  const { injectDependencies: injectUserLibraryDependencies, registerUserLibraryHandlers } = await import('./user-library-handlers.mjs')
  if (dependencies.userLibrary) {
    injectUserLibraryDependencies(dependencies.userLibrary)
  }
  registerUserLibraryHandlers()

  // ============================================
  // Handlers SQLite Library
  // ============================================
  const { injectDependencies: injectSQLiteLibraryDependencies, registerSQLiteLibraryHandlers } = await import('./sqlite-library-handlers.mjs')
  if (dependencies.sqliteLibrary) {
    injectSQLiteLibraryDependencies(dependencies.sqliteLibrary)
  }
  registerSQLiteLibraryHandlers()

  // ============================================
  // Handlers Image Cache
  // ============================================
  const { registerImageCacheHandlers } = await import('./image-cache-handlers.mjs')
  registerImageCacheHandlers()

  // ============================================
  // Handlers Shell
  // ============================================
  const { registerShellHandlers } = await import('./shell-handlers.mjs')
  registerShellHandlers()

  // ============================================
  // Handlers Support
  // ============================================
  const { injectDependencies: injectSupportDependencies, registerSupportHandlers } = await import('./support-handlers.mjs')
  if (dependencies.support) {
    injectSupportDependencies(dependencies.support)
  }
  registerSupportHandlers()

  // ============================================
  // Handlers Updates
  // ============================================
  const { injectDependencies: injectUpdatesDependencies, registerUpdatesHandlers } = await import('./updates-handlers.mjs')
  if (dependencies.updates) {
    injectUpdatesDependencies(dependencies.updates)
  }
  registerUpdatesHandlers()

  console.log('[Handlers] ✅ Tous les handlers IPC ont été enregistrés')
}
