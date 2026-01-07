/**
 * Composants d'animation légers pour remplacer Framer Motion
 * Utilise CSS animations au lieu de JavaScript (0 KiB vs ~400 KiB)
 * API compatible avec framer-motion pour migration facile
 */

import { useEffect, useRef, useState, forwardRef } from 'react'

/**
 * Factory pour créer des composants Motion (Motion.div, Motion.h1, etc.)
 * Compatible avec l'API framer-motion
 */
function createMotionComponent(elementType = 'div') {
  return forwardRef(function MotionComponent({ 
    children, 
    className = '', 
    initial, 
    animate, 
    exit,
    transition,
    whileHover,
    whileTap,
    style,
    layout, // Props spécifiques à framer-motion à filtrer
    layoutId,
    layoutDependency,
    layoutRoot,
    ...props 
  }, ref) {
    const [isVisible, setIsVisible] = useState(false)
    const elementRef = useRef(null)
    const actualRef = ref || elementRef

    useEffect(() => {
      // Démarrer l'animation après le montage
      requestAnimationFrame(() => {
        setIsVisible(true)
      })
    }, [])

    // Gérer les animations CSS
    const getAnimationClasses = () => {
      const classes = []
      
      if (initial?.opacity === 0 && animate?.opacity === 1) {
        classes.push('animate-fade-in')
      }
      
      if (initial?.y !== undefined && animate?.y === 0) {
        if (initial.y > 0) {
          classes.push('animate-slide-up')
        } else if (initial.y < 0) {
          classes.push('animate-slide-down')
        }
      }
      
      if (initial?.scale !== undefined && animate?.scale === 1) {
        classes.push('animate-scale-in')
      }
      
      if (whileHover) {
        classes.push('motion-hover')
      }
      
      if (whileTap) {
        classes.push('motion-tap')
      }
      
      return classes.join(' ')
    }

    const animationClass = getAnimationClasses()
    const duration = transition?.duration || 0.3
    const delay = transition?.delay || 0
    const ease = transition?.ease || 'ease'

    // Styles initiaux
    const initialStyle = {
      opacity: initial?.opacity !== undefined ? initial.opacity : 1,
      transform: [
        initial?.y !== undefined ? `translateY(${initial.y}px)` : null,
        initial?.scale !== undefined ? `scale(${initial.scale})` : null,
      ].filter(Boolean).join(' ') || 'none',
      ...style
    }

    // Styles animés
    const animatedStyle = {
      opacity: animate?.opacity !== undefined ? animate.opacity : 1,
      transform: [
        animate?.y !== undefined ? `translateY(${animate.y}px)` : null,
        animate?.scale !== undefined ? `scale(${animate.scale})` : null,
      ].filter(Boolean).join(' ') || 'none',
    }

    // Convertir ease array en string CSS
    let easeString = ease
    if (Array.isArray(ease)) {
      easeString = `cubic-bezier(${ease.join(', ')})`
    }

    const finalStyle = {
      ...initialStyle,
      ...(isVisible ? animatedStyle : {}),
      '--motion-duration': `${duration}s`,
      '--motion-delay': `${delay}s`,
      transition: `all ${duration}s ${easeString} ${delay}s`,
    }

    const Component = elementType

    return (
      <Component
        ref={actualRef}
        className={`${className} ${animationClass} ${isVisible ? 'motion-visible' : 'motion-hidden'}`}
        style={finalStyle}
        {...props}
      >
        {children}
      </Component>
    )
  })
}

// Créer les composants Motion pour tous les éléments HTML courants
export const Motion = {
  div: createMotionComponent('div'),
  span: createMotionComponent('span'),
  p: createMotionComponent('p'),
  h1: createMotionComponent('h1'),
  h2: createMotionComponent('h2'),
  h3: createMotionComponent('h3'),
  button: createMotionComponent('button'),
  section: createMotionComponent('section'),
  article: createMotionComponent('article'),
  nav: createMotionComponent('nav'),
  header: createMotionComponent('header'),
  footer: createMotionComponent('footer'),
  main: createMotionComponent('main'),
  aside: createMotionComponent('aside'),
  ul: createMotionComponent('ul'),
  ol: createMotionComponent('ol'),
  li: createMotionComponent('li'),
  img: createMotionComponent('img'),
  a: createMotionComponent('a'),
}

/**
 * AnimatePresence léger (remplace AnimatePresence de framer-motion)
 * En CSS pur, on n'a pas besoin de logique complexe
 */
export function AnimatePresence({ children, mode = 'wait' }) {
  return <>{children}</>
}

