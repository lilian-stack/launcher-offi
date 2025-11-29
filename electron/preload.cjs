const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  
  // GitHub API functions
  github: {
    getUsers: () => ipcRenderer.invoke('github:getUsers'),
    createUser: (userData) => ipcRenderer.invoke('github:createUser', userData),
    loginUser: (email, password) => ipcRenderer.invoke('github:loginUser', email, password),
    findUser: (email, username) => ipcRenderer.invoke('github:findUser', email, username),
    updateUser: (email, updates) => ipcRenderer.invoke('github:updateUser', email, updates),
    deleteUser: (email) => ipcRenderer.invoke('github:deleteUser', email),
  },
  
  // Steam API functions
  steam: {
    getGameData: (appId) => ipcRenderer.invoke('steam:getGameData', appId),
  },
  
  // Games management functions
  games: {
    addGame: (gameData) => ipcRenderer.invoke('games:addGame', gameData),
    getGames: () => ipcRenderer.invoke('games:getGames'),
    deleteGame: (gameId) => ipcRenderer.invoke('games:deleteGame', gameId),
    updateGame: (gameId, updates) => ipcRenderer.invoke('games:updateGame', gameId, updates),
    findGameExe: (gameFolder, gameName) => ipcRenderer.invoke('games:findGameExe', gameFolder, gameName),
    checkFileExists: (filePath) => ipcRenderer.invoke('games:checkFileExists', filePath),
    launchGame: (exePath) => ipcRenderer.invoke('games:launchGame', exePath),
    launchGameWithAds: (exePath, gameName, userStatus) => ipcRenderer.invoke('games:launchGameWithAds', exePath, gameName, userStatus),
    uninstallGame: (gameName) => ipcRenderer.invoke('games:uninstallGame', gameName),
    openGameFolder: (gameName) => ipcRenderer.invoke('games:openGameFolder', gameName),
    createDesktopShortcut: (gameName, exePath) => ipcRenderer.invoke('games:createDesktopShortcut', gameName, exePath),
  },
  
  // Discord OAuth2 functions
  discord: {
    getAuthUrl: async () => {
      const result = await ipcRenderer.invoke('discord:getAuthUrl')
      return result?.url || result // Retourner l'URL directement si c'est un objet, sinon retourner tel quel
    },
    authenticate: (code) => ipcRenderer.invoke('discord:authenticate', code),
    refreshToken: (refreshToken) => ipcRenderer.invoke('discord:refreshToken', refreshToken),
    openAuthUrl: (url) => {
      // S'assurer que url est une chaîne
      const urlString = typeof url === 'string' ? url : (url?.url || String(url))
      return ipcRenderer.invoke('discord:openAuthUrl', urlString)
    },
  },
  
  // Updates functions
  updates: {
    downloadAsset: (url, filename) => ipcRenderer.invoke('updates:download', url, filename),
    install: () => ipcRenderer.invoke('updates:install'),
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
  },
  
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
    scanInstalledGames: (gamesFolder, forceRefresh = false) => ipcRenderer.invoke('scan-installed-games', gamesFolder, forceRefresh),
    pauseDownload: (gameId) => ipcRenderer.invoke('download:pause', gameId),
    resumeDownload: (gameId) => ipcRenderer.invoke('download:resume', gameId),
    cancelDownload: (gameId) => ipcRenderer.invoke('download:cancel', gameId),
  },
  
  // App functions
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restart: () => ipcRenderer.invoke('app:restart'),
  },

  // Files helpers
  files: {
    sha256: (filePath) => ipcRenderer.invoke('file:sha256', filePath),
  },
})
