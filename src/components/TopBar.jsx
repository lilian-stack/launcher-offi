import { forwardRef, useState, memo, useCallback, useRef, useEffect } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { FiSearch } from 'react-icons/fi'
import { useSearch } from '../contexts/SearchContext'
import { SearchResults } from './SearchResults'

export const TopBar = memo(forwardRef(({
  activePage,
  onOpenFilters,
  onOpenAdminMenu,
  currentUser,
  onNavigate,
  installedGames = [],
  adminButtonRef,
  showAdminMenu = false
}, ref) => {
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHovered, setSearchHovered] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const { searchQuery, updateSearchQuery } = useSearch()
  const searchWrapperRef = useRef(null)
  const searchInputRef = useRef(null)

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true)
    setShowResults(true)
  }, [])

  const handleSearchBlur = useCallback((e) => {
    if (searchWrapperRef.current && searchWrapperRef.current.contains(e.relatedTarget)) {
      return
    }
    setSearchFocused(false)
    setTimeout(() => setShowResults(false), 200)
  }, [])

  const handleSearchChange = useCallback((e) => {
    updateSearchQuery(e.target.value)
    setShowResults(true)
  }, [updateSearchQuery])

  const handleGameClick = useCallback((gameId) => {
    if (onNavigate) {
      onNavigate('game-details', gameId)
    }
    setShowResults(false)
    setSearchFocused(false)
  }, [onNavigate])

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

  const getRoleText = () => {
    if (currentUser?.isAdmin) return 'ADMIN'
    if (currentUser?.isVip) return 'VIP'
    if (currentUser?.isBoost) return 'BOOST'
    return 'GRATUIT'
  }

  const getRoleColor = () => {
    if (currentUser?.isAdmin) return '#ef4444'
    if (currentUser?.isVip) return '#f59e0b'
    if (currentUser?.isBoost) return '#3b82f6'
    return '#6366f1'
  }

  return (
    <header
      ref={ref}
      className="topbar"
      style={{
        position: 'relative',
        zIndex: 1001,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '12px 24px', // Padding normal
        background: 'rgba(15, 15, 20, 0.8)',
        borderBottom: 'none'
      }}
    >
      <div className="topbar-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        height: '100%'
      }}>
        {/* Barre de recherche expandable */}
        <div className="search-wrapper" ref={searchWrapperRef} style={{
          position: 'relative',
          flex: 1,
          maxWidth: '700px',
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div 
            className="search-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: searchFocused ? '11px 19px' : '12px',
              borderRadius: '16px',
              background: searchFocused ? 'rgba(26, 26, 32, 0.8)' : 'transparent',
              border: searchFocused 
                ? '2px solid #06b6d4' 
                : searchHovered 
                ? '1px solid rgba(255, 255, 255, 0.2)' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              width: searchFocused || searchQuery || searchHovered ? '100%' : '50px',
              maxWidth: searchFocused || searchQuery || searchHovered ? '500px' : '50px',
              overflow: 'hidden',
              cursor: searchFocused ? 'text' : 'pointer',
              boxShadow: searchFocused 
                ? '0 0 0 2px rgba(6, 182, 212, 0.3), 0 10px 40px rgba(6, 182, 212, 0.15)' 
                : 'none'
            }}
            onMouseEnter={() => setSearchHovered(true)}
            onMouseLeave={() => {
              if (!searchFocused && !searchQuery) {
                setSearchHovered(false)
              }
            }}
            onFocus={() => handleSearchFocus()}
            onBlur={handleSearchBlur}
            onClick={() => {
              if (!searchFocused && searchInputRef.current) {
                searchInputRef.current.focus()
              }
            }}
          >
            <div className="search-icon" style={{
              fontSize: '20px',
              color: searchFocused || searchHovered ? '#06b6d4' : '#6b7280',
              transition: 'all 0.3s ease',
              flexShrink: 0,
              minWidth: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FiSearch />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Rechercher un jeu..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'white',
                fontSize: '15px',
                letterSpacing: '0.3px',
                minWidth: 0,
                opacity: searchFocused || searchQuery || searchHovered ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s'
              }}
            />
            {searchFocused && (
              <div className="search-counter" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                opacity: 1,
                transform: 'scale(1)',
                transition: 'all 0.3s ease',
                minWidth: '30px'
              }}>
                <span className="counter-text" style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: 500
                }}>
                  {searchQuery.length}
                </span>
                <div className="counter-dot" style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#06b6d4',
                  animation: 'pulse-dot 2s ease-in-out infinite'
                }} />
              </div>
            )}
          </div>

          {/* Résultats de recherche */}
          <AnimatePresence>
            {showResults && searchQuery && (
              <Motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  zIndex: 1000
                }}
              >
                <SearchResults
                  query={searchQuery}
                  onGameClick={handleGameClick}
                  installedGames={installedGames}
                />
              </Motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profil */}
        <button
          ref={adminButtonRef}
          onClick={() => onOpenAdminMenu?.()}
          className={`profile-card ${showAdminMenu ? 'active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            borderRadius: '16px',
            background: 'transparent',
            border: showAdminMenu 
              ? '1px solid rgba(99, 102, 241, 0.6)' 
              : '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            outline: 'none',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!showAdminMenu) {
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }
          }}
          onMouseLeave={(e) => {
            if (!showAdminMenu) {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.transform = 'translateY(0)'
            }
          }}
        >
          <div className="avatar-wrapper" style={{ position: 'relative' }}>
            {currentUser?.avatar ? (
              <img 
                src={currentUser.avatar} 
                alt={currentUser.username}
                className="profile-avatar user-avatar"
                data-vip={currentUser?.isVip}
                data-admin={currentUser?.isAdmin}
                data-boost={currentUser?.isBoost}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div 
                className="profile-avatar user-avatar" 
                data-vip={currentUser?.isVip}
                data-admin={currentUser?.isAdmin}
                data-boost={currentUser?.isBoost}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: 'white',
                  fontWeight: 600,
                  transition: 'all 0.3s'
                }}
              >
                {currentUser?.username?.[0]?.toUpperCase() || 'I'}
              </div>
            )}
            {currentUser && !currentUser.isGuest && (
              <div 
                className="status-indicator online-indicator" 
                data-status="online"
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '12px',
                  height: '12px',
                  background: '#10b981',
                  border: '2px solid #0a0a0f',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
                }} 
              />
            )}
          </div>
          <div className="profile-info" style={{
            flex: 1,
            textAlign: 'left'
          }}>
            <div 
              className="profile-name username user-name" 
              data-username={currentUser?.username}
              style={{
                color: '#f8fafc',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '2px'
              }}
            >
              {currentUser?.username || 'Invité'}
            </div>
            <div 
              className={`profile-role ${currentUser?.isVip ? 'vip-badge' : ''} ${currentUser?.isAdmin ? 'admin-badge' : ''} ${currentUser?.isBoost ? 'boost-badge' : ''}`}
              style={{
                color: getRoleColor(),
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {getRoleText()}
            </div>
          </div>
          <div className="chevron" style={{
            color: showAdminMenu ? '#6366f1' : 'rgba(255, 255, 255, 0.4)',
            fontSize: '14px',
            transition: 'all 0.3s',
            transform: showAdminMenu ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▼
          </div>
        </button>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `}</style>
    </header>
  )
}))

TopBar.displayName = 'TopBar'