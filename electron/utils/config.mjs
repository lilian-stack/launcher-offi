/**
 * Configuration centralisée
 */
import electron from 'electron';
const { app } = electron
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const isDev = !app.isPackaged || process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER === 'true'
export const isProduction = !isDev && app.isPackaged

export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

// Forcer IPv4 pour éviter les problèmes IPv6 vs IPv4 (::1 vs 127.0.0.1)
let API_URL = process.env.API_URL || 'http://127.0.0.1:3001'
// S'assurer que localhost est toujours remplacé par 127.0.0.1
if (API_URL.includes('localhost')) {
  API_URL = API_URL.replace('localhost', '127.0.0.1')
}

// Charger depuis websocket-config.json si disponible
try {
  const configPath = path.join(__dirname, '../websocket-config.json')
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    if (config.apiUrl) {
      API_URL = config.apiUrl
      // Forcer IPv4 même si le config contient localhost
      if (API_URL.includes('localhost')) {
        API_URL = API_URL.replace('localhost', '127.0.0.1')
      }
    }
  }
} catch (e) {
  console.warn('[Config] Failed loading websocket-config.json, using default API_URL')
}

export { API_URL }
