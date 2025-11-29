/**
 * Configuration des animations optimisées pour de meilleures performances
 * Utilise des transitions plus légères pour réduire la charge CPU/GPU
 */

// Transitions rapides et légères (pour les listes et cartes)
export const quickTransition = {
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1]
}

// Transitions moyennes (pour les modals et overlays)
export const mediumTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1]
}

// Transitions lentes (pour les animations importantes)
export const slowTransition = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1]
}

// Variantes d'animation pour les cartes de jeu
export const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: quickTransition
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: quickTransition
  },
  hover: {
    y: -4,
    transition: quickTransition
  }
}

// Variantes d'animation pour les pages
export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: mediumTransition
  },
  exit: { 
    opacity: 0, 
    y: -20,
    scale: 0.98,
    transition: quickTransition
  }
}

// Variantes d'animation pour les modals
export const modalVariants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
    y: 20
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: mediumTransition
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 20,
    transition: quickTransition
  }
}

// Variantes d'animation pour les listes (stagger)
export const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03, // Réduit de 0.05 à 0.03 pour plus de rapidité
      delayChildren: 0.1
    }
  }
}

// Variantes d'animation pour les éléments de liste
export const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: quickTransition
  }
}

// Configuration pour réduire les animations sur les appareils moins performants
export const shouldReduceMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Obtenir les variantes adaptées selon les préférences
export const getVariants = (variants) => {
  if (shouldReduceMotion()) {
    // Retourner des variantes minimales pour les utilisateurs qui préfèrent moins d'animations
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 }
    }
  }
  return variants
}

