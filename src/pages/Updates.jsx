import { motion as Motion } from 'framer-motion'
import { FiRefreshCw } from 'react-icons/fi'

export function UpdatesPage() {
  return (
    <div className="space-y-16">
      <section className="home-hero">
        <Motion.div
          className="hero-logo"
          initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ 
            duration: 0.5,
            type: "spring",
            stiffness: 200,
            damping: 15
          }}
          whileHover={{ 
            scale: 1.05,
            rotate: 5,
            transition: { duration: 0.2 }
          }}
        >
          <FiRefreshCw />
        </Motion.div>
        <Motion.h1
          className="hero-heading"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
        >
          Vérifier les mises à jour
        </Motion.h1>
        <Motion.p
          className="hero-tagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
        >
          Connectez-vous à Internet ou ajoutez votre compte ACTORIS pour vérifier automatiquement la disponibilité des dernières versions du launcher.
        </Motion.p>
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
          className="hero-actions"
        >
          <Motion.button 
            className="btn btn-primary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <FiRefreshCw className="mr-2" />
            <span>Rechercher une mise à jour</span>
          </Motion.button>
        </Motion.div>
      </section>
    </div>
  )
}




