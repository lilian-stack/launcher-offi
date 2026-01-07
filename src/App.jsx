import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { CommitUpdateModal } from './components/CommitUpdateModal'
import { commitUpdateService } from './services/commitUpdateService'
import { Motion, AnimatePresence } from './components/Motion'
import { authService } from './services/auth'
import { downloadManager } from './services/downloadManager'
import { SearchProvider } from './contexts/SearchContext'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { AdminMenu } from './components/AdminMenu'

// Import du CSS de la bibliothèque
import './styles/modern-components.css'

// Import direct des pages
import { LoginPage } from './pages/Login'
import { HomePage } from './pages/Home'
import { LibraryPage } from './pages/Library'
import { CatalogPage } from './pages/Catalog'
import { GameDetailsPage } from './pages/GameDetails'
import { SettingsPage } from './pages/Settings'
import { VipPage } from './pages/Vip'
import { DownloadsPage } from './pages/Downloads'
import { SuggestionsPage } from './pages/Suggestions'
import { AdminPanel } from './pages/AdminPanel'
import { UpdatesPage } from './pages/Updates'

// Composant de chargement optimisé
const PageLoader = () => (
  <div className="h-full flex items-center justify-center bg-[#0f0f14]">
    <div className="w-12 h-12 border-4 border-[#06b6d4] border-t-transparent rounded-full animate-spin" />
  </div>
)

function App() {
  const [currentUser, setCurrentUser] = useState
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null)(null)
  const [activePage, setActivePage] = useState('home')
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [installedGames, setInstalledGames] = useState([])
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const adminButtonRef = useRef(null)
  
  console.log('🔥 App component is rendering!', { activePage, currentUser })

  // Navigation handler
  const handleNavigate = useCallback((page, gameId = null) => {
    console.log('[App] Navigation vers:', page, gameId)
    setActivePage(page)
    if (gameId) {
      setSelectedGameId(gameId)
    }
  }, [])

  // Handler pour la connexion
  const handleLogin = useCallback((user) => {
    console.log('[App] 🔐 Connexion de:', user.username)
    setCurrentUser(user)
    setActivePage('home')
  }, [])

  // Handler pour la déconnexion
  const handleLogout = useCallback(() => {
    console.log('[App] 🚪 Déconnexion')
    try {
      authService.logout()
      setCurrentUser(null)
      setActivePage('login')
    } catch (error) {
      console.error('[App] ❌ Erreur lors de la déconnexion:', error)
    }
  }, [])

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    try {
      const user = authService.getCurrentUser()
      if (user) {
        setCurrentUser(user)
        console.log('[App] ✅ Utilisateur trouvé:', user.username)
      } else {
        console.log('[App] ℹ️ Aucun utilisateur trouvé, redirection vers login')
        setActivePage('login')
      }
    } catch (error) {
      console.error('[App] ❌ Erreur lors de la vérification de l\'auth:', error)
      setActivePage('login')
    }
  }, [])

  // Initialiser le downloadManager
  useEffect(() => {
    // Callback pour les toasts - créer un système de notification simple
    const toastCallback = (message, type = 'info', duration = 5000, action = null) => {
      console.log(`[Toast ${type.toUpperCase()}] ${message}`)
      
      // Créer une notification visuelle simple
      if (typeof window !== 'undefined' && window.electron?.notification?.show) {
        window.electron.notification.show({
          title: 'Actoris Launcher',
          body: message,
          icon: type === 'success' ? 'success' : type === 'error' ? 'error' : 'info'
        })
      }
      
      if (action) {
        console.log('[Toast] Action disponible:', action.label)
        // Si c'est une action de navigation, l'exécuter automatiquement après 2 secondes
        if (action.onClick && typeof action.onClick === 'function') {
          setTimeout(() => {
            try {
              action.onClick()
            } catch (error) {
              console.error('[App] Erreur lors de l\'exécution de l\'action toast:', error)
            }
          }, 2000)
        }
      }
    }

    // Callback pour la navigation
    const navigateCallback = (page) => {
      console.log('[App] Navigation demandée vers:', page)
      handleNavigate(page)
    }

    // Callback pour les récompenses de liens morts
    const deadLinkRewardCallback = (data) => {
      console.log('[App] 🎁 Récompense pour lien mort:', data)
      // Émettre un événement personnalisé pour que GameDetails puisse l'écouter
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dead-link-reward', {
          detail: data
        }))
      }
    }

    // Callback pour les notifications de liens morts
    const deadLinkNotificationCallback = (data) => {
      console.log('[App] 📢 Notification lien mort:', data)
      // Émettre un événement personnalisé
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dead-link-notification', {
          detail: data
        }))
      }
    }

    // Initialiser le downloadManager
    downloadManager.init(
      toastCallback,
      navigateCallback,
      deadLinkRewardCallback,
      deadLinkNotificationCallback
    )

    console.log('[App] ✅ DownloadManager initialisé avec callbacks fonctionnels')

    // Cleanup au démontage
    return () => {
      downloadManager.cleanup()
      console.log('[App] 🧹 DownloadManager nettoyé')
    }
  }, [handleNavigate])

  // Toggle admin menu
  const handleOpenAdminMenu = useCallback(() => {
    setShowAdminMenu(prev => !prev)
  }, [])

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    // Fonction vide pour l'instant, la sidebar gère son propre état
  }, [])

  // Rendre la page active
  const renderActivePage = () => {
    const pageProps = {
      onNavigate: handleNavigate,
      activePage,
      installedGames,
      currentUser
    }

    switch (activePage) {
      case 'login':
        return (
          <Suspense fallback={<PageLoader />}>
            <LoginPage onLogin={handleLogin} />
          </Suspense>
        )
      case 'home':
        return (
          <Suspense fallback={<PageLoader />}>
            <HomePage {...pageProps} />
          </Suspense>
        )
      case 'library':
        return (
          <Suspense fallback={<PageLoader />}>
            <LibraryPage {...pageProps} />
          </Suspense>
        )
      case 'catalog':
        return (
          <Suspense fallback={<PageLoader />}>
            <CatalogPage {...pageProps} />
          </Suspense>
        )
      case 'game-details':
        return (
          <Suspense fallback={<PageLoader />}>
            <GameDetailsPage 
              {...pageProps} 
              gameId={selectedGameId}
            />
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage {...pageProps} onLogout={handleLogout} />
          </Suspense>
        )
      case 'vip':
        return (
          <Suspense fallback={<PageLoader />}>
            <VipPage {...pageProps} />
          </Suspense>
        )
      case 'downloads':
        return (
          <Suspense fallback={<PageLoader />}>
            <DownloadsPage {...pageProps} />
          </Suspense>
        )
      case 'suggestions':
        return (
          <Suspense fallback={<PageLoader />}>
            <SuggestionsPage {...pageProps} />
          </Suspense>
        )
      case 'admin':
        return (
          <Suspense fallback={<PageLoader />}>
            <AdminPanel {...pageProps} />
          </Suspense>
        )
      case 'updates':
      case 'updates-modal':
        return (
          <Suspense fallback={<PageLoader />}>
            <UpdatesPage {...pageProps} />
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={<PageLoader />}>
            <HomePage {...pageProps} />
          </Suspense>
        )
    }
  }

  // Si pas connecté, afficher seulement la page de login
  if (activePage === 'login') {
    return (
      <SearchProvider>
        <TitleBar />
        <div className="h-screen w-screen flex flex-col bg-[#0f0f14] overflow-hidden relative" style={{ paddingTop: typeof window !== 'undefined' && window.electron?.isElectron ? '2.5rem' : '0' }}>
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <Motion.div
                key={activePage}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.3 }}
                className="h-full w-full"
              >
                {renderActivePage()}
              </Motion.div>
            </AnimatePresence>
          </main>
        </div>
      </SearchProvider>
    )
  }

  return (
    <SearchProvider>
      {/* TitleBar avec boutons de contrôle */}
      <TitleBar />
      
      <div className="h-screen w-screen flex flex-col bg-[#0f0f14] overflow-hidden relative" style={{ paddingTop: typeof window !== 'undefined' && window.electron?.isElectron ? '2.5rem' : '0' }}>
        
        {/* Layout principal avec sidebar */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <Sidebar
            activeItem={activePage}
            onNavigate={handleNavigate}
            currentUser={currentUser}
          />
          
          {/* Contenu principal avec TopBar */}
          <div className="flex-1 min-h-0 overflow-hidden relative transition-all duration-300 ml-64">
            {/* TopBar */}
            <TopBar
              activePage={activePage}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              installedGames={installedGames}
              onOpenAdminMenu={handleOpenAdminMenu}
              adminButtonRef={adminButtonRef}
              showAdminMenu={showAdminMenu}
            />
            
            {/* Contenu des pages */}
            <main 
              className="h-full overflow-hidden relative"
              style={{ position: 'relative', zIndex: 1, height: 'calc(100% - 4rem)' }}
            >
              <AnimatePresence mode="wait">
                <Motion.div
                  key={activePage}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full"
                >
                  {renderActivePage()}
                </Motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Menu Admin */}
        <AdminMenu
          isOpen={showAdminMenu}
          onClose={() => setShowAdminMenu(false)}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          adminButtonRef={adminButtonRef}
          currentUser={currentUser}
        />
      </div>
    </SearchProvider>
  )
}

export default App