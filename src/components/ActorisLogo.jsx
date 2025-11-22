import { motion } from 'framer-motion'

export function ActorisLogo({ className = '', size = 'default', showText = true }) {
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16'
  }
  
  const textSizes = {
    small: 'text-xs',
    default: 'text-sm',
    large: 'text-base'
  }
  
  return (
    <motion.div
      className={`actoris-logo flex flex-col items-center ${className}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
    >
      {/* Logo ACTORIS depuis l'image */}
      <motion.div 
        className={`relative ${sizeClasses[size]} flex items-center justify-center`}
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.2 }}
      >
        <img 
          src="/actoris-logo.png" 
          alt="ACTORIS Logo"
          className="w-full h-full object-contain rounded-xl"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.6)) drop-shadow(0 0 16px rgba(139, 92, 246, 0.3))'
          }}
          onError={(e) => {
            // Fallback si l'image ne charge pas
            console.error('Erreur de chargement du logo ACTORIS')
            e.target.style.display = 'none'
          }}
        />
        {/* Effet de brillance animé */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear'
          }}
          style={{
            mixBlendMode: 'overlay'
          }}
        />
      </motion.div>
      {/* Texte ACTORIS (optionnel, car déjà dans l'image) */}
      {showText && (
        <div 
          className={`${textSizes[size]} font-bold text-purple-400 mt-1 tracking-wider`}
          style={{
            textShadow: '0 0 10px rgba(139, 92, 246, 0.5), 0 0 20px rgba(139, 92, 246, 0.3)',
            letterSpacing: '0.15em'
          }}
        >
          ACTORIS
        </div>
      )}
    </motion.div>
  )
}

