import { useState, useEffect, useMemo } from 'react'

/**
 * Hook pour rendre les éléments par batch et éviter les Long Tasks
 * OPTIMISATION CRITIQUE : Évite de bloquer le thread principal
 */
export function useBatchedRender(items, batchSize = 20, delay = 16) {
  const [renderedCount, setRenderedCount] = useState(batchSize)

  // Réinitialiser quand les items changent
  useEffect(() => {
    setRenderedCount(batchSize)
  }, [items, batchSize])

  // Augmenter progressivement le nombre d'éléments rendus
  useEffect(() => {
    if (renderedCount < items.length) {
      const timeoutId = setTimeout(() => {
        setRenderedCount(prev => Math.min(prev + batchSize, items.length))
      }, delay)

      return () => clearTimeout(timeoutId)
    }
  }, [renderedCount, items.length, batchSize, delay])

  // Retourner seulement les éléments à rendre
  const visibleItems = useMemo(() => 
    items.slice(0, renderedCount), 
    [items, renderedCount]
  )

  const hasMore = renderedCount < items.length

  return { visibleItems, hasMore, renderedCount }
}