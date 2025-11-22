import { motion as Motion } from 'framer-motion'
import { FiDownload } from 'react-icons/fi'

export function DownloadsPage() {
  return (
    <div className="empty-page">
      <Motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="empty-icon-wrapper"
      >
        <FiDownload className="empty-icon" />
      </Motion.div>
      <Motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        Pas de téléchargement en cours
      </Motion.h2>
      <Motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="empty-description"
      >
        Lancez un téléchargement depuis le catalogue ou importez un jeu pour suivre sa progression ici.
      </Motion.p>
      <Motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Motion.button 
          className="btn btn-primary mt-6"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          Accéder au catalogue
        </Motion.button>
      </Motion.div>
    </div>
  )
}
