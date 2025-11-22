import { forwardRef, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiBell, FiSearch, FiUser, FiFilter } from 'react-icons/fi'

export const TopBar = forwardRef(({ activePage, onOpenFilters, onOpenAdminMenu, currentUser, onNavigate }, adminButtonRef) => {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <Motion.div 
      className="topbar-shell"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
        <div className="search-wrapper">
          <FiSearch className={`search-icon ${searchFocused ? 'text-primary' : ''}`} />
          <input
            type="text"
            placeholder="Rechercher un jeu..."
            className="hero-input"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        <div className="flex items-center gap-3">
          {activePage === 'catalog' && (
            <Motion.button
              onClick={() => onOpenFilters?.()}
              className="btn btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <FiFilter className="mr-2" />
              Filtres
            </Motion.button>
          )}
          {currentUser?.isAdmin && (
            <Motion.button 
              onClick={() => onNavigate?.('admin')}
              className="btn btn-gold"
              whileHover={{ scale: 1.02, boxShadow: "0 12px 40px rgba(234,179,8,0.35)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              Panel Admin
            </Motion.button>
          )}
          <Motion.button
            ref={adminButtonRef}
            className="btn-profile-modern"
            onClick={() => onOpenAdminMenu?.()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              {/* Avatar carré moderne */}
              <div className="profile-avatar-modern">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
                ) : (
                  <FiUser className="text-base text-white" />
                )}
              </div>
              
              {/* Nom et Badge */}
              <div className="flex flex-col items-start gap-1">
                <span className="profile-username">{currentUser?.username || 'admin'}</span>
                {currentUser?.isAdmin ? (
                  <span className="profile-badge profile-badge-admin">
                    <span className="profile-badge-dot"></span>
                    Admin
                  </span>
                ) : currentUser?.isVip ? (
                  <span className="profile-badge profile-badge-vip">
                    <span className="profile-badge-dot"></span>
                    VIP
                  </span>
                ) : currentUser?.isBoost ? (
                  <span className="profile-badge profile-badge-boost">
                    <span className="profile-badge-dot"></span>
                    BOOST
                  </span>
                ) : (
                  <span className="profile-badge profile-badge-free">
                    Gratuit
                  </span>
                )}
              </div>
              
              {/* Chevron moderne */}
              <svg className="profile-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </Motion.button>
          <Motion.button 
            className="window-icon"
            whileHover={{ scale: 1.05, backgroundColor: "rgba(124, 58, 237, 0.2)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <FiBell />
          </Motion.button>
        </div>
    </Motion.div>
  )
})


