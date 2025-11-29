import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiDownload, FiX } from 'react-icons/fi'

export function PatchNotes({ isOpen, onClose, version = 'v1.0.1', notes = [] , installerPath }) {
  const displayNotes = notes && notes.length ? notes : [
    "Améliorations diverses et corrections de bugs.",
  ]

  const handleInstall = async () => {
    if (!installerPath) return
    
    try {
      if (window.electron?.shell?.openPath) {
        await window.electron.shell.openPath(installerPath)
        // Fermer le launcher après avoir lancé l'installateur
        setTimeout(() => {
          if (window.electron?.app?.quit) {
            window.electron.app.quit()
          }
        }, 1000)
      } else {
        console.error('window.electron.shell.openPath non disponible')
        alert('Erreur: Impossible de lancer l\'installateur. Veuillez l\'ouvrir manuellement depuis: ' + installerPath)
      }
    } catch (error) {
      console.error('Erreur lors du lancement de l\'installateur:', error)
      alert('Erreur lors du lancement de l\'installateur. Veuillez l\'ouvrir manuellement depuis: ' + installerPath)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#13131a] to-[#0a0a0f] p-8 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                Notes de mise à jour {version}
              </h2>
              <p className="text-sm text-white/60 mt-2">
                Découvrez les dernières améliorations et corrections
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 max-h-[400px] overflow-y-auto">
              <ul className="space-y-3">
                {displayNotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-3 text-white/90 text-sm">
                    <span className="text-primary mt-1.5">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 space-y-3">
              {installerPath && (
                <div className="mb-3 text-xs text-white/50 break-all">
                  Fichier téléchargé: {installerPath}
                </div>
              )}
              <div className="flex gap-3">
                {installerPath && (
                  <Motion.button
                    onClick={handleInstall}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <FiDownload />
                    Installer maintenant
                  </Motion.button>
                )}
                <Motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`${installerPath ? 'flex-1' : 'w-full'} px-6 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-semibold hover:bg-white/20 hover:border-white/30 transition-all duration-300 flex items-center justify-center gap-2`}
                >
                  {installerPath ? 'Plus tard' : 'Compris'}
                </Motion.button>
              </div>
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  )
}

