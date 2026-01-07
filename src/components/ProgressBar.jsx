import { Motion } from './Motion'
import { FiPause, FiPlay, FiX, FiDownload, FiPackage, FiFolder } from 'react-icons/fi'

function formatBytes(bytes) {
  if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatTime(seconds) {
  if (!seconds || seconds === Infinity || isNaN(seconds) || seconds < 0) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.round(seconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond === 0 || isNaN(bytesPerSecond)) return '0 B/s'
  return formatBytes(bytesPerSecond) + '/s'
}

export function ProgressBar({ 
  title, 
  progress = 0, 
  downloaded = 0, 
  total = 0, 
  speed = 0, 
  eta = 0,
  status = 'downloading', // 'downloading', 'extracting', 'paused', 'completed', 'error'
  onPause,
  onResume,
  onCancel,
  className = '',
  // Props pour l'extraction
  extractedBytes = 0,
  extractionTotal = 0,
  extractionSpeed = 0,
  extractionEta = 0,
  imageUrl = null, // URL de l'image du jeu
  installPath = null // Chemin d'installation choisi
}) {
  const isPaused = status === 'paused'
  const isExtracting = status === 'extracting'
  const isCompleted = status === 'completed' || status === 'extracted'
  const isError = status === 'error'

  // Calculer les valeurs d'affichage
  const displayProgress = Math.min(100, Math.max(0, progress))
  const displayTotal = total > 0 ? total : (downloaded > 0 ? downloaded / (progress / 100) : 0)
  const displayDownloaded = isExtracting ? extractedBytes : downloaded
  const displaySpeed = isExtracting ? extractionSpeed : speed
  const displayEta = isExtracting ? extractionEta : eta

  // Status display
  const getStatusInfo = () => {
    if (isError) return { text: 'Erreur', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }
    if (isCompleted) return { text: 'Terminé', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' }
    if (isPaused) return { text: 'En pause', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.3)' }
    if (isExtracting) return { text: 'Extraction en cours', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }
    return { text: 'Téléchargement actif', color: '#818cf8', bgColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.3)' }
  }

  const statusInfo = getStatusInfo()

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`download-card-modern ${className}`}
      style={{
        background: 'rgba(15, 15, 20, 0.85)',
        backdropFilter: 'blur(40px) saturate(180%)',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '40px',
        boxShadow: '0 30px 90px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset',
        position: 'relative',
        overflow: 'hidden',
        marginBottom: '24px'
      }}
    >
      {/* Top gradient line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5) 30%, rgba(236, 72, 153, 0.5) 70%, transparent)',
        opacity: 0.6
      }} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '40px',
        alignItems: 'start'
      }}>
        {/* Thumbnail Section */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '220px',
            height: '293px',
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(236, 72, 153, 0.1))'
          }}>
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                color: 'rgba(255, 255, 255, 0.3)'
              }}>
                🎮
              </div>
            )}
            
            {/* Size badge */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(20px)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 1
            }}>
              <div style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginBottom: '4px'
              }}>
                Taille totale
              </div>
              <div style={{
                fontSize: '18px',
                color: 'white',
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}>
                {formatBytes(displayTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '24px'
          }}>
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.5px',
                marginBottom: '8px',
                lineHeight: '1.2'
              }}>
                {title}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  letterSpacing: '0.3px',
                  background: statusInfo.bgColor,
                  border: `1px solid ${statusInfo.borderColor}`,
                  color: statusInfo.color
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: statusInfo.color,
                    animation: !isCompleted && !isPaused && !isError ? 'statusPulse 2s ease-in-out infinite' : 'none'
                  }} />
                  {statusInfo.text}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  <span>🎮</span>
                  PC • Launcher
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isCompleted && !isError && (
                <button
                  onClick={isPaused ? onResume : onPause}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    border: isPaused ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                    background: isPaused ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(74, 222, 128, 0.15))' : 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))',
                    color: isPaused ? '#4ade80' : '#fbbf24',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {isPaused ? <FiPlay /> : <FiPause />}
                </button>
              )}
              <button
                onClick={onCancel}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15))',
                  color: '#ef4444',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <FiX />
              </button>
            </div>
          </div>

          {/* Progress Section */}
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '16px'
            }}>
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {isExtracting ? 'Extraction' : 'Progression'}
              </span>
              <span style={{
                fontSize: '28px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-1px'
              }}>
                {Math.round(displayProgress)}%
              </span>
            </div>

            {/* Progress Track */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '20px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)'
            }}>
              <div
                style={{
                  height: '100%',
                  background: isExtracting 
                    ? 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 50%, #8b5cf6 100%)'
                    : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
                  backgroundSize: '200% 100%',
                  borderRadius: '14px',
                  position: 'relative',
                  width: `${displayProgress}%`,
                  transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: !isPaused && !isCompleted ? 'progressFlow 4s ease-in-out infinite' : 'none',
                  boxShadow: isExtracting 
                    ? '0 0 15px rgba(139, 92, 246, 0.3), 0 0 30px rgba(139, 92, 246, 0.1)'
                    : '0 0 15px rgba(59, 130, 246, 0.3), 0 0 30px rgba(59, 130, 246, 0.1)'
                }}
              >
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                  animation: !isPaused && !isCompleted ? 'progressShine 2s ease-in-out infinite' : 'none'
                }} />
              </div>

              {/* Progress Glow */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: `${displayProgress}%`,
                height: '40px',
                width: '100px',
                background: isExtracting 
                  ? 'radial-gradient(ellipse, rgba(139, 92, 246, 0.4), transparent)'
                  : 'radial-gradient(ellipse, rgba(99, 102, 241, 0.4), transparent)',
                filter: 'blur(20px)',
                pointerEvents: 'none',
                transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: 'translateX(-50%)'
              }} />
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '18px',
              padding: '20px',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginBottom: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818cf8'
              }}>
                📊
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                {isExtracting ? 'Extrait' : 'Téléchargé'}
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.5px'
              }}>
                {formatBytes(displayDownloaded)}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '18px',
              padding: '20px',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginBottom: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818cf8'
              }}>
                ⚡
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Vitesse
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.5px'
              }}>
                {formatSpeed(displaySpeed)}
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '18px',
              padding: '20px',
              transition: 'all 0.3s ease'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginBottom: '12px',
                background: 'rgba(99, 102, 241, 0.1)',
                color: '#818cf8'
              }}>
                ⏱
              </div>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                marginBottom: '8px'
              }}>
                Temps restant
              </div>
              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'white',
                letterSpacing: '-0.5px'
              }}>
                {isCompleted ? 'Terminé' : formatTime(displayEta)}
              </div>
            </div>
          </div>

          {/* Install Path */}
          {installPath && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}>
                <FiFolder />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: '600',
                  marginBottom: '6px'
                }}>
                  Dossier d'installation
                </div>
                <div style={{
                  fontSize: '14px',
                  fontFamily: "'SF Mono', 'Monaco', 'Cascadia Code', monospace",
                  color: 'rgba(255, 255, 255, 0.9)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {installPath}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes statusPulse {
          0%, 100% { 
            opacity: 1;
            box-shadow: 0 0 8px rgba(129, 140, 248, 0.8);
          }
          50% { 
            opacity: 0.4;
            box-shadow: 0 0 4px rgba(129, 140, 248, 0.4);
          }
        }

        @keyframes progressFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes progressShine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .download-card-modern button:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }

        .download-card-modern button:active {
          transform: translateY(0);
        }

        @media (max-width: 968px) {
          .download-card-modern > div {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </Motion.div>
  )
}
  const isError = status === 'error' || status === 'failed'
  
  const progressPercent = Math.min(100, Math.max(0, progress))
  
  // Utiliser les valeurs d'extraction si en cours d'extraction, sinon les valeurs de téléchargement
  const displayDownloaded = isExtracting && extractedBytes > 0 ? extractedBytes : downloaded
  const displayTotal = isExtracting && extractionTotal > 0 ? extractionTotal : total
  const displaySpeed = isExtracting && extractionSpeed > 0 ? extractionSpeed : speed
  const displayEta = isExtracting && extractionEta > 0 ? extractionEta : eta
  
  const downloadedGB = displayDownloaded > 0 ? displayDownloaded / (1024 * 1024 * 1024) : 0
  const totalGB = displayTotal > 0 ? displayTotal / (1024 * 1024 * 1024) : 0

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/5 to-white/3 backdrop-blur-xl p-5 shadow-xl ${className}`}
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
      }}
    >
      <div className="flex gap-5">
        {/* Image du jeu - Grande image à gauche */}
        {imageUrl ? (
          <div className="flex-shrink-0">
            <img 
              src={imageUrl} 
              alt={title}
              className="w-32 h-32 rounded-2xl object-cover border-2 border-white/20 shadow-lg"
              onError={(e) => {
                // Si l'image ne charge pas, cacher l'élément
                e.target.style.display = 'none'
              }}
            />
          </div>
        ) : (
          <div className={`w-32 h-32 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            isExtracting 
              ? 'bg-purple-500/20 border-2 border-purple-500/30' 
              : isCompleted
              ? 'bg-green-500/20 border-2 border-green-500/30'
              : isError
              ? 'bg-red-500/20 border-2 border-red-500/30'
              : 'bg-blue-500/20 border-2 border-blue-500/30'
          }`}>
            {isExtracting ? (
              <FiPackage className={`text-3xl ${
                isExtracting ? 'text-purple-400' : 'text-blue-400'
              }`} />
            ) : (
              <FiDownload className={`text-3xl ${
                isCompleted ? 'text-green-400' : isError ? 'text-red-400' : 'text-blue-400'
              }`} />
            )}
          </div>
        )}

        {/* Contenu principal à droite */}
        <div className="flex-1 min-w-0">
          {/* Header avec titre et actions */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold text-lg mb-1 truncate">{title}</h3>
              <p className="text-sm text-gray-400">
                {isExtracting ? 'Extraction en cours...' : isCompleted ? 'Terminé' : isError ? 'Erreur' : isPaused ? 'En pause' : 'Téléchargement en cours...'}
              </p>
            </div>
            
            {/* Actions */}
            {!isCompleted && !isError && (
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {isPaused ? (
                  <Motion.button
                    onClick={onResume}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 transition-all"
                  >
                    <FiPlay className="text-sm" />
                  </Motion.button>
                ) : (
                  <Motion.button
                    onClick={onPause}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 transition-all"
                  >
                    <FiPause className="text-sm" />
                  </Motion.button>
                )}
                <Motion.button
                  onClick={onCancel}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 transition-all"
                >
                  <FiX className="text-sm" />
                </Motion.button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="relative w-full h-3 bg-black/30 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              {/* Animated gradient progress */}
              <Motion.div
                className={`h-full rounded-full transition-all duration-300 ${
                  isExtracting
                    ? 'bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500'
                    : isCompleted
                    ? 'bg-gradient-to-r from-green-500 via-green-400 to-green-500'
                    : isError
                    ? 'bg-gradient-to-r from-red-500 via-red-400 to-red-500'
                    : 'bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
                animate={
                  !isPaused && !isCompleted && !isError
                    ? {
                        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                      }
                    : {}
                }
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                {/* Shine effect */}
                {!isPaused && !isCompleted && !isError && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                )}
              </Motion.div>
              
              {/* Percentage overlay */}
              {progressPercent > 5 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow-lg">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Chemin d'installation */}
          {installPath && (
            <div className="mb-4 rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 p-3">
              <p className="text-xs text-gray-400 mb-1">Emplacement d'installation</p>
              <p className="text-sm font-mono text-white truncate" title={installPath}>
                📁 {installPath}
              </p>
            </div>
          )}

          {/* Stats Grid - Détails pour téléchargement ET extraction */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Progress */}
            <div className="rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 p-3">
              <p className="text-xs text-gray-400 mb-1">
                {isExtracting ? 'Extrait' : 'Téléchargé'}
              </p>
              <p className="text-sm font-semibold text-white">
                {downloadedGB.toFixed(2)} / {totalGB.toFixed(2)} Go
              </p>
            </div>

            {/* Speed - Vitesse pour téléchargement, vitesse d'écriture pour extraction */}
            <div className="rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 p-3">
              <p className="text-xs text-gray-400 mb-1">
                {isExtracting ? 'Vitesse d\'écriture' : 'Vitesse de téléchargement'}
              </p>
              <p className="text-sm font-semibold text-white">
                {formatSpeed(displaySpeed)}
              </p>
            </div>

            {/* ETA - Temps restant */}
            <div className="rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 p-3">
              <p className="text-xs text-gray-400 mb-1">Temps restant</p>
              <p className="text-sm font-semibold text-white">
                {formatTime(displayEta)}
              </p>
            </div>

            {/* Percentage */}
            <div className="rounded-xl bg-black/20 backdrop-blur-sm border border-white/5 p-3">
              <p className="text-xs text-gray-400 mb-1">Pourcentage</p>
              <p className="text-sm font-semibold text-white">
                {Math.round(progressPercent)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </Motion.div>
  )
}

