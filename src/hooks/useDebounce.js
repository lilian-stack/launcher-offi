import { useState, useEffect } from 'react'

/**
 * Hook pour débouncer une valeur et éviter les recalculs excessifs
 * OPTIMISATION CRITIQUE : Évite les Long Tasks sur la recherche
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}