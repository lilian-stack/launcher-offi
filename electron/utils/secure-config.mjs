/**
 * Module de gestion sécurisée des secrets avec keytar
 * Utilise le Gestionnaire d'identifiants Windows natif
 * 
 * Les secrets sensibles (DISCORD_CLIENT_SECRET, DISCORD_TOKEN) sont stockés
 * de manière sécurisée dans le coffre-fort système plutôt que dans un fichier .env
 */

import keytar from 'keytar'
import electron from 'electron';
const { app } = electron
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { log, errorLog } from './logger.mjs'

// Nom du service dans le gestionnaire d'identifiants
const SERVICE_NAME = 'ActorisLauncher'

// Liste des secrets sensibles à stocker dans keytar
const SENSITIVE_SECRETS = [
  'DISCORD_CLIENT_SECRET',
  'DISCORD_TOKEN'
]

// Variables non sensibles qui peuvent rester dans .env
const PUBLIC_VARS = [
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'DISCORD_ROLE_MEMBER',
  'DISCORD_ROLE_VIP',
  'DISCORD_ROLE_BOOST',
  'DISCORD_ROLE_ADMIN',
  'PORT',
  'WS_PORT',
  'DISCORD_REDIRECT_URI',
  'API_URL',
  'WS_URL',
  'NODE_ENV'
]

/**
 * Classe de gestion sécurisée des secrets
 */
class SecureConfig {
  constructor() {
    this.envPath = path.join(app.getPath('userData'), '.env')
    this.migrated = false
  }

  /**
   * Récupérer un secret depuis keytar
   */
  async getSecret(key) {
    try {
      const value = await keytar.getPassword(SERVICE_NAME, key)
      return value || null
    } catch (err) {
      errorLog(`[SecureConfig] ❌ Erreur lors de la récupération de ${key}:`, err.message)
      return null
    }
  }

  /**
   * Sauvegarder un secret dans keytar
   */
  async setSecret(key, value) {
    try {
      if (!value || value.trim() === '') {
        // Supprimer le secret s'il est vide
        await keytar.deletePassword(SERVICE_NAME, key)
        log(`[SecureConfig] ✅ Secret ${key} supprimé`)
        return true
      }
      
      await keytar.setPassword(SERVICE_NAME, key, value.trim())
      log(`[SecureConfig] ✅ Secret ${key} sauvegardé avec succès`)
      return true
    } catch (err) {
      errorLog(`[SecureConfig] ❌ Erreur lors de la sauvegarde de ${key}:`, err.message)
      return false
    }
  }

  /**
   * Migrer les secrets depuis le .env vers keytar
   */
  async migrateFromEnv() {
    if (this.migrated) {
      return true
    }

    try {
      if (!fs.existsSync(this.envPath)) {
        log('[SecureConfig] ℹ️  Aucun fichier .env à migrer')
        this.migrated = true
        return true
      }

      log('[SecureConfig] 🔄 Migration des secrets depuis .env vers keytar...')
      
      // Charger le .env
      const result = dotenv.config({ path: this.envPath })
      if (result.error) {
        errorLog('[SecureConfig] ❌ Erreur lors du chargement du .env pour migration:', result.error)
        return false
      }

      let migratedCount = 0

      // Migrer chaque secret sensible
      for (const secretKey of SENSITIVE_SECRETS) {
        const value = process.env[secretKey]
        
        if (value && value.trim() !== '') {
          // Vérifier si le secret existe déjà dans keytar
          const existing = await this.getSecret(secretKey)
          
          if (!existing) {
            // Migrer seulement si n'existe pas déjà dans keytar
            await this.setSecret(secretKey, value)
            migratedCount++
            log(`[SecureConfig] ✅ ${secretKey} migré vers keytar`)
          } else {
            log(`[SecureConfig] ℹ️  ${secretKey} existe déjà dans keytar, ignoré`)
          }
        }
      }

      log(`[SecureConfig] ✅ Migration terminée: ${migratedCount} secret(s) migré(s)`)
      this.migrated = true
      return true
    } catch (err) {
      errorLog('[SecureConfig] ❌ Erreur lors de la migration:', err)
      return false
    }
  }

  /**
   * Charger toutes les variables d'environnement (secrets depuis keytar + autres depuis .env)
   */
  async loadAllEnvVars() {
    try {
      const envVars = {}

      // 1. Charger les variables publiques depuis .env
      if (fs.existsSync(this.envPath)) {
        const result = dotenv.config({ path: this.envPath })
        if (!result.error) {
          // Ne copier que les variables publiques
          for (const key of PUBLIC_VARS) {
            if (process.env[key]) {
              envVars[key] = process.env[key]
            }
          }
        }
      }

      // 2. Charger les secrets sensibles depuis keytar
      for (const secretKey of SENSITIVE_SECRETS) {
        const value = await this.getSecret(secretKey)
        if (value) {
          envVars[secretKey] = value
        }
      }

      // 3. Définir des valeurs par défaut si nécessaire
      if (!envVars.DISCORD_CLIENT_ID) {
        envVars.DISCORD_CLIENT_ID = '1398485031189483642'
      }
      if (!envVars.PORT) {
        envVars.PORT = '3001'
      }
      if (!envVars.WS_PORT) {
        envVars.WS_PORT = '8080'
      }
      if (!envVars.DISCORD_REDIRECT_URI) {
        envVars.DISCORD_REDIRECT_URI = 'http://localhost:5173/auth/callback'
      }
      if (!envVars.API_URL) {
        envVars.API_URL = 'http://127.0.0.1:3001'
      }
      if (!envVars.WS_URL) {
        envVars.WS_URL = 'ws://127.0.0.1:8080'
      }
      if (!envVars.NODE_ENV) {
        envVars.NODE_ENV = 'production'
      }

      log('[SecureConfig] ✅ Variables d\'environnement chargées')
      return envVars
    } catch (err) {
      errorLog('[SecureConfig] ❌ Erreur lors du chargement des variables:', err)
      return {}
    }
  }

  /**
   * Vérifier si keytar est disponible
   */
  async isAvailable() {
    try {
      // Test simple pour vérifier que keytar fonctionne
      await keytar.getPassword(SERVICE_NAME, '__test__')
      return true
    } catch (err) {
      errorLog('[SecureConfig] ⚠️  keytar non disponible:', err.message)
      return false
    }
  }
}

// Instance singleton
const secureConfig = new SecureConfig()

/**
 * Initialiser le système de configuration sécurisée
 */
export async function initializeSecureConfig() {
  try {
    log('[SecureConfig] 🔐 Initialisation du système de configuration sécurisée...')
    
    // Vérifier que keytar est disponible
    const available = await secureConfig.isAvailable()
    if (!available) {
      errorLog('[SecureConfig] ⚠️  keytar non disponible, utilisation du .env classique')
      return false
    }

    // Migrer les secrets existants depuis .env
    await secureConfig.migrateFromEnv()

    log('[SecureConfig] ✅ Système de configuration sécurisée initialisé')
    return true
  } catch (err) {
    errorLog('[SecureConfig] ❌ Erreur lors de l\'initialisation:', err)
    return false
  }
}

/**
 * Obtenir toutes les variables d'environnement (secrets depuis keytar + autres depuis .env)
 */
export async function getAllEnvVars() {
  return await secureConfig.loadAllEnvVars()
}

/**
 * Récupérer un secret depuis keytar
 */
export async function getSecret(key) {
  return await secureConfig.getSecret(key)
}

/**
 * Sauvegarder un secret dans keytar
 */
export async function setSecret(key, value) {
  return await secureConfig.setSecret(key, value)
}

export default secureConfig
