const { contextBridge, ipcRenderer, shell } = require('electron')

// Logs désactivés - ne plus afficher les logs du serveur backend
ipcRenderer.on('backend-server:log', (event, data) => {
  // Logs désactivés
})

// Logs désactivés - ne plus afficher les logs du processus principal
ipcRenderer.on('main:log', (event, args) => {
  // Logs désactivés
})

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  
  // Exposer ipcRenderer pour les événements (lecture seule)
  ipcRenderer: {
    on: (channel, callback) => {
      // Whitelist des canaux autorisés
      const validChannels = [
        'discord:auth-code', 
        'discord:auth-error', 
        'backend-server:log', 
        'main:log',
        'games:installed-updated',
        'game-uninstalled',
        'download:started',
        'download:progress',
        'download:complete',
        'download:error',
        'extraction-started',
        'extraction:progress',
        'download:extracted',
        'download:extraction-failed'
      ]
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, callback)
      } else {
        // Logs désactivés
      }
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel)
    },
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback)
    },
  },
  
  // GitHub API functions
  github: {
    getUsers: () => ipcRenderer.invoke('github:getUsers'),
    createUser: (userData) => ipcRenderer.invoke('github:createUser', userData),
    loginUser: (email, password) => ipcRenderer.invoke('github:loginUser', email, password),
    findUser: (email, username) => ipcRenderer.invoke('github:findUser', email, username),
    updateUser: (email, updates) => ipcRenderer.invoke('github:updateUser', email, updates),
    deleteUser: (email) => ipcRenderer.invoke('github:deleteUser', email),
  },
  
  // Supabase Users API functions
  supabase: {
    getUsers: () => ipcRenderer.invoke('supabase:getUsers'),
  },
  
  // Steam API functions
  steam: {
    getGameData: (appId) => ipcRenderer.invoke('steam:getGameData', appId),
    getGameVideo: (steamId) => ipcRenderer.invoke('steam:getGameVideo', steamId),
  },
  
  // Games management functions
  games: {
    addGame: (gameData) => ipcRenderer.invoke('games:addGame', gameData),
    getGames: (forceRefresh = false) => ipcRenderer.invoke('games:getGames', forceRefresh),
    getInstalled: () => ipcRenderer.invoke('games:getInstalled'),
    scanInstalledGames: (gamesFolder, forceRefresh) => ipcRenderer.invoke('scan-installed-games', gamesFolder, forceRefresh),
    isGameInstalled: (gameId) => ipcRenderer.invoke('games:isGameInstalled', gameId),
    deleteGame: (gameId) => ipcRenderer.invoke('games:deleteGame', gameId),
    updateGame: (gameId, updates) => ipcRenderer.invoke('games:updateGame', gameId, updates),
    findGameExe: (gameFolder, gameName) => ipcRenderer.invoke('games:findGameExe', gameFolder, gameName),
    checkFileExists: (filePath) => ipcRenderer.invoke('games:checkFileExists', filePath),
    launchGame: (exePath, gameName, gameId) => ipcRenderer.invoke('games:launchGame', exePath, gameName, gameId),
    launchGameWithAds: (exePath, gameName, userStatus, gameId) => ipcRenderer.invoke('games:launchGameWithAds', exePath, gameName, userStatus, gameId),
    uninstallGame: (gameName, gameFolderPath) => ipcRenderer.invoke('games:uninstallGame', gameName, gameFolderPath),
    onUninstallProgress: (callback) => {
      ipcRenderer.on('uninstall:progress', (event, data) => {
        callback(data)
      })
    },
    removeUninstallProgressListener: () => {
      ipcRenderer.removeAllListeners('uninstall:progress')
    },
    openGameFolder: (gameName) => ipcRenderer.invoke('games:openGameFolder', gameName),
    createDesktopShortcut: (gameName, exePath) => ipcRenderer.invoke('games:createDesktopShortcut', gameName, exePath),
    checkShortcutExists: (gameName) => ipcRenderer.invoke('games:checkShortcutExists', gameName),
  },
  
  // User Library functions (Bibliothèque par utilisateur Discord - JSON)
  userLibrary: {
    setUser: (discordId) => ipcRenderer.invoke('user-library:setUser', discordId),
    getGames: (userId) => ipcRenderer.invoke('user-library:getGames', userId),
    getStatistics: () => ipcRenderer.invoke('user-library:getStatistics'),
  },
  
  // SQLite Library functions (Bibliothèque SQLite - plus performante)
  sqliteLibrary: {
    init: () => ipcRenderer.invoke('sqlite-library:init'),
    setUser: (discordId, userData) => ipcRenderer.invoke('sqlite-library:setUser', discordId, userData),
    loadUser: (discordId) => ipcRenderer.invoke('sqlite-library:loadUser', discordId),
    getAllUsers: () => ipcRenderer.invoke('sqlite-library:getAllUsers'),
    deleteUser: (discordId) => ipcRenderer.invoke('sqlite-library:deleteUser', discordId),
    getGames: (userId) => ipcRenderer.invoke('sqlite-library:getGames', userId),
    getStats: (userId) => ipcRenderer.invoke('sqlite-library:getStats', userId),
    getMostPlayed: (limit, userId) => ipcRenderer.invoke('sqlite-library:getMostPlayed', limit, userId),
    getRecentlyPlayed: (limit, userId) => ipcRenderer.invoke('sqlite-library:getRecentlyPlayed', limit, userId),
    searchGames: (query, userId) => ipcRenderer.invoke('sqlite-library:searchGames', query, userId),
    updateLastPlayed: (gameId) => ipcRenderer.invoke('sqlite-library:updateLastPlayed', gameId),
    incrementPlayTime: (gameId, minutes) => ipcRenderer.invoke('sqlite-library:incrementPlayTime', gameId, minutes),
    addGame: (gameId, gameData) => ipcRenderer.invoke('sqlite-library:addGame', gameId, gameData),
    removeGame: (gameId) => ipcRenderer.invoke('sqlite-library:removeGame', gameId),
    hasGame: (gameId) => ipcRenderer.invoke('sqlite-library:hasGame', gameId),
    debug: () => ipcRenderer.invoke('sqlite-library:debug'),
  },
  
  // Discord OAuth2 functions
  discord: {
    getAuthUrl: async () => {
      // Logs complètement désactivés pour une expérience silencieuse et fluide
      // Attendre que le backend soit prêt avec retry optimisé
      const maxRetries = 10
      const retryDelay = 200
      const healthTimeout = 1000
      const discordTimeout = 2000
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // D'abord vérifier que le backend répond avec un health check rapide
          try {
            const healthController = new AbortController()
            const healthTimeoutId = setTimeout(() => healthController.abort(), healthTimeout)
            
            const healthResponse = await fetch('http://127.0.0.1:3001/health', {
              method: 'GET',
              signal: healthController.signal,
              headers: {
                'Accept': 'application/json'
              }
            })
            
            clearTimeout(healthTimeoutId)
            
            if (healthResponse.ok) {
              // Backend prêt, continuer avec l'appel Discord
            } else {
              throw new Error(`Health check returned status ${healthResponse.status}`)
            }
          } catch (healthError) {
            // Silencieux - pas de logs
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            } else {
              throw new Error(`Backend server not responding. Please check if the backend is running on port 3001.`)
            }
          }
          
          // Appeler l'endpoint Discord avec timeout réduit
          const discordController = new AbortController()
          const discordTimeoutId = setTimeout(() => discordController.abort(), discordTimeout)
          
          const response = await fetch('http://127.0.0.1:3001/api/discord/auth-url', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: discordController.signal
          })
          
          clearTimeout(discordTimeoutId)
          
          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`HTTP ${response.status}: ${errorText}`)
          }
          
          const data = await response.json()
          
          if (!data.success || !data.url) {
            throw new Error(data.error || 'Invalid response from backend')
          }
          
          // Succès ! Retourner l'URL silencieusement
          return String(data.url)
          
        } catch (error) {
          // Gérer les erreurs de timeout (AbortError)
          if (error.name === 'AbortError') {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            } else {
              throw new Error('Backend server timeout. Please check if the backend is running on port 3001.')
            }
          }
          
          // Gérer les erreurs de connexion
          if (error.message.includes('Failed to fetch') || 
              error.message.includes('ERR_CONNECTION_REFUSED') ||
              error.message.includes('NetworkError') ||
              error.message.includes('fetch')) {
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            } else {
              throw new Error(`Backend server not accessible. Please check if the backend is running on port 3001.`)
            }
          } else {
            // Autres erreurs (HTTP, JSON, etc.) - ne pas retry
            throw error
          }
        }
      }
      
      // Si on arrive ici, toutes les tentatives ont échoué
      throw new Error(`Backend server not responding after ${maxRetries} attempts. Please check if the backend is running on port 3001.`)
    },
    authenticate: (code) => ipcRenderer.invoke('discord:authenticate', code),
    refreshToken: (sessionToken) => ipcRenderer.invoke('discord:refreshToken', sessionToken),
    getSession: (sessionToken) => ipcRenderer.invoke('discord:getSession', sessionToken),
    syncRoles: (sessionToken) => ipcRenderer.invoke('discord:syncRoles', sessionToken),
    logout: (sessionToken) => ipcRenderer.invoke('discord:logout', sessionToken),
    openAuthUrl: async (url) => {
      // S'assurer que url est une chaîne
      const urlString = typeof url === 'string' ? url : (url?.url || String(url))
      // Logs désactivés pour une expérience plus fluide
      // Utiliser IPC pour ouvrir dans une fenêtre Electron au lieu du navigateur externe
      return await ipcRenderer.invoke('discord:openAuthUrl', urlString)
    },
    notifyDeadLink: (gameName, errorMessage, gameId) => ipcRenderer.invoke('discord:notify-dead-link', gameName, errorMessage, gameId),
  },
  
  // Discord RPC functions
  discordRPC: {
    init: () => ipcRenderer.invoke('discord-rpc:init'),
    setPresence: (presence) => ipcRenderer.invoke('discord-rpc:setPresence', presence),
    setGamePresence: (gameName, gameImageKey) => ipcRenderer.invoke('discord-rpc:setGamePresence', gameName, gameImageKey),
    resetPresence: () => ipcRenderer.invoke('discord-rpc:resetPresence'),
    disconnect: () => ipcRenderer.invoke('discord-rpc:disconnect'),
  },
  
  // Updates functions
  updates: {
    downloadAsset: (url, filename) => ipcRenderer.invoke('updates:download', url, filename),
    install: () => ipcRenderer.invoke('updates:install'),
    installInBackground: (installerPath) => ipcRenderer.invoke('updates:installInBackground', installerPath),
  },

  // Auto start / app settings
  autostart: {
    getStatus: () => ipcRenderer.invoke('app:getAutoLaunch'),
    setStatus: (enabled) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  },
  
  // WebSocket functions
  websocket: {
    connect: (manualRetry = false) => ipcRenderer.invoke('websocket:connect', manualRetry),
    disconnect: () => ipcRenderer.invoke('websocket:disconnect'),
    send: (message) => ipcRenderer.invoke('websocket:send', message),
    isConnected: () => ipcRenderer.invoke('websocket:isConnected'),
  },
  
  // Support/Ticket functions
  support: {
    createTicket: (data) => ipcRenderer.invoke('support:createTicket', data),
    submitGameSuggestion: (data) => ipcRenderer.invoke('support:submitGameSuggestion', data),
  },
  
  // Discord Webhook functions (added to existing discord object)
  
  // IPC Renderer pour écouter les événements
  ipcRenderer: {
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  
  // Shell functions
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  },
  
  // Download functions
  download: {
    selectFolder: () => ipcRenderer.invoke('download:selectFolder'),
    downloadGame: (url, destinationPath, options = {}) => ipcRenderer.invoke('download-game', url, destinationPath, options),
    testIPC: (testData) => ipcRenderer.invoke('test-download-ipc', testData),
    prepareDownloadForLockr: (gameId, gameName, folderPath, lockrUrl) => ipcRenderer.invoke('download:prepareForLockr', gameId, gameName, folderPath, lockrUrl),
    scanInstalledGames: (gamesFolder, forceRefresh = false) => ipcRenderer.invoke('scan-installed-games', gamesFolder, forceRefresh),
    pauseDownload: (gameId) => ipcRenderer.invoke('download:pause', gameId),
    resumeDownload: (gameId) => ipcRenderer.invoke('download:resume', gameId),
    cancelDownload: (gameId) => ipcRenderer.invoke('download:cancel', gameId),
    gofile: (options) => ipcRenderer.invoke('download:gofile', options),
  },
  
  // App functions
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },
  
  // Window functions
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximize: (callback) => {
      ipcRenderer.on('window:maximized', callback)
      return () => ipcRenderer.removeListener('window:maximized', callback)
    },
    onUnmaximize: (callback) => {
      ipcRenderer.on('window:unmaximized', callback)
      return () => ipcRenderer.removeListener('window:unmaximized', callback)
    },
    removeMaximizeListener: (callback) => ipcRenderer.removeListener('window:maximized', callback),
    removeUnmaximizeListener: (callback) => ipcRenderer.removeListener('window:unmaximized', callback),
  },

  // Files helpers
  files: {
    sha256: (filePath) => ipcRenderer.invoke('file:sha256', filePath),
  },
  
  // Lockr functions
  lockr: {
    createLocker: (gameId, gameName, targetUrl) => ipcRenderer.invoke('lockr:createLocker', gameId, gameName, targetUrl),
    updateLocker: (lockerId, targetUrl, title) => ipcRenderer.invoke('lockr:updateLocker', lockerId, targetUrl, title),
    getLockerInfo: (lockerId) => ipcRenderer.invoke('lockr:getLockerInfo', lockerId),
    generateLockersForAllGames: () => ipcRenderer.invoke('lockr:generateLockersForAllGames'),
    updateGameLockrUrl: (gameName, lockrUrl) => ipcRenderer.invoke('lockr:updateGameLockrUrl', gameName, lockrUrl),
    // Système à un seul lien Lockr
    launchGameWithUniqueLink: (gameId, gameName) => ipcRenderer.invoke('lockr:launchGameWithUniqueLink', gameId, gameName),
    getCurrentGame: () => ipcRenderer.invoke('lockr:getCurrentGame'),
    closeWindow: () => ipcRenderer.invoke('lockr:close-window'),
    goBack: () => ipcRenderer.invoke('lockr:go-back'),
    goForward: () => ipcRenderer.invoke('lockr:go-forward'),
    createTab: (url, title) => ipcRenderer.invoke('lockr:create-tab', url, title),
    switchTab: (tabId) => ipcRenderer.invoke('lockr:switch-tab', tabId),
    closeTab: (tabId) => ipcRenderer.invoke('lockr:close-tab', tabId),
    notifyNetlifyRedirect: (url) => ipcRenderer.send('lockr:netlify-redirect-detected', url),
    startGameDownload: (gameId, gameName, redirectUrl) => ipcRenderer.invoke('lockr:startGameDownload', gameId, gameName, redirectUrl),
  },
  
  // Image Cache functions (WebP compression)
  imageCache: {
    cacheImage: (url) => ipcRenderer.invoke('image-cache:cacheImage', url),
    getCachedImagePath: (url) => ipcRenderer.invoke('image-cache:getCachedImagePath', url),
    isImageCached: (url) => ipcRenderer.invoke('image-cache:isImageCached', url),
    preloadImage: (url) => ipcRenderer.invoke('image-cache:preloadImage', url),
    clearCache: () => ipcRenderer.invoke('image-cache:clearCache'),
  },
  
  // Utils functions (pour les services comme Buzz)
  utils: {
    fetchPageContent: (url) => ipcRenderer.invoke('utils:fetchPageContent', url),
    getDiskSpace: (folderPath) => ipcRenderer.invoke('utils:getDiskSpace', folderPath),
    getAvailableDrives: () => ipcRenderer.invoke('utils:getAvailableDrives'),
    getGofileInfo: (url, password) => ipcRenderer.invoke('utils:getGofileInfo', url, password),
  },
  
  // Version detection functions
  version: {
    detectInstalled: (gamePath, gameName) => ipcRenderer.invoke('version:detectInstalled', gamePath, gameName),
    scanAllInstalled: (gamesDirectory) => ipcRenderer.invoke('version:scanAllInstalled', gamesDirectory),
    getHistory: (gameId) => ipcRenderer.invoke('version:getHistory', gameId),
    compareVersions: (gameName) => ipcRenderer.invoke('version:compareVersions', gameName),
    onGameInstalled: (gameName, installPath) => ipcRenderer.invoke('version:onGameInstalled', gameName, installPath),
  },
  
  // Fonction pour écouter les logs du serveur backend
  onBackendLog: (callback) => {
    ipcRenderer.on('backend-server:log', (event, data) => callback(event, data))
    // Retourner une fonction de nettoyage
    return () => {
      ipcRenderer.removeAllListeners('backend-server:log')
    }
  },
})
