import { useEffect, useRef, useState, useCallback, lazy, Suspense, memo, useMemo } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { authService } from './services/auth'
import { ToastContainer } from './components/Toast'
import { downloadManager } from './services/downloadManager'
import { useToast } from './hooks/useToast'
import { logger } from './utils/logger'
import { SearchProvider } from './contexts/SearchContext'

const log = logger.create('App')

// Lazy loading de tous les composants pour améliorer le temps de démarrage
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })))
const TopBar = lazy(() => import('./components/TopBar').then(m => ({ default: m.TopBar })))
const AdminMenu = lazy(() => import('./components/AdminMenu').then(m => ({ default: m.AdminMenu })))
const UpdateModal = lazy(() => import('./components/UpdateModal').then(m => ({ default: m.UpdateModal })))
const PatchNotes = lazy(() => import('./components/PatchNotes').then(m => ({ default: m.PatchNotes })))
const LogoutModal = lazy(() => import('./components/LogoutModal').then(m => ({ default: m.LogoutModal })))

// Lazy loading des pages pour améliorer les performances au démarrage
const LoginPage = lazy(() => import('./pages/Login').then(m => ({ default: m.LoginPage })))
const HomePage = lazy(() => import('./pages/Home').then(m => ({ default: m.HomePage })))
const CatalogPage = lazy(() => import('./pages/Catalog').then(m => ({ default: m.CatalogPage })))
const VipPage = lazy(() => import('./pages/Vip').then(m => ({ default: m.VipPage || m.default })))
const LibraryPage = lazy(() => import('./pages/Library').then(m => ({ default: m.LibraryPage || m.default })))
const FavoritesPage = lazy(() => import('./pages/Favorites').then(m => ({ default: m.FavoritesPage || m.default })))
const DownloadsPage = lazy(() => import('./pages/Downloads').then(m => ({ default: m.DownloadsPage || m.default })))
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage || m.default })))
const UpdatesPage = lazy(() => import('./pages/Updates').then(m => ({ default: m.UpdatesPage || m.default })))
const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel || m.default })))
const GameDetails = lazy(() => import('./pages/GameDetails').then(m => ({ default: m.GameDetails || m.default })))
const SupportPage = lazy(() => import('./pages/Support').then(m => ({ default: m.SupportPage || m.default })))
const SuggestionsPage = lazy(() => import('./pages/Suggestions').then(m => ({ default: m.SuggestionsPage || m.default })))

// Composant de chargement
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
)

// Mémoriser PageContent pour éviter les re-renders inutiles
const PageContent = memo(({ activePage, onNavigate, currentUser, gameId, installedGames, toast }) => {
  const page = useMemo(() => {
    switch (activePage) {
      case 'catalog':
        return <CatalogPage installedGames={installedGames} />
      case 'favorites':
        return <FavoritesPage onNavigate={onNavigate} activePage={activePage} />
      case 'downloads':
        return <DownloadsPage />
      case 'vip':
        return <VipPage currentUser={currentUser} />
      case 'library':
        return <LibraryPage onNavigate={onNavigate} activePage={activePage} installedGames={installedGames} currentUser={currentUser} />
      case 'updates':
        return <UpdatesPage />
      case 'settings':
        return <SettingsPage currentUser={currentUser} />
      case 'admin':
        return <AdminPanel />
      case 'game-details':
        return <GameDetails gameId={gameId} installedGames={installedGames} toast={toast} currentUser={currentUser} />
      case 'support':
        // Temporairement désactivé - redirection vers home
        return <HomePage installedGames={installedGames} />
      case 'suggestions':
        // Temporairement désactivé - redirection vers home
        return <HomePage installedGames={installedGames} />
      case 'home':
      default:
        return <HomePage installedGames={installedGames} />
    }
  }, [activePage, onNavigate, currentUser, gameId, installedGames, toast])

  return (
    <Suspense fallback={<PageLoader />}>
      {page}
    </Suspense>
  )
})

function App() {
  const [activePage, setActivePage] = useState('home')
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => {
    const user = authService.getCurrentUser()
    log.debug('Current user', user ? user.email : 'not logged in')
    return user
  })

  // Restaurer la session au démarrage
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const user = await authService.restoreSession()
        if (user) {
          log.debug('Session restored', user.email)
          setCurrentUser(user)
        }
      } catch (err) {
        log.error('Error restoring session', err)
      }
    }
    restoreSession()
  }, [])
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [patchOpen, setPatchOpen] = useState(false)
  const [patchVersion, setPatchVersion] = useState('v1.0.1')
  const [patchNotes, setPatchNotes] = useState([])
  const [installerPath, setInstallerPath] = useState('')
  const [installedGames, setInstalledGames] = useState([]) // Jeux installés détectés
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const adminButtonRef = useRef(null)
  
  // Hook pour gérer les toasts
  const toast = useToast()
  
  // Fonction de scan des jeux installés (avec cache pour éviter les scans inutiles)
  const scanInstalledGames = useCallback(async (forceRefresh = false) => {
    try {
      log.debug('Scanning installed games', forceRefresh ? '(forced)' : '')
      if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
        const result = await window.electron.download.scanInstalledGames(null, forceRefresh)
        if (result.success && result.games) {
          log.debug('Installed games found', result.games.length)
          setInstalledGames(result.games)
        } else {
          setInstalledGames([])
        }
      }
    } catch (err) {
      log.error('Error scanning installed games', err)
      setInstalledGames([])
    }
  }, [])

  // Initialiser le DownloadManager et écouter les événements de téléchargement
  useEffect(() => {
    if (!currentUser) return

    // Initialiser le DownloadManager avec les callbacks
    downloadManager.init(
      (message, type, duration, action) => {
        if (type === 'download' && action) {
          toast.showDownload(message, action, { duration })
        } else {
          toast.showToast({ message, type, duration })
        }
      },
      (page) => {
        setActivePage(page)
      }
    )

    return () => {
      downloadManager.cleanup()
    }
  }, [currentUser, toast])

  // Cache pour éviter les scans trop fréquents
  const lastScanTimeRef = useRef(0)
  const SCAN_COOLDOWN = 5000 // 5 secondes entre les scans
  
  // Scanner les jeux installés seulement après la connexion (délai pour améliorer les performances)
  useEffect(() => {
    if (!currentUser) return // Ne pas scanner si l'utilisateur n'est pas connecté
    
    // Délayer le scan initial pour ne pas bloquer l'affichage de la page de connexion
    const scanTimer = setTimeout(() => {
      scanInstalledGames()
      lastScanTimeRef.current = Date.now()
    }, 500) // Délai de 500ms après la connexion
    
    // Écouter les événements de téléchargement pour mettre à jour la liste
    let cleanup = null
    if (window.electron && window.electron.ipcRenderer) {
      const handleDownloadComplete = () => {
        log.debug('Download complete, re-scanning games')
        // Utiliser un délai plus long pour laisser le temps au marqueur d'être créé
        setTimeout(() => {
          const now = Date.now()
          // Ne scanner que si le dernier scan date de plus de 2 secondes
          if (now - lastScanTimeRef.current > 2000) {
            scanInstalledGames(true) // Forcer le rafraîchissement après téléchargement
            lastScanTimeRef.current = now
          }
        }, 2000) // Attendre 2 secondes pour que le marqueur soit créé
      }
      
      window.electron.ipcRenderer.on('download:complete', handleDownloadComplete)
      
      cleanup = () => {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('download:complete')
        }
      }
    }
    
    return () => {
      clearTimeout(scanTimer)
      if (cleanup) cleanup()
    }
  }, [scanInstalledGames, currentUser])

  // Scanner automatiquement quand on arrive sur les pages home, library, catalog ou game-details
  // Mais seulement si le dernier scan date de plus de 5 secondes
  useEffect(() => {
    if (activePage === 'home' || activePage === 'library' || activePage === 'catalog' || activePage === 'game-details') {
      const now = Date.now()
      // Ne scanner que si le dernier scan date de plus de 5 secondes
      if (now - lastScanTimeRef.current > SCAN_COOLDOWN) {
        log.debug('Page changed, auto-scanning', activePage)
        scanInstalledGames(true) // Forcer le rafraîchissement pour avoir les données à jour
        lastScanTimeRef.current = now
      }
    }
  }, [activePage, scanInstalledGames])

  // Écouter les événements de désinstallation pour mettre à jour la liste
  useEffect(() => {
    const handleGameUninstalled = () => {
      // Forcer un nouveau scan après désinstallation (sans cooldown car c'est important)
      const now = Date.now()
      scanInstalledGames(true)
      lastScanTimeRef.current = now
    }

    window.addEventListener('game-uninstalled', handleGameUninstalled)
    
    // Écouter l'événement IPC pour la mise à jour directe de la liste (plus rapide que le scan)
    let cleanup = null
    if (window.electron && window.electron.ipcRenderer) {
      const handleInstalledGamesUpdated = (event, data) => {
        if (data && data.games) {
          log.debug('Installed games updated from main process', data.games.length)
          setInstalledGames(data.games)
          lastScanTimeRef.current = Date.now() // Mettre à jour le timestamp même pour les mises à jour directes
        }
      }
      
      window.electron.ipcRenderer.on('installed-games-updated', handleInstalledGamesUpdated)
      
      cleanup = () => {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('installed-games-updated')
        }
      }
    }
    
    return () => {
      window.removeEventListener('game-uninstalled', handleGameUninstalled)
      if (cleanup) cleanup()
    }
  }, [scanInstalledGames])

  // Gérer la navigation personnalisée
  useEffect(() => {
    const handleNavigate = (event) => {
      const detail = event.detail
      if (typeof detail === 'object' && detail.page === 'game-details') {
        setSelectedGameId(detail.gameId)
        setActivePage('game-details')
      } else if (typeof detail === 'string') {
        setActivePage(detail)
        setSelectedGameId(null)
      }
    }

    window.addEventListener('navigate', handleNavigate)
    
    // Écouter les événements IPC pour la navigation depuis le protocole personnalisé
    let cleanup = null
    if (window.electron && window.electron.ipcRenderer) {
      const handleNavigateToGame = (event, data) => {
        if (data) {
          log.debug('Navigation vers le jeu depuis le protocole:', data)
          if (data.gameId) {
            setSelectedGameId(data.gameId)
            setActivePage('game-details')
          } else if (data.gameName) {
            // Rechercher le jeu par nom dans le catalogue
            // Pour l'instant, on navigue vers le catalogue avec une recherche
            // Vous pouvez améliorer cela en recherchant le jeu dans le catalogue
            setActivePage('catalog')
            // TODO: Implémenter la recherche automatique par nom
          }
        }
      }
      
      window.electron.ipcRenderer.on('navigate-to-game', handleNavigateToGame)
      
      // Écouter l'événement pour démarrer le téléchargement depuis le protocole
      const handleProtocolStartDownload = (event, data) => {
        if (data) {
          log.debug('📥 Démarrage du téléchargement depuis le protocole:', data)
          if (data.gameId) {
            console.log('[App] 🎮 Navigation vers le jeu:', data.gameId, data.gameName)
            setSelectedGameId(data.gameId)
            setActivePage('game-details')
            // Envoyer un événement personnalisé pour déclencher le téléchargement
            // Attendre que GameDetails soit monté et que le jeu soit chargé
            setTimeout(() => {
              console.log('[App] 📤 Envoi de l\'événement protocol:start-download')
              window.dispatchEvent(new CustomEvent('protocol:start-download', { detail: data }))
            }, 1000) // Augmenter le délai pour s'assurer que GameDetails est prêt
          } else if (data.gameName) {
            // Si pas de gameId, naviguer vers le catalogue et rechercher
            console.log('[App] 🔍 Recherche du jeu par nom:', data.gameName)
            setActivePage('catalog')
            // TODO: Implémenter la recherche automatique par nom
          }
        }
      }
      
      window.electron.ipcRenderer.on('protocol:start-download', handleProtocolStartDownload)
      
      cleanup = () => {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('navigate-to-game')
          window.electron.ipcRenderer.removeAllListeners('protocol:start-download')
        }
      }
    }
    
    return () => {
      window.removeEventListener('navigate', handleNavigate)
      if (cleanup) cleanup()
    }
  }, [])

  // Ouvrir Patch Notes quand demandé
  useEffect(() => {
    const openPatch = (e) => {
      const v = e.detail?.version || 'v1.0.1'
      const n = e.detail?.notes || []
      const p = e.detail?.installerPath || ''
      setPatchVersion(v)
      setPatchNotes(n)
      setInstallerPath(p)
      setPatchOpen(true)
    }
    window.addEventListener('show-patch-notes', openPatch)
    return () => window.removeEventListener('show-patch-notes', openPatch)
  }, [])

  // Fermer le menu admin quand la page change
  useEffect(() => {
    setAdminMenuOpen(false)
  }, [activePage])

  // Vérifier et mettre à jour le statut admin pour l'email spécifique
  useEffect(() => {
    const ADMIN_EMAIL = 'lilianlesieur82@gmail.com'
    if (currentUser && currentUser.email === ADMIN_EMAIL && !currentUser.isAdmin) {
      // Mettre à jour le statut admin localement
      const updatedUser = { ...currentUser, isAdmin: true }
      authService.setCurrentUser(updatedUser)
      setCurrentUser(updatedUser)
      
      // Mettre à jour sur GitHub si possible
      if (window.electron && window.electron.github && window.electron.github.updateUser) {
        window.electron.github.updateUser(ADMIN_EMAIL, { isAdmin: true })
          .catch(err => {
            log.error('Error updating user on GitHub', err)
          })
      }
    }
  }, [currentUser])

  // Mémoriser les callbacks pour éviter les re-renders (TOUJOURS AVANT LES RETURNS CONDITIONNELS)
  const handleLogin = useCallback((user) => {
    authService.setCurrentUser(user)
    setCurrentUser(user)
    setActivePage('home')
  }, [])

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true)
  }, [])

  const handleConfirmLogout = useCallback(() => {
    authService.logout()
    setCurrentUser(null)
    setActivePage('home')
    setShowLogoutModal(false)
  }, [])

  const handleOpenFilters = useCallback(() => setActivePage('catalog'), [])
  const handleOpenAdminMenu = useCallback(() => setAdminMenuOpen(prev => !prev), [])
  const handleNavigate = useCallback((page, gameId = null) => {
    if (page === 'updates-modal') {
      setUpdatesOpen(true)
    } else if (page === 'game-details' && gameId) {
      setSelectedGameId(gameId)
      setActivePage('game-details')
    } else {
      setActivePage(page)
      setSelectedGameId(null)
    }
  }, [])
  const handleCloseUpdates = useCallback(() => setUpdatesOpen(false), [])
  const handleClosePatch = useCallback(() => setPatchOpen(false), [])
  const handleCloseAdminMenu = useCallback(() => setAdminMenuOpen(false), [])
  const handleAdminNavigate = useCallback((page) => {
    if (!page) return
    if (page === 'updates-modal') {
      setUpdatesOpen(true)
    } else {
      setActivePage(page)
    }
  }, [])

  // Si l'utilisateur n'est pas connecté, afficher la page de connexion
  if (!currentUser) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage onLogin={handleLogin} />
      </Suspense>
    )
  }

  return (
    <SearchProvider>
      <div className="app-shell">
        <Suspense fallback={<div className="w-64" />}>
          <Sidebar activeItem={activePage} onNavigate={setActivePage} />
        </Suspense>
        <main className="app-main">
        <Suspense fallback={<div className="h-16" />}>
          <TopBar
            ref={adminButtonRef}
            activePage={activePage}
            onOpenFilters={handleOpenFilters}
            onOpenAdminMenu={handleOpenAdminMenu}
            onNavigate={handleNavigate}
            currentUser={currentUser}
            installedGames={installedGames}
          />
        </Suspense>
        <Suspense fallback={null}>
          <UpdateModal isOpen={updatesOpen} onClose={handleCloseUpdates} />
          <PatchNotes isOpen={patchOpen} version={patchVersion} notes={patchNotes} installerPath={installerPath} onClose={handleClosePatch} />
          <LogoutModal
            isOpen={showLogoutModal}
            onClose={() => setShowLogoutModal(false)}
            onConfirm={handleConfirmLogout}
            username={currentUser?.username || currentUser?.email}
          />
        </Suspense>
        <div className="app-content">
          <AnimatePresence mode="wait">
            <Motion.div
              key={`${activePage}-${selectedGameId || ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ 
                duration: 0.2,
                ease: [0.4, 0, 0.2, 1]
              }}
            >
              <PageContent activePage={activePage} onNavigate={setActivePage} currentUser={currentUser} gameId={selectedGameId} installedGames={installedGames} toast={toast} />
            </Motion.div>
          </AnimatePresence>
          <Suspense fallback={null}>
            <AdminMenu
              isOpen={adminMenuOpen}
              onClose={handleCloseAdminMenu}
              onNavigate={handleAdminNavigate}
              onLogout={handleLogout}
              adminButtonRef={adminButtonRef}
            />
          </Suspense>
      </div>
        </main>
        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      </div>
    </SearchProvider>
  )
}

export default App
