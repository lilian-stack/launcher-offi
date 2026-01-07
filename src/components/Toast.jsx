import { useEffect } from 'react'
import { Motion, AnimatePresence } from './Motion'
import { FiX, FiDownload, FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi'

const TOAST_DURATION = 5000 // 5 secondes par défaut

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast.autoClose !== false) {
      const timer = setTimeout(() => {
        onClose()
      }, toast.duration || TOAST_DURATION)
      return () => clearTimeout(timer)
    }
  }, [toast, onClose])

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <FiCheckCircle className="text-green-500" />
      case 'error':
        return <FiAlertCircle className="text-red-500" />
      case 'info':
        return <FiInfo className="text-blue-500" />
      case 'download':
        return <FiDownload className="text-primary" />
      default:
        return <FiInfo className="text-gray-500" />
    }
  }

  const getBgColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500/10 border-green-500/20'
      case 'error':
        return 'bg-red-500/10 border-red-500/20'
      case 'info':
        return 'bg-blue-500/10 border-blue-500/20'
      case 'download':
        return 'bg-primary/10 border-primary/20'
      default:
        return 'bg-gray-500/10 border-gray-500/20'
    }
  }

  return (
    <Motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed top-4 right-4 z-50 min-w-[320px] max-w-md p-4 rounded-lg shadow-lg border backdrop-blur-sm ${getBgColor()}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-sm font-semibold text-white mb-1">
              {toast.title}
            </h4>
          )}
          {toast.message && (
            <p className="text-sm text-gray-300">
              {toast.message}
            </p>
          )}
          {toast.action && (
            <div className="mt-3">
              {typeof toast.action === 'object' && toast.action.label ? (
                <button
                  onClick={toast.action.onClick}
                  className="text-primary hover:text-primary/80 underline text-sm font-medium"
                >
                  {toast.action.label}
                </button>
              ) : (
                toast.action
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </Motion.div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={() => onRemove(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

