import { useState, useCallback } from 'react'

let toastIdCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((toast) => {
    const id = toast.id || `toast-${++toastIdCounter}`
    const newToast = {
      id,
      type: 'info',
      duration: 5000,
      autoClose: true,
      ...toast,
    }
    setToasts((prev) => [...prev, newToast])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message, options = {}) => {
    return showToast({ type: 'success', message, ...options })
  }, [showToast])

  const showError = useCallback((message, options = {}) => {
    return showToast({ type: 'error', message, duration: 7000, ...options })
  }, [showToast])

  const showInfo = useCallback((message, options = {}) => {
    return showToast({ type: 'info', message, ...options })
  }, [showToast])

  const showDownload = useCallback((message, action, options = {}) => {
    return showToast({
      type: 'download',
      message,
      action,
      duration: 10000,
      autoClose: false,
      ...options,
    })
  }, [showToast])

  return {
    toasts,
    showToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showDownload,
  }
}

