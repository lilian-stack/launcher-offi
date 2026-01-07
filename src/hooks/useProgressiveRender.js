import { useState, useEffect } from 'react'

export function useProgressiveRender(items, batchSize = 20, delay = 16) {
  const [visibleCount, setVisibleCount] = useState(Math.min(batchSize, items.length))
  
  useEffect(() => {
    if (visibleCount >= items.length) return
    
    const timer = setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + batchSize, items.length))
    }, delay)
    
    return () => clearTimeout(timer)
  }, [visibleCount, items.length, batchSize, delay])
  
  // Reset quand les items changent
  useEffect(() => {
    setVisibleCount(Math.min(batchSize, items.length))
  }, [items, batchSize])
  
  return items.slice(0, visibleCount)
}