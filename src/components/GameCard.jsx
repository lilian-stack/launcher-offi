import { memo, useMemo, useCallback } from 'react'
import { motion as Motion } from 'framer-motion'
import { FiGrid, FiDownload, FiHeart } from 'react-icons/fi'
import { useCachedImage } from '../hooks/useCachedImage'

export const GameCard = memo(function GameCard({
  game,
  index = 0,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  installedGame,
}) {
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

  const handleCardClick = useCallback(() => {
    if (typeof onClick === 'function') {
      onClick(game)
    }
  }, [game, onClick])

  const handleFavorite = useCallback((event) => {
    event?.stopPropagation()
    event?.preventDefault()
    if (typeof onToggleFavorite === 'function') {
      onToggleFavorite(game.id)
    }
  }, [game, onToggleFavorite])

  return (
    <Motion.div
      key={game.id || index}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -8, scale: 1.02 }}
      onClick={handleCardClick}
      className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 backdrop-blur-xl transition-all duration-500 cursor-pointer hover:border-white/10 hover:bg-white/8 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-2"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }}
    >
      <div className="absolute top-4 left-4 z-20">
        <Motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(index * 0.02 + 0.1, 0.3), type: 'spring', stiffness: 200 }}
          className="relative group/badge"
        >
          <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl border shadow-2xl overflow-hidden ${
            isInstalled
              ? 'bg-emerald-500/20 border-emerald-400/30'
              : 'bg-black/60 border-white/10'
          }`}>
            <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/badge:translate-x-full transition-transform duration-1000 ease-in-out ${
              isInstalled ? 'via-emerald-400/20' : ''
            }`} />

            <div className="relative flex items-center gap-1.5">
              {isInstalled ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-300 tracking-wide">Installé</span>
                </>
              ) : (
                <div className="p-1 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-400/30">
                  <FiDownload className="text-xs text-purple-300" />
                </div>
              )}
            </div>
          </div>
        </Motion.div>
      </div>

      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-black/60 to-black/80 rounded-t-3xl">
        {cachedCover ? (
          <>
            <img
              src={cachedCover}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <div className="hidden absolute inset-0 flex items-center justify-center bg-black/30">
              <FiGrid className="text-muted text-4xl" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-muted/40 to-surface-muted/20">
            <FiGrid className="text-muted text-5xl opacity-50" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:via-primary/5 group-hover:to-primary/0 transition-all duration-500 pointer-events-none" />

        <Motion.button
          onClick={handleFavorite}
          className={`absolute top-3 right-3 p-2.5 rounded-xl backdrop-blur-md border transition-all z-30 ${
            isFavorite
              ? 'opacity-100 bg-red-500/20 border-red-500/30 text-red-400'
              : 'opacity-0 group-hover:opacity-100 bg-black/40 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/30'
          }`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          style={{ pointerEvents: 'auto' }}
        >
          <FiHeart className={`text-sm ${isFavorite ? 'fill-current' : ''}`} />
        </Motion.button>
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-3xl -m-6" />
          <h3 className="relative font-semibold text-lg text-white drop-shadow-lg">
            {title}
          </h3>
        </div>
      </div>

      <div className="absolute inset-0 rounded-3xl border border-primary/0 group-hover:border-primary/20 transition-all duration-500 pointer-events-none" />
    </Motion.div>
  )
})



