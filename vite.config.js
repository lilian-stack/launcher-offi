import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  base: './',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()]
    }
  },
  build: {
    sourcemap: false,
    minify: 'terser', // Minification en production pour réduire la taille
    terserOptions: {
      compress: {
        drop_console: true, // Supprimer tous les console.log en production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'] // Supprimer console.log et console.debug
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Séparer les dépendances node_modules de manière plus granulaire
          if (id.includes('node_modules')) {
            // React core (le plus critique)
            if (id.includes('react/') && !id.includes('react-dom')) {
              return 'react-core'
            }
            // React DOM
            if (id.includes('react-dom')) {
              return 'react-dom'
            }
            // Framer Motion (lourd, séparé)
            if (id.includes('framer-motion')) {
              return 'motion-vendor'
            }
            // React Icons (peut être volumineux)
            if (id.includes('react-icons')) {
              return 'icons-vendor'
            }
            // Autres dépendances lourdes
            if (id.includes('axios') || id.includes('ws')) {
              return 'network-vendor'
            }
            // Autres dépendances
            return 'vendor'
          }
          // Séparer les pages pour le lazy loading
          if (id.includes('/pages/')) {
            const pageName = id.split('/pages/')[1].split('.')[0]
            return `page-${pageName}`
          }
          // Séparer les composants
          if (id.includes('/components/')) {
            return 'components'
          }
          // Séparer les services
          if (id.includes('/services/')) {
            return 'services'
          }
        },
        compact: true,
        // Optimiser les noms de chunks
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Tree shaking moins agressif pour éviter de supprimer le code nécessaire
      treeshake: {
        moduleSideEffects: 'no-external', // Garder les side effects des modules internes
        propertyReadSideEffects: true, // Garder les propriétés lues
        tryCatchDeoptimization: false
      }
    },
    chunkSizeWarningLimit: 800, // Réduire la limite pour forcer plus de chunks
    // Optimisation de la taille
    target: 'esnext',
    cssCodeSplit: true,
    reportCompressedSize: false // Désactiver pour accélérer le build
  }
})
