/**
 * Service pour fusionner les données des jeux installés dans les jeux du catalogue
 * Évite les doublons en mettant à jour les jeux existants au lieu de créer de nouvelles entrées
 */

/**
 * Normalise un nom de jeu pour la comparaison
 * IMPORTANT: Cette fonction doit produire des résultats UNIQUES pour chaque nom différent
 */
function normalizeGameName(name) {
  if (!name || typeof name !== 'string') return ''
  
  // Normaliser : minuscules, supprimer espaces multiples, supprimer caractères spéciaux
  // Utiliser \w qui correspond aux caractères alphanumériques et underscore (ASCII uniquement)
  let normalized = name.toLowerCase().trim()
    .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul espace
    .replace(/[^\w\s]/g, '') // Supprimer les caractères non-alphanumériques (garde les espaces)
    .replace(/\s/g, '') // Supprimer tous les espaces restants
  
  // Protection : si le nom normalisé est vide ou trop court, retourner une valeur unique
  // pour éviter les correspondances accidentelles
  if (normalized.length < 3) {
    // Retourner une valeur unique basée sur le nom original pour éviter les collisions
    // Utiliser un hash simple du nom original
    const hash = name.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0)
    }, 0)
    return `__INVALID_${Math.abs(hash)}__`
  }
  
  return normalized
}

/**
 * Trouve un jeu installé correspondant à un jeu du catalogue
 * CORRESPONDANCE ULTRA-STRICTE : Seulement par ID exact ou nom normalisé identique
 */
function findMatchingInstalledGame(catalogGame, installedGames) {
  if (!catalogGame || !installedGames || installedGames.length === 0) return null
  
  const catalogOriginalName = catalogGame.name || catalogGame.title || ''
  if (!catalogOriginalName || catalogOriginalName.trim().length === 0) {
    return null // Pas de nom = pas de correspondance possible
  }
  
  const catalogName = normalizeGameName(catalogOriginalName)
  
  // Protection : ignorer les noms normalisés invalides ou trop courts
  if (!catalogName || catalogName.startsWith('__INVALID_') || catalogName.length < 3) {
    return null
  }
  
  // ✅ ÉTAPE 1 : Chercher par ID d'abord (correspondance la plus fiable)
  if (catalogGame.id || catalogGame.gameId) {
    const catalogId = catalogGame.id || catalogGame.gameId
    const byId = installedGames.find(ig => {
      const installedId = ig.gameId || ig.id
      return installedId && (installedId === catalogId || String(installedId) === String(catalogId))
    })
    if (byId) {
      return byId
    }
  }
  
  // ✅ ÉTAPE 2 : Chercher par nom normalisé - CORRESPONDANCE EXACTE UNIQUEMENT
  
  for (const installedGame of installedGames) {
    const installedOriginalName = installedGame.name || installedGame.gameName || installedGame.title || ''
    
    // Ignorer si le nom installé est vide
    if (!installedOriginalName || installedOriginalName.trim().length === 0) {
      continue
    }
    
    const installedName = normalizeGameName(installedOriginalName)
    
    // Protection : ignorer les noms normalisés invalides ou trop courts
    if (!installedName || installedName.startsWith('__INVALID_') || installedName.length < 3) {
      continue
    }
    
    // ✅ CORRESPONDANCE EXACTE : Les noms normalisés doivent être IDENTIQUES
    // Pas de correspondance partielle, pas de tolérance
    if (catalogName === installedName) {
      // Vérification supplémentaire : les noms normalisés doivent avoir une longueur raisonnable
      // et ne pas être des chaînes vides ou invalides
      if (catalogName.length >= 3 && installedName.length >= 3) {
        // Correspondance trouvée, retourner le jeu installé
        return installedGame
      }
    }
  }
  
  // Aucune correspondance trouvée
  return null
}

/**
 * Fusionne les données d'un jeu installé dans un jeu du catalogue
 */
function mergeInstalledData(catalogGame, installedGame) {
  if (!catalogGame || !installedGame) return catalogGame
  
  // Conserver l'ID original du catalogue (important pour la navigation)
  const originalId = catalogGame.id || catalogGame.gameId
  
  return {
    ...catalogGame,
    // S'assurer que l'ID du catalogue est toujours présent
    id: originalId,
    gameId: originalId,
    // Marquer comme installé
    isInstalled: true,
    // Données d'installation
    installFolder: installedGame.path || installedGame.gamePath || installedGame.folder || null,
    executable: installedGame.exePath || installedGame.executable || null,
    executableName: installedGame.executableName || null,
    installDate: installedGame.installDate || installedGame.install_date || null,
    installedVersion: installedGame.version || '1.0',
    launcherId: installedGame.launcherId || installedGame.id || null,
    hasCrkFile: true,
    // Conserver l'ID original du catalogue pour référence
    originalId: originalId,
    // Conserver le nom original du catalogue
    originalName: catalogGame.name || catalogGame.title
  }
}

/**
 * Fusionne les jeux installés dans la liste des jeux du catalogue
 * @param {Array} catalogGames - Liste des jeux du catalogue
 * @param {Array} installedGames - Liste des jeux installés
 * @returns {Array} Liste des jeux du catalogue avec les données d'installation fusionnées
 */
export function mergeInstalledGamesIntoCatalog(catalogGames, installedGames) {
  if (!catalogGames || catalogGames.length === 0) return []
  
  const resetGames = catalogGames.map(game => {
    // Créer une copie propre du jeu avec tous les champs d'installation réinitialisés
    const { isInstalled, hasCrkFile, launcherId, installFolder, executable, ...cleanGame } = game
    return {
      ...cleanGame,
      isInstalled: false,
      hasCrkFile: false,
      launcherId: null,
      installFolder: null,
      executable: null,
      executableName: null,
      installDate: null,
      installedVersion: null
    }
  })
  
  // ✅ ÉTAPE 2 : Si aucun jeu installé, retourner directement les jeux réinitialisés
  if (!installedGames || installedGames.length === 0) {
    return resetGames
  }
  
  // ✅ ÉTAPE 3 : Marquer SEULEMENT les jeux qui correspondent aux jeux installés détectés
  
  // Parcourir les jeux réinitialisés et marquer SEULEMENT ceux qui correspondent
  const mergedGames = resetGames.map(catalogGame => {
    const matchingInstalled = findMatchingInstalledGame(catalogGame, installedGames)
    
    if (matchingInstalled) {
      // Fusionner les données d'installation SEULEMENT pour ce jeu
      return mergeInstalledData(catalogGame, matchingInstalled)
    }
    
    // Jeu non installé, retourner tel quel (déjà réinitialisé à isInstalled: false)
    return catalogGame
  })
  
  return mergedGames
}

/**
 * Filtre les jeux installés depuis la liste du catalogue
 * @param {Array} catalogGames - Liste des jeux du catalogue (avec isInstalled)
 * @returns {Array} Liste des jeux installés uniquement
 */
export function getInstalledGamesFromCatalog(catalogGames) {
  if (!catalogGames || catalogGames.length === 0) {
    return []
  }
  
  // ✅ FILTRAGE ULTRA-STRICT : Filtrer UNIQUEMENT les jeux qui sont :
  // 1. Marqués comme installés (isInstalled === true) - OBLIGATOIRE
  // 2. Ont un fichier .crklauncheur (hasCrkFile === true) OU un launcherId (installé via le launcher) - OBLIGATOIRE
  // 3. Ont un dossier d'installation valide (non null, non vide, string) - OBLIGATOIRE
  const installed = catalogGames.filter(game => {
    // Vérification STRICTE de chaque condition
    const isInstalled = game.isInstalled === true // Doit être EXACTEMENT true
    const hasCrkFile = game.hasCrkFile === true // Doit être EXACTEMENT true
    const hasLauncherId = Boolean(game.launcherId) && game.launcherId !== null && game.launcherId !== ''
    const hasInstallFolder = Boolean(game.installFolder) && 
                            typeof game.installFolder === 'string' && 
                            game.installFolder.trim().length > 0
    
    // Toutes les conditions doivent être remplies
    return isInstalled && (hasCrkFile || hasLauncherId) && hasInstallFolder
  })
  
  return installed
}

