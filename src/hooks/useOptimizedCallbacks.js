import { useCallback, useRef } from 'react'

/**
 * Hook pour optimiser les callbacks et éviter les re-renders excessifs
 * OPTIMISATION CRITIQUE : Évite les recréations de fonctions
 */
export function useOptimizedCallbacks() {
  const callbacksRef = useRef({})

  const createOptimizedCallback = useCallback((key, callback, deps = []) => {
    // Créer une clé unique basée sur les dépendances
    const depsKey = deps.map(dep => 
      typeof dep === 'object' ? JSON.stringify(dep) : String(dep)
    ).join('|')
    
    const fullKey = `${key}:${depsKey}`
    
    // Réutiliser le callback si les dépendances n'ont pas changé
    if (!callbacksRef.current[fullKey]) {
      callbacksRef.current[fullKey] = callback
    }
    
    return callbacksRef.current[fullKey]
  }, [])

  return { createOptimizedCallback }
}