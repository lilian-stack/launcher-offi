/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Fond principal - noir chaud et naturel
        background: '#0f0f14',
        sidebar: '#131318',
        surface: '#1a1a24',
        'surface-muted': '#1f1f2e',
        border: '#2a2a3a',
        // Couleurs primaires - naturelles et chaleureuses
        primary: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          dark: '#7c3aed',
          muted: 'rgba(139, 92, 246, 0.1)',
        },
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
        },
        // Couleurs de texte - douces et lisibles
        text: {
          DEFAULT: '#f8fafc',
          secondary: '#cbd5e1',
          muted: '#94a3b8',
        },
        // Couleurs fonctionnelles
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      boxShadow: {
        // Ombres douces et naturelles
        card: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        soft: '0 2px 12px rgba(0, 0, 0, 0.15)',
        glow: '0 0 20px rgba(139, 92, 246, 0.2)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },
  plugins: [],
}

