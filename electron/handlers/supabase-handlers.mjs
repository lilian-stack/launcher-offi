/**
 * Handlers IPC pour Supabase
 */
import electron from 'electron';
const { ipcMain } = electron
import { log, errorLog } from '../utils/logger.mjs'

export function registerSupabaseHandlers() {
  ipcMain.handle('supabase:getUsers', async () => {
    try {
      log('[Supabase Users] Récupération des utilisateurs depuis Supabase...')
      const { getUsersFromSupabase } = await import('../supabase-users-service.mjs')
      const result = await getUsersFromSupabase()
      log('[Supabase Users] ✅ Utilisateurs récupérés:', result.users?.length || 0)
      return result
    } catch (err) {
      errorLog('[Supabase Users] ❌ Erreur lors de la récupération:', err)
      return { users: [] }
    }
  })
}
