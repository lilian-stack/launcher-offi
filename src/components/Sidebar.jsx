import { memo, useState, useEffect } from 'react'
import { Motion } from './Motion'
import { 
  FiHome, 
  FiGrid, 
  FiBookOpen, 
  FiDownload, 
  FiSettings,
  FiHeart,
  FiMessageCircle,
  FiAward
} from 'react-icons/fi'
import { downloadManager } from '../services/downloadManager'

// Navigation principale - Pages principales
const mainNavItems = [
  { id: 'home', label: 'Accueil', icon: FiHome },
  { id: 'catalog', label: 'Catalogue', icon: FiGrid },
  { id: 'library', label: 'Bibliothèque', icon: FiBookOpen },
]

// Navigation secondaire - Fonctionnalités spéciales
const secondaryNavItems = [
  { id: 'vip', label: 'VIP', icon: FiAward },
  { id: 'suggestions', label: 'Suggestions jeux', icon: FiMessageCircle },
]

export const Sidebar = memo(({ activeItem, onNavigate, currentUser }) => {
  const [activeDownloadsCount, setActiveDownloadsCount] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const updateActiveDownloads = () => {
      const activeDownloads = downloadManager.getActiveDownloads()
      setActiveDownloadsCount(activeDownloads.length)
    }

    updateActiveDownloads()
    const unsubscribe = downloadManager.subscribe(updateActiveDownloads)
    const interval = setInterval(updateActiveDownloads, 1000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const sidebarWidth = isHovered ? '256px' : '80px' // 64px (w-16) quand fermé, 256px (w-64) quand ouvert

  return (
    <aside 
      className="fixed left-0 top-0 bg-gradient-to-b from-[#0f0f14] via-[#0f0f14] to-[#0a0a0f] border-r border-white/10 flex flex-col shadow-2xl transition-all duration-300 ease-in-out overflow-hidden"
      style={{ 
        top: window.electron?.isElectron ? '2.5rem' : '0', 
        height: window.electron?.isElectron ? 'calc(100vh - 2.5rem)' : '100vh',
        width: sidebarWidth,
        background: 'linear-gradient(180deg, #0f0f14 0%, #0f0f14 50%, #0a0a0f 100%)',
        zIndex: 1000,
        position: 'fixed',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Navigation principale */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-simple">
        <div className="space-y-1.5">
          {mainNavItems.map((item, index) => {
            const isActive = activeItem === item.id
            return (
              <Motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                whileHover={{ x: 4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(item.id)}
                className={`relative nav-item-modern ${isActive ? 'active' : ''} group overflow-hidden`}
              >
                {isActive && (
                  <Motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 bg-gradient-to-r from-[#06b6d4]/20 to-[#3b82f6]/20 rounded-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="relative flex items-center gap-3 justify-center" style={{ justifyContent: isHovered ? 'flex-start' : 'center' }}>
                  <item.icon className={`text-lg transition-all duration-300 ${isActive ? 'text-[#06b6d4] scale-110' : 'text-gray-400 group-hover:text-white'}`} />
                  {isHovered && (
                    <Motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`font-medium transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
                      style={{ overflow: 'hidden' }}
                    >
                      {item.label}
                    </Motion.span>
                  )}
                </div>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-[#06b6d4] to-[#3b82f6] rounded-r-full" />
                )}
              </Motion.button>
            )
          })}
        </div>

        {/* Section VIP (séparée visuellement) */}
        {secondaryNavItems.length > 0 && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 pt-6 border-t border-white/5 relative"
          >
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            {secondaryNavItems.map((item, index) => {
              const isActive = activeItem === item.id
              return (
                <Motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.05, duration: 0.4 }}
                  whileHover={{ x: 4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate(item.id)}
                  className={`relative nav-item-modern ${isActive ? 'active' : ''} group overflow-hidden`}
                >
                  {isActive && (
                    <Motion.div
                      layoutId="activeIndicatorSecondary"
                      className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div className="relative flex items-center gap-3 justify-center" style={{ justifyContent: isHovered ? 'flex-start' : 'center' }}>
                    <item.icon className={`text-lg transition-all duration-300 ${isActive ? 'text-yellow-400 scale-110' : 'text-gray-400 group-hover:text-yellow-400'}`} />
                    {isHovered && (
                      <Motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`font-medium transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
                        style={{ overflow: 'hidden' }}
                      >
                        {item.label}
                      </Motion.span>
                    )}
                  </div>
                </Motion.button>
              )
            })}
          </Motion.div>
        )}
      </nav>

      {/* Section utilitaire (en bas) */}
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="px-4 pt-4 border-t border-white/10 space-y-1.5 relative mt-auto flex-shrink-0"
        style={{ 
          paddingBottom: window.electron?.isElectron ? '0.75rem' : '1rem',
          marginBottom: 0,
          maxHeight: 'fit-content'
        }}
      >
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        {/* Téléchargements avec badge */}
        <Motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          whileHover={{ x: 4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('downloads')}
          className={`relative nav-item-modern ${activeItem === 'downloads' ? 'active' : ''} group overflow-hidden`}
        >
          {activeItem === 'downloads' && (
            <Motion.div
              layoutId="activeIndicatorDownloads"
              className="absolute inset-0 bg-gradient-to-r from-[#06b6d4]/20 to-[#3b82f6]/20 rounded-xl"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <div className="relative flex items-center gap-3 w-full justify-center" style={{ justifyContent: isHovered ? 'flex-start' : 'center' }}>
            <FiDownload className={`${isHovered ? 'text-xl' : 'text-2xl'} transition-all duration-300 ${activeItem === 'downloads' ? 'text-[#06b6d4] scale-110' : 'text-gray-400 group-hover:text-[#06b6d4]'}`} />
            {isHovered && (
              <>
                <Motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`font-medium transition-colors duration-300 flex-1 whitespace-nowrap ${activeItem === 'downloads' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
                  style={{ overflow: 'hidden' }}
                >
                  Téléchargements
                </Motion.span>
                {activeDownloadsCount > 0 && (
                  <Motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="px-2.5 py-1 bg-gradient-to-r from-[#06b6d4] to-[#0891b2] text-white text-xs font-bold rounded-lg shadow-lg shadow-[#06b6d4]/30"
                  >
                    {activeDownloadsCount}
                  </Motion.span>
                )}
              </>
            )}
          </div>
        </Motion.button>

        {/* Paramètres */}
        <Motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileHover={{ x: 4, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('settings')}
          className={`relative nav-item-modern ${activeItem === 'settings' ? 'active' : ''} group overflow-hidden`}
        >
          {activeItem === 'settings' && (
            <Motion.div
              layoutId="activeIndicatorSettings"
              className="absolute inset-0 bg-gradient-to-r from-[#06b6d4]/20 to-[#3b82f6]/20 rounded-xl"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          )}
          <div className="relative flex items-center gap-3 justify-center" style={{ justifyContent: isHovered ? 'flex-start' : 'center' }}>
            <FiSettings className={`text-lg transition-all duration-300 ${activeItem === 'settings' ? 'text-[#06b6d4] scale-110' : 'text-gray-400 group-hover:text-[#06b6d4]'}`} />
            {isHovered && (
              <Motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.3 }}
                className={`font-medium transition-colors duration-300 whitespace-nowrap ${activeItem === 'settings' ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}
                style={{ overflow: 'hidden' }}
              >
                Paramètres
              </Motion.span>
            )}
          </div>
        </Motion.button>
      </Motion.div>
    </aside>
  )
})

Sidebar.displayName = 'Sidebar'

