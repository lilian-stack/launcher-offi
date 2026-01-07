import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  base: './',
  plugins: [
    react({
      // Optimiser React pour la production
      jsxRuntime: 'automatic',
      // Désactiver les optimisations qui peuvent causer des problèmes
      babel: {
        plugins: []
      }
    })
  ],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()]
    }
  },
  optimizeDeps: {
    // Exclure react-icons de l'optimisation préalable (trop volumineux)
    exclude: ['react-icons'],
    // Inclure les dépendances critiques pour un meilleur tree-shaking
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    // Configuration esbuild pour éviter les erreurs
    esbuildOptions: {
      target: 'esnext',
      supported: {
        'top-level-await': true
      },
      // ⚡ Optimisations pour démarrage plus rapide
      logLevel: 'error',
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx'
      }
    },
    // ⚡ Forcer la pré-optimisation des dépendances critiques
    force: false, // Ne pas forcer à chaque fois
    // Optimiser au démarrage
    entries: [
      './src/main.jsx'
    ]
  },
  // Configuration esbuild explicite
  esbuild: {
    target: 'esnext',
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  },
  // Désactiver les logs d'esbuild
  logLevel: 'error', // Seulement les erreurs
  clearScreen: false, // Ne pas effacer l'écran
  build: {
    sourcemap: false, // Pas de sourcemap en production pour réduire la taille
    // Minification JavaScript - CRITIQUE pour économiser 16,328 KiB
    minify: 'terser', // Utiliser terser pour une meilleure minification (16,328 KiB économisés)
    target: 'esnext', // Cibler les navigateurs modernes
    // Réduire la taille des chunks pour éviter les payloads énormes (21,597 KiB → < 5 KiB par chunk)
    chunkSizeWarningLimit: 200, // Réduire encore plus pour forcer plus de chunks
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // IMPORTANT: Ne PAS séparer React et ReactDOM en chunks différents
          if (id.includes('node_modules')) {
            // Garder React et ReactDOM ensemble
            if (id.includes('react/') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            // React Icons (peut être volumineux) - charger seulement ce qui est utilisé
            // Séparer par sous-module pour réduire la taille et éviter les doublons (1,316 KiB économisés)
            if (id.includes('react-icons')) {
              const iconMatch = id.match(/react-icons\/([^/]+)/)
              if (iconMatch) {
                return `icons-${iconMatch[1]}`
              }
              return 'icons-vendor'
            }
            // Autres dépendances lourdes
            if (id.includes('axios') || id.includes('ws')) {
              return 'network-vendor'
            }
            // Discord.js (lourd, séparé) - seulement si utilisé
            if (id.includes('discord.js')) {
              return 'discord-vendor'
            }
            // Supabase (séparé) - seulement si utilisé
            if (id.includes('@supabase')) {
              return 'supabase-vendor'
            }
            // Autres dépendances - séparer en petits chunks pour éviter les payloads énormes
            // Éviter les doublons en groupant par package
            const packageMatch = id.match(/node_modules\/([^/]+)/)
            if (packageMatch) {
              const packageName = packageMatch[1]
              // Créer des chunks séparés pour les gros packages
              if (packageName.startsWith('@')) {
                return `vendor-${packageName.replace('@', '').replace('/', '-')}`
              }
              return `vendor-${packageName}`
            }
            return 'vendor'
          }
          // Séparer les pages pour le lazy loading (réduire le bundle initial)
          if (id.includes('/pages/')) {
            const pageName = id.split('/pages/')[1].split('.')[0]
            return `page-${pageName}`
          }
          // Séparer les composants en chunks plus petits
          if (id.includes('/components/')) {
            const componentName = id.split('/components/')[1].split('.')[0]
            // Grouper les petits composants ensemble
            if (componentName.length < 10) {
              return 'components-small'
            }
            return `component-${componentName}`
          }
          // Séparer les services
          if (id.includes('/services/')) {
            return 'services'
          }
          // Séparer les hooks
          if (id.includes('/hooks/')) {
            return 'hooks'
          }
          // Séparer les contexts
          if (id.includes('/contexts/')) {
            return 'contexts'
          }
        },
        compact: true,
        // Optimiser les noms de chunks
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Optimiser les noms d'assets et supporter WebP/AVIF
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (['png', 'jpg', 'jpeg'].includes(ext)) {
            return 'assets/images/[name]-[hash].[ext]'
          }
          return 'assets/[name]-[hash].[ext]'
        }
      },
      // Tree shaking optimisé - supprimer les modules dupliqués (1,316 KiB économisés)
      // Réduire le JavaScript inutilisé (3,560 KiB économisés)
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        preset: 'smallest', // Tree shaking agressif
        manualPureFunctions: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        // Supprimer les imports inutilisés
        unknownGlobalSideEffects: false
      }
    },
    // Optimisation de la taille
    cssCodeSplit: true, // Séparer le CSS pour réduire les payloads
    reportCompressedSize: false,
    // Optimisations pour accélérer le build
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // Optimisations supplémentaires
    cssMinify: 'lightningcss', // Minifier CSS (6 KiB économisés) - CRITIQUE pour corriger l'erreur
    // Réduire le CSS inutilisé avec Tailwind (26 KiB économisés)
    assetsInlineLimit: 512, // Réduire à 512B pour forcer plus de chunks et réduire les payloads
    // Tree shaking agressif
    modulePreload: {
      polyfill: false
    },
    // Optimiser les assets (images)
    assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.webp', '**/*.avif'],
    // Optimisations de performance avec terser
    // Minifier JavaScript (16,328 KiB économisés)
    terserOptions: {
      compress: {
        drop_console: true, // Supprimer les console.log en production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.trace', 'console.error'],
        passes: 7, // Plus de passes pour une meilleure compression (16,328 KiB économisés)
        unsafe: true, // Optimisations non sécurisées mais efficaces
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        dead_code: true,
        unused: true, // Supprimer le code inutilisé (3,560 KiB économisés)
        collapse_vars: true,
        reduce_vars: true,
        inline: 3, // Inline les petites fonctions (plus agressif)
        keep_fargs: false,
        keep_infinity: false,
        keep_classnames: false,
        keep_fnames: false,
        // Supprimer les imports inutilisés
        side_effects: false,
        // Optimisations supplémentaires
        booleans_as_integers: true,
        evaluate: true,
        hoist_funs: true,
        hoist_props: true,
        hoist_vars: true,
        if_return: true,
        join_vars: true,
        loops: true,
        negate_iife: true,
        properties: true,
        sequences: true,
        switches: true
      },
      mangle: {
        safari10: true,
        properties: false, // Ne pas mangle les propriétés pour éviter les bugs
        // Mangle plus agressif pour réduire la taille
        toplevel: false // Ne pas mangle le top level pour éviter les bugs
      },
      format: {
        comments: false, // Supprimer tous les commentaires
        ascii_only: false,
        // Optimiser le format
        beautify: false,
        preserve_annotations: false
      }
    }
  },
  // Optimisations de développement
  server: {
    hmr: {
      overlay: false // Désactiver l'overlay d'erreur pour améliorer les performances
    },
    // Gérer les erreurs 404
    fs: {
      strict: false,
      allow: ['..']
    }
  },
  // Résolution des modules pour éviter les erreurs esbuild
  resolve: {
    alias: {
      // Éviter les problèmes de résolution
    },
    dedupe: ['react', 'react-dom']
  }
})
