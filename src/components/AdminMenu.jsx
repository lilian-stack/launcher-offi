import { useEffect, useRef, useState } from 'react'
import { Motion, AnimatePresence } from './Motion'

export function AdminMenu({ isOpen, onClose, onNavigate, onLogout, adminButtonRef, currentUser }) {
  const menuRef = useRef(null)
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          adminButtonRef?.current && !adminButtonRef.current.contains(event.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, adminButtonRef])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!window.electron?.ipcRenderer) return
    
    const handleUpdateAvailable = () => {
      setHasUpdate(true)
    }
    
    const handleUpdateNotAvailable = () => {
      setHasUpdate(false)
    }
    
    window.electron.ipcRenderer.on('update-available', handleUpdateAvailable)
    window.electron.ipcRenderer.on('update-not-available', handleUpdateNotAvailable)
    window.electron.ipcRenderer.on('update-downloaded', handleUpdateAvailable)
    
    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('update-available', handleUpdateAvailable)
        window.electron.ipcRenderer.removeListener('update-not-available', handleUpdateNotAvailable)
        window.electron.ipcRenderer.removeListener('update-downloaded', handleUpdateAvailable)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen && menuRef.current && adminButtonRef?.current) {
      const updatePosition = () => {
        const buttonRect = adminButtonRef.current.getBoundingClientRect()
        const menu = menuRef.current
        if (menu && buttonRect) {
          const menuWidth = 280
          const buttonRight = buttonRect.right
          const windowWidth = window.innerWidth
          const margin = 12
          
          let left = buttonRight - menuWidth
          left = Math.max(margin, Math.min(left, windowWidth - menuWidth - margin))
          
          menu.style.position = 'fixed'
          menu.style.top = `${buttonRect.bottom + 12}px`
          menu.style.left = `${left}px`
          menu.style.width = `${menuWidth}px`
          menu.style.minWidth = `${menuWidth}px`
          menu.style.maxWidth = `${menuWidth}px`
          menu.style.transform = 'none'
        }
      }
      
      updatePosition()
      requestAnimationFrame(() => {
        updatePosition()
      })
      setTimeout(updatePosition, 10)
      
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen, adminButtonRef])

  const handleAction = (action) => {
    if (action === 'logout') {
      onLogout?.()
    } else {
      if (action === 'updates') {
        onNavigate?.('updates-modal')
      } else {
        onNavigate?.(action)
      }
    }
    onClose()
  }

  if (!isOpen) return null

  const menuItems = [
    ...(currentUser?.isAdmin ? [{
      id: 'admin',
      icon: '◈',
      title: 'Panel Admin',
      subtitle: 'Gestion du launcher',
      action: 'admin',
      className: 'panel'
    }] : []),
    {
      id: 'updates',
      icon: '↻',
      title: 'Mises à jour',
      subtitle: 'Vérifier les MAJ',
      action: 'updates',
      className: 'update',
      hasBadge: hasUpdate
    },
    {
      id: 'settings',
      icon: '⚙',
      title: 'Paramètres',
      subtitle: 'Préférences',
      action: 'settings',
      className: 'settings'
    },
    {
      id: 'logout',
      icon: '→',
      title: 'Déconnexion',
      subtitle: 'Quitter la session',
      action: 'logout',
      className: 'logout'
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="admin-menu"
          style={{
            position: 'fixed',
            zIndex: 9999,
            background: 'rgba(15, 15, 20, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '8px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            minWidth: '280px'
          }}
        >
          {menuItems.map((item, index) => (
            <div key={item.id}>
              {index > 0 && index === menuItems.length - 1 && (
                <div style={{
                  height: '1px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  margin: '8px 0'
                }} />
              )}
              <div
                onClick={() => handleAction(item.action)}
                className={`menu-item ${item.className}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 14px',
                  marginBottom: index < menuItems.length - 1 ? '4px' : '0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = item.className === 'panel' ? 'rgba(245, 158, 11, 0.08)' :
                    item.className === 'update' ? 'rgba(6, 182, 212, 0.08)' :
                    item.className === 'settings' ? 'rgba(168, 85, 247, 0.08)' :
                    'rgba(239, 68, 68, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <div
                  className="menu-icon"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    transition: 'all 0.2s ease',
                    background: item.className === 'panel' ? 'rgba(245, 158, 11, 0.12)' :
                      item.className === 'update' ? 'rgba(6, 182, 212, 0.12)' :
                      item.className === 'settings' ? 'rgba(168, 85, 247, 0.12)' :
                      'rgba(239, 68, 68, 0.12)',
                    color: item.className === 'panel' ? '#f59e0b' :
                      item.className === 'update' ? '#06b6d4' :
                      item.className === 'settings' ? '#a855f7' :
                      '#ef4444'
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: '#f8fafc',
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '2px',
                    letterSpacing: '-0.01em'
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    color: 'rgba(248, 250, 252, 0.5)',
                    fontSize: '12px',
                    fontWeight: 400
                  }}>
                    {item.subtitle}
                  </div>
                </div>
                {item.hasBadge && (
                  <div style={{
                    background: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: '1px solid rgba(6, 182, 212, 0.3)'
                  }}>
                    0
                  </div>
                )}
              </div>
            </div>
          ))}
        </Motion.div>
      )}
    </AnimatePresence>
  )
}
