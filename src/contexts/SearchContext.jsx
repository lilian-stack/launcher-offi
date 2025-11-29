import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const SearchContext = createContext(null)

export function SearchProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const debounceTimerRef = useRef(null)

  // Debounce de 300ms pour optimiser les performances
  const updateSearchQuery = useCallback((query) => {
    setSearchQuery(query)
    
    // Annuler le timer précédent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Si la query est vide, mettre à jour immédiatement (pas de debounce)
    if (!query || query.trim() === '') {
      setDebouncedSearchQuery('')
      return
    }
    
    // Créer un nouveau timer pour les requêtes non vides
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(query)
    }, 300)
  }, [])

  // Nettoyer le timer au démontage
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <SearchContext.Provider value={{ searchQuery, debouncedSearchQuery, updateSearchQuery }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return context
}

