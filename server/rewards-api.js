/**
 * API pour gérer les récompenses (clés gratuites pour liens morts)
 */

import express from 'express'

const router = express.Router()

/**
 * POST /api/rewards/claim-free-key
 * Réclamer une clé gratuite après avoir trouvé un lien mort après les quêtes Lockr
 */
router.post('/claim-free-key', async (req, res) => {
  try {
    const { gameId, gameName, userId, username } = req.body

    if (!gameId && !gameName) {
      return res.status(400).json({
        success: false,
        error: 'gameId ou gameName requis'
      })
    }

    if (!userId && !username) {
      return res.status(400).json({
        success: false,
        error: 'userId ou username requis'
      })
    }

    // Vérifier si l'utilisateur a déjà réclamé une clé gratuite pour CE JEU SPÉCIFIQUE
    // Utiliser une combinaison userId + gameId pour permettre une clé par jeu
    const userIdentifier = userId || username
    const gameIdentifier = gameId || gameName
    const claimKey = `${userIdentifier}:${gameIdentifier}` // Clé unique par utilisateur ET par jeu
    
    // Vérifier dans un store en mémoire (pour cette session serveur)
    // En production, vous devriez utiliser Supabase ou une base de données
    if (!global.claimedFreeKeys) {
      global.claimedFreeKeys = new Set()
    }
    
    if (global.claimedFreeKeys.has(claimKey)) {
      console.log('[Rewards API] ⚠️ Utilisateur a déjà réclamé une clé gratuite pour ce jeu:', claimKey)
      return res.status(403).json({
        success: false,
        error: `Vous avez déjà réclamé une clé gratuite pour "${gameName}". Une seule clé gratuite est autorisée par jeu.`,
        alreadyClaimed: true
      })
    }

    // TODO: Implémenter la logique de génération et d'envoi de la clé
    // Exemples de ce que vous pourriez faire :
    // 1. Générer une clé unique (Steam key, Epic key, etc.)
    // 2. Stocker la clé dans une base de données avec l'userId
    // 3. Envoyer la clé à l'utilisateur via Discord DM ou email
    // 4. Logger l'événement pour suivi

    // Pour l'instant, on retourne juste un succès
    // Vous devrez implémenter la logique réelle selon votre système de clés
    
    console.log('[Rewards API] 🎁 Récompense réclamée:', {
      gameId,
      gameName,
      userId,
      username,
      timestamp: new Date().toISOString()
    })

    // Marquer que cet utilisateur a réclamé une clé pour ce jeu spécifique
    global.claimedFreeKeys.add(claimKey)
    console.log('[Rewards API] ✅ Utilisateur marqué comme ayant réclamé une clé pour ce jeu:', claimKey)

    // TODO: Générer et envoyer la clé
    // const freeKey = await generateFreeKey(userId, gameName)
    // await sendKeyToUser(userId, username, freeKey)

    res.json({
      success: true,
      message: 'Votre demande de clé gratuite a été enregistrée. Vous recevrez votre clé prochainement.',
      // freeKey: freeKey, // Décommenter quand la génération sera implémentée
      gameName,
      claimedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Rewards API] ❌ Erreur lors de la réclamation:', error)
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réclamation de la récompense'
    })
  }
})

export default router
