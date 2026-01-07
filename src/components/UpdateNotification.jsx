import { useState, useEffect } from 'react'
import { Motion } from './Motion'
import { FiDownload, FiX } from 'react-icons/fi'

export function UpdateNotification({ updateInfo, onUpdate, onDismiss }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (updateInfo) {
      setIsVisible(true)
    }
  }, [updateInfo])

  if (!updateInfo || !isVisible) return null

  return (
    <Motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm"
    >
      <div className="flex items-start gap-3">
        <FiDownload className="text-xl mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-semibold mb-1">Mise à jour disponible</h4>
          <p className="text-sm opacity-90 mb-3">
            {updateInfo.changedFiles?.length} fichier(s) modifié(s) • {updateInfo.updateSize?.formatted}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onUpdate}
              className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Mettre à jour
            </button>
            <button
              onClick={() => {
                setIsVisible(false)
                onDismiss()
              }}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX />
            </button>
          </div>
        </div>
      </div>
    </Motion.div>
  )
}