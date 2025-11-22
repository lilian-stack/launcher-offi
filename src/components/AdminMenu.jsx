import { useEffect, useRef } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiSettings, FiRefreshCw, FiLogOut } from 'react-icons/fi'

export function AdminMenu({ isOpen, onClose, onNavigate, onLogout, adminButtonRef }) {
  const menuRef = useRef(null)

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
    if (isOpen && menuRef.current && adminButtonRef?.current) {
      const updatePosition = () => {
        const buttonRect = adminButtonRef.current.getBoundingClientRect()
        const menu = menuRef.current
        if (menu && buttonRect) {
          const desiredWidth = 240 // réduire la largeur
          const buttonCenter = buttonRect.left + buttonRect.width / 2
          const windowWidth = window.innerWidth
          
          // Calcul horizontal: centrer le menu sous le bouton, borné aux bords de la fenêtre
          const margin = 8
          let left = buttonCenter - desiredWidth / 2
          left = Math.max(margin, Math.min(left, windowWidth - desiredWidth - margin))
          
          // Offset vertical pour coller visuellement
          const verticalOffset = -14
          
          menu.style.position = 'fixed'
          menu.style.top = `${buttonRect.bottom + verticalOffset}px`
          menu.style.left = `${left}px`
          menu.style.right = 'auto'
          menu.style.width = `${desiredWidth}px`
          menu.style.minWidth = `${desiredWidth}px`
          menu.style.maxWidth = `${desiredWidth}px`
          menu.style.transform = 'none'
        }
      }
      
      // Mettre à jour immédiatement
      updatePosition()
      
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        updatePosition()
      })
      
      // Petit délai pour s'assurer que tout est rendu
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
      // Ouvrir une modale pour 'updates' au lieu de naviguer
      if (action === 'updates') {
        onNavigate?.('updates-modal')
      } else {
        onNavigate?.(action)
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="admin-menu-main"
          style={{ position: 'fixed' }}
        >
          <button
            className="admin-menu-item admin-menu-item-updates"
            onClick={() => handleAction('updates')}
          >
            <div className="admin-menu-icon admin-menu-icon-updates">
              <FiRefreshCw />
            </div>
            <div>
              <p className="admin-menu-title">Vérifier les mises à jour</p>
              <p className="admin-menu-subtitle">Rechercher une mise à jour</p>
            </div>
          </button>
          <button
            className="admin-menu-item admin-menu-item-settings"
            onClick={() => handleAction('settings')}
          >
            <div className="admin-menu-icon admin-menu-icon-settings">
              <FiSettings />
            </div>
            <div>
              <p className="admin-menu-title">Paramètres</p>
              <p className="admin-menu-subtitle">Gérer vos préférences</p>
            </div>
          </button>
          <button
            className="admin-menu-item admin-menu-item-logout"
            onClick={() => handleAction('logout')}
          >
            <div className="admin-menu-icon admin-menu-icon-logout">
              <FiLogOut />
            </div>
            <div>
              <p className="admin-menu-title admin-menu-title-logout">Se déconnecter</p>
              <p className="admin-menu-subtitle">Quitter votre session</p>
            </div>
          </button>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}

