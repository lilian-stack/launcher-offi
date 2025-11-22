import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { AdminMenu } from './components/AdminMenu'
import { UpdateModal } from './components/UpdateModal'
import { PatchNotes } from './components/PatchNotes'
import { HomePage } from './pages/Home'
import { CatalogPage } from './pages/Catalog'
import { VipPage } from './pages/Vip'
import { LibraryPage } from './pages/Library'
import { FavoritesPage } from './pages/Favorites'
import { DownloadsPage } from './pages/Downloads'
import { SettingsPage } from './pages/Settings'
import { UpdatesPage } from './pages/Updates'
import { LoginPage } from './pages/Login'
import { AdminPanel } from './pages/AdminPanel'
import { GameDetails } from './pages/GameDetails'
import { SupportPage } from './pages/Support'
import { authService } from './services/auth'

const PageContent = ({ activePage, onNavigate, currentUser, gameId, installedGames }) => {
  switch (activePage) {
    case 'catalog':
      return <CatalogPage installedGames={installedGames} />
    case 'favorites':
      return <FavoritesPage onNavigate={onNavigate} activePage={activePage} />
    case 'downloads':
      return <DownloadsPage />
    case 'vip':
      return <VipPage />
    case 'library':
      return <LibraryPage onNavigate={onNavigate} activePage={activePage} installedGames={installedGames} />
    case 'updates':
      return <UpdatesPage />
    case 'settings':
      return <SettingsPage currentUser={currentUser} />
    case 'admin':
      return <AdminPanel />
    case 'game-details':
      return <GameDetails gameId={gameId} installedGames={installedGames} />
    case 'support':
      return <SupportPage />
    case 'home':
    default:
      return <HomePage installedGames={installedGames} />
  }
}

function App() {
  const [activePage, setActivePage] = useState('home')
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser())
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [patchOpen, setPatchOpen] = useState(false)
  const [patchVersion, setPatchVersion] = useState('v1.0.1')
  const [patchNotes, setPatchNotes] = useState([])
  const [installerPath, setInstallerPath] = useState('')
  const [installedGames, setInstalledGames] = useState([]) // Jeux installés détectés
  const adminButtonRef = useRef(null)
  
  // Fonction de scan des jeux installés
  const scanInstalledGames = useCallback(async (forceRefresh = false) => {
    try {
      console.log('[App] 🔍 Scan automatique des jeux installés...' + (forceRefresh ? ' (forcé)' : ''))
      if (window.electron && window.electron.download && window.electron.download.scanInstalledGames) {
        const result = await window.electron.download.scanInstalledGames(null, forceRefresh)
        if (result.success && result.games) {
          console.log('[App] ✅ Jeux installés trouvés:', result.games.length)
          setInstalledGames(result.games)
        } else {
          console.log('[App] ⚠️ Aucun jeu installé trouvé')
          setInstalledGames([])
        }
      }
    } catch (err) {
      console.error('[App] Erreur lors du scan des jeux installés:', err)
      setInstalledGames([])
    }
  }, [])

  // Scanner les jeux installés au démarrage
  useEffect(() => {
    scanInstalledGames()
    
    // Écouter les événements de téléchargement pour mettre à jour la liste
    if (window.electron && window.electron.ipcRenderer) {
      const handleDownloadComplete = () => {
        console.log('[App] 📥 Téléchargement terminé, re-scan des jeux...')
        setTimeout(() => {
          scanInstalledGames(true) // Forcer le rafraîchissement après téléchargement
        }, 2000) // Attendre 2 secondes pour que le marqueur soit créé
      }
      
      window.electron.ipcRenderer.on('download:complete', handleDownloadComplete)
      
      return () => {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.removeAllListeners('download:complete')
        }
      }
    }
  }, [scanInstalledGames])

  // Scanner automatiquement quand on arrive sur les pages home, library, catalog ou game-details
  useEffect(() => {
    if (activePage === 'home' || activePage === 'library' || activePage === 'catalog' || activePage === 'game-details') {
      console.log(`[App] 🔍 Arrivée sur la page "${activePage}", scan automatique...`)
      scanInstalledGames(true) // Forcer le rafraîchissement pour avoir les données à jour
    }
  }, [activePage, scanInstalledGames])

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
    return () => window.removeEventListener('navigate', handleNavigate)
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
          .catch(err => console.error('Error updating user on GitHub:', err))
      }
    }
  }, [currentUser])

  // Gérer la connexion
  const handleLogin = (user) => {
    authService.setCurrentUser(user)
    setCurrentUser(user)
    setActivePage('home')
  }

  // Gérer la déconnexion
  const handleLogout = () => {
    authService.logout()
    setCurrentUser(null)
    setActivePage('home')
  }

  // Si l'utilisateur n'est pas connecté, afficher la page de connexion
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <Sidebar activeItem={activePage} onNavigate={setActivePage} />
      <main className="app-main">
                <TopBar
                  ref={adminButtonRef}
                  activePage={activePage}
                  onOpenFilters={() => setActivePage('catalog')}
                  onOpenAdminMenu={() => setAdminMenuOpen(!adminMenuOpen)}
                  onNavigate={(page) => {
                    if (page === 'updates-modal') {
                      setUpdatesOpen(true)
                    } else {
                      setActivePage(page)
                    }
                  }}
                  currentUser={currentUser}
                />
        <UpdateModal isOpen={updatesOpen} onClose={() => setUpdatesOpen(false)} />
        <PatchNotes isOpen={patchOpen} version={patchVersion} notes={patchNotes} installerPath={installerPath} onClose={() => setPatchOpen(false)} />
        <div className="app-content">
          <AnimatePresence mode="wait">
            <Motion.div
              key={`${activePage}-${selectedGameId || ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ 
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
              }}
            >
              <PageContent activePage={activePage} onNavigate={setActivePage} currentUser={currentUser} gameId={selectedGameId} installedGames={installedGames} />
            </Motion.div>
          </AnimatePresence>
          <AdminMenu
            isOpen={adminMenuOpen}
            onClose={() => setAdminMenuOpen(false)}
            onNavigate={(page) => {
              if (!page) return
              if (page === 'updates-modal') {
                setUpdatesOpen(true)
              } else {
                setActivePage(page)
              }
            }}
            onLogout={handleLogout}
            adminButtonRef={adminButtonRef}
          />
      </div>
      </main>
      </div>
  )
}

export default App
