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
        >
          <Motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#13131a] p-8 shadow-2xl"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Mise à jour {version}</h2>
              <p className="text-sm text-slate-300 mt-1">
                Voici les corrections et améliorations incluses dans cette version.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <ul className="list-disc pl-6 space-y-2">
                {displayNotes.map((n, i) => (
                  <li key={i} className="text-slate-200 text-sm">{n}</li>
                ))}
              </ul>
            </div>

            <div className="mt-8 space-y-3">
              {installerPath && (
                <div className="mb-3 text-xs text-slate-300 break-all">
                  Fichier téléchargé: {installerPath}
                </div>
              )}
              <div className="flex gap-3">
                {installerPath && (
                  <Motion.button
                    onClick={handleInstall}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="button-primary flex-1 justify-center flex items-center gap-2"
                  >
                    <FiDownload />
                    Installer maintenant
                  </Motion.button>
                )}
                <Motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`button-secondary ${installerPath ? 'flex-1' : 'w-full'} justify-center flex items-center gap-2`}
                >
                  <FiX />
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


