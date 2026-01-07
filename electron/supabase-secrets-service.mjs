/**
 * Service pour charger les secrets Discord depuis Supabase
 * Remplace le fichier .env pour une meilleure sécurité
 */

import { createClient } from '@supabase/supabase-js'
import { SUPABASE_CONFIG } from './supabase-config.mjs'

const SUPABASE_URL = SUPABASE_CONFIG.URL
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.ANON_KEY

// Initialiser le client Supabase avec la clé anonyme (lecture seule)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Charge tous les secrets depuis Supabase
 * @returns {Promise<{success: boolean, secrets?: Object, error?: string}>}
 */
export async function loadSecretsFromSupabase() {
  try {
    console.log('\n🔍 [SUPABASE] Chargement des secrets Discord...')
    console.log(`📡 [SUPABASE] URL: ${SUPABASE_URL}`)

    // Récupérer tous les secrets depuis Supabase
    const { data, error } = await supabase
      .from('app_secrets')
      .select('key, value')

    if (error) {
      console.error('❌ [SUPABASE] Erreur lors du chargement:', error.message)
      console.error('   Code:', error.code)
      console.error('   Détails:', error.details)
      
      // Si la table n'existe pas, suggérer de créer la table
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.error('\n⚠️  [SUPABASE] La table app_secrets n\'existe pas!')
        console.error('   Exécutez le script SQL: scripts/supabase/create-app-secrets-table.sql')
      }
      
      return { success: false, error: error.message }
    }

    if (!data || data.length === 0) {
      console.error('❌ [SUPABASE] Aucun secret trouvé dans la table app_secrets')
      console.error('   Vérifiez que les secrets sont bien insérés dans Supabase')
      return { success: false, error: 'Aucun secret trouvé' }
    }

    console.log(`✅ [SUPABASE] ${data.length} secrets récupérés`)

    // Charger les secrets dans process.env
    const secrets = {}
    let loadedCount = 0
    
    for (const secret of data) {
      process.env[secret.key] = secret.value
      secrets[secret.key] = secret.value
      loadedCount++
      
      // Masquer les valeurs sensibles dans les logs
      const isSecret = secret.key.includes('SECRET') || secret.key.includes('TOKEN')
      const displayValue = isSecret 
        ? (secret.value ? `***masqué*** (${secret.value.length} chars)` : '(vide)')
        : (secret.value ? (secret.value.length > 30 ? secret.value.substring(0, 30) + '...' : secret.value) : '(vide)')
      
      const status = secret.value ? '✅' : '⚠️ '
      console.log(`   ${status} ${secret.key} = ${displayValue}`)
    }

    console.log(`\n✅ [SUPABASE] ${loadedCount} variables chargées avec succès\n`)

    // Vérifier les variables critiques Discord
    const criticalVars = {
      'DISCORD_CLIENT_ID': process.env.DISCORD_CLIENT_ID,
      'DISCORD_CLIENT_SECRET': process.env.DISCORD_CLIENT_SECRET,
      'DISCORD_TOKEN': process.env.DISCORD_TOKEN,
      'DISCORD_GUILD_ID': process.env.DISCORD_GUILD_ID
    }

    let missingCritical = false
    console.log('🔐 [SUPABASE] Vérification des secrets Discord:')
    
    for (const [key, value] of Object.entries(criticalVars)) {
      if (!value || value.trim() === '') {
        console.log(`   ❌ ${key} - MANQUANT ou VIDE`)
        missingCritical = true
      } else {
        const isSecret = key.includes('SECRET') || key.includes('TOKEN')
        console.log(`   ✅ ${key} - OK${isSecret ? ' (masqué)' : ''}`)
      }
    }

    if (missingCritical) {
      console.log('\n⚠️  [SUPABASE] ATTENTION: Des secrets Discord sont manquants!')
      console.log('    Vérifiez la table app_secrets dans Supabase')
      console.log('    Ou utilisez le fichier .env en fallback\n')
      return { success: false, error: 'Secrets critiques manquants', secrets }
    }

    console.log('')
    return { success: true, secrets }

  } catch (error) {
    console.error('❌ [SUPABASE] Erreur lors du chargement:', error.message)
    if (error.stack) {
      console.error('Stack:', error.stack)
    }
    return { success: false, error: error.message }
  }
}

/**
 * Vérifie si Supabase est accessible
 * @returns {Promise<boolean>}
 */
export async function checkSupabaseConnection() {
  try {
    const { error } = await supabase
      .from('app_secrets')
      .select('key')
      .limit(1)

    if (error && error.code === 'PGRST116') {
      // Table n'existe pas - c'est normal si pas encore créée
      return false
    }

    return !error
  } catch (error) {
    return false
  }
}

