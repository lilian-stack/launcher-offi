import { forwardRef, useState, memo, useCallback, useRef, useEffect } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiBell } from 'react-icons/fi'
import { FiSearch } from 'react-icons/fi'
import { FiUser } from 'react-icons/fi'
import { FiFilter } from 'react-icons/fi'
import { useSearch } from '../contexts/SearchContext'
import { SearchResults } from './SearchResults'

export const TopBar = memo(forwardRef(({ activePage, onOpenFilters, onOpenAdminMenu, currentUser, onNavigate, installedGames = [] }, adminButtonRef) => {
  const [searchFocused, setSearchFocused] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const { searchQuery, updateSearchQuery } = useSearch()
  const searchWrapperRef = useRef(null)
  
  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true)
    setShowResults(true)
  }, [])
  
  const handleSearchBlur = useCallback((e) => {
    // Ne pas fermer si on clique sur les résultats
    if (searchWrapperRef.current && searchWrapperRef.current.contains(e.relatedTarget)) {
      return
    }
    setSearchFocused(false)
    // Délai pour permettre le clic sur les résultats
    setTimeout(() => setShowResults(false), 200)
  }, [])
  
  const handleSearchChange = useCallback((e) => {
    updateSearchQuery(e.target.value)
    setShowResults(true)
  }, [updateSearchQuery])
  
  const handleGameClick = useCallback((gameId) => {
    if (onNavigate) {
      // Si onNavigate accepte deux paramètres (page, gameId)
      if (typeof onNavigate === 'function' && onNavigate.length >= 2) {
        onNavigate('game-details', gameId)
      } else {
        // Sinon, utiliser l'événement
        window.dispatchEvent(new CustomEvent('navigate', { 
          detail: { page: 'game-details', gameId } 
        }))
      }
    } else {
      window.dispatchEvent(new CustomEvent('navigate', { 
        detail: { page: 'game-details', gameId } 
      }))
    }
    setShowResults(false)
    setSearchFocused(false)
  }, [onNavigate])
  
  // Fermer les résultats si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowResults(false)
        setSearchFocused(false)
      }
    }
    
    if (showResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showResults])

  return (
    <Motion.div 
      className="topbar-shell"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
        <div className="search-wrapper relative" ref={searchWrapperRef}>
          <FiSearch className={`search-icon ${searchFocused ? 'text-primary' : ''}`} />
          <input
            type="text"
            placeholder="Rechercher un jeu..."
            className="hero-input"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {/* Résultats de recherche */}
          {showResults && (
            <SearchResults 
              installedGames={installedGames}
              onGameClick={handleGameClick}
            />
          )}
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
                <div className="flex items-center gap-2">
                  <span className="profile-username">{currentUser?.username || 'admin'}</span>
                  {currentUser?.isVip && (
                    <img 
                      src="/badge-vip.png" 
                      alt="VIP Badge" 
                      className="w-7 h-7 object-contain"
                      style={{ 
                        mixBlendMode: 'screen',
                        filter: 'brightness(1.1)'
                      }}
                    />
                  )}
                  {currentUser?.isBoost && !currentUser?.isVip && (
                    <img 
                      src="/badge-premium.png" 
                      alt="Premium Badge" 
                      className="w-7 h-7 object-contain"
                    />
                  )}
                </div>
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
}))


