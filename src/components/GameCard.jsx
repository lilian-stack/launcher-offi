import { memo, forwardRef, useMemo, useCallback, useState, useEffect } from 'react'
import { Motion } from './Motion'
import { FiDownload, FiHeart, FiWifi, FiWifiOff } from 'react-icons/fi'
import { useCachedImage } from '../hooks/useCachedImage'
import { isGameOnline } from '../services/onlineFixStatus'
import { optimizeImageUrl, generateSrcSet, getOptimalImageWidth } from '../utils/imageOptimizer'

const GameCardComponent = forwardRef(function GameCard({
  game,
  index = 0,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  installedGame,
  variant = 'default', // 'default' ou 'large'
}, ref) {
  const coverUrl = useMemo(() => (
    game.coverImage ||
    game.cover_image ||
    game.header_image ||
    game.headerImage ||
    game.image
  ), [game])

  const cachedCover = useCachedImage(coverUrl)
  const title = game.name || game.title || 'Sans titre'
  const isInstalled = Boolean(installedGame)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (game.isOnline !== undefined) {
      setIsOnline(game.isOnline)
    } else if (game.id) {
      isGameOnline(game.id).then(setIsOnline).catch(() => setIsOnline(false))
    }
  }, [game])

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(game.id || game.gameId)
    }
  }, [onClick, game])

  const handleFavorite = useCallback((e) => {
    e.stopPropagation()
    if (onToggleFavorite) {
      onToggleFavorite(game.id || game.gameId)
    }
  }, [onToggleFavorite, game])

  return (
    <Motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ 
        delay: index * 0.03, 
        duration: 0.4,
        type: "spring",
        stiffness: 100
      }}
      onClick={handleClick}
      className="game-card-modern"
      whileHover={{ y: -12, scale: 1.03, rotateY: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Image avec bordures arrondies et effets modernes */}
      <div className={`game-card-modern-image ${
        variant === 'large' ? 'aspect-[3/4]' : 'aspect-video'
      }`}>
        {cachedCover ? (
          <>
            <img
              src={cachedCover}
              alt={title}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            {/* Overlay animé au survol avec nom et catégorie */}
            <div className="game-card-modern-overlay">
              <div className="game-card-modern-content">
                <h3 className="game-card-modern-title">{title}</h3>
                {game.category && (
                  <span className="badge-modern badge-modern-primary">
                    {game.category}
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="text-5xl mb-2"
            >
              🎮
            </Motion.div>
            <span className="text-xs text-gray-400 font-medium">{title}</span>
          </div>
        )}
        
        {/* Badges en haut à gauche avec animations */}
        <div className="game-card-modern-badges">
          {/* Badge statut online/offline avec point coloré */}
          {isOnline !== undefined && (
            <Motion.div
              whileHover={{ scale: 1.1 }}
              className={`game-card-modern-badge ${
                isOnline 
                  ? 'game-card-modern-badge-online' 
                  : 'game-card-modern-badge-offline'
              }`}
              title={isOnline ? 'Jeu en ligne disponible' : 'Jeu hors ligne uniquement'}
            >
              {/* Le point coloré est géré par CSS ::after */}
            </Motion.div>
          )}
          {/* Badge installé avec animation */}
          {isInstalled && (
            <Motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              className="game-card-modern-badge-installed"
              title="Jeu installé"
            >
              Installé
            </Motion.div>
          )}
        </div>

        {/* Favori en haut à droite avec animation */}
        <Motion.button
          onClick={handleFavorite}
          whileHover={{ scale: 1.15, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          className={`game-card-modern-favorite ${isFavorite ? 'active' : ''}`}
        >
          <Motion.div
            animate={isFavorite ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: isFavorite ? Infinity : 0, repeatDelay: 2 }}
          >
            <FiHeart className={`text-base ${isFavorite ? 'fill-current' : ''}`} />
          </Motion.div>
        </Motion.button>
      </div>
    </Motion.div>
  )
})

GameCardComponent.displayName = 'GameCard'

export const GameCard = memo(GameCardComponent)

