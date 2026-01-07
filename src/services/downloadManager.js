// URL du webhook Discord pour les notifications de liens non fonctionnels
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1452758100636471327/3qlU4NL03sv3Kk_hw7gQgTsCjrjI5xfdzMxUk4DlTBj3CJkZh-vRS-eyhniaCMv0aRvP'

// Fonction pour envoyer une notification Discord via webhook avec un embed amélioré
async function sendDiscordWebhook(gameName, errorMessage, gameId = null) {
  try {
    // Formater l'erreur de manière plus lisible
    const formattedError = errorMessage || 'Lien non fonctionnel'
    const errorType = formattedError.toLowerCase().includes('404') ? '404 - Not Found' :
                      formattedError.toLowerCase().includes('timeout') ? 'Timeout' :
                      formattedError.toLowerCase().includes('connection') ? 'Erreur de connexion' :
                      formattedError.toLowerCase().includes('interrupted') ? 'Téléchargement interrompu' :
                      'Erreur inconnue'

    // Couleur selon le type d'erreur
    const errorColor = formattedError.toLowerCase().includes('404') ? 16711680 : // Rouge vif
                       formattedError.toLowerCase().includes('timeout') ? 16776960 : // Jaune
                       formattedError.toLowerCase().includes('connection') ? 16753920 : // Orange
                       15158332 // Rouge par défaut

    const now = new Date()
    const dateStr = now.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `🔴 **Lien de téléchargement mort détecté**`,
        embeds: [
          {
            title: `🎮 ${gameName}`,
            description: `Un utilisateur a rencontré un problème lors du téléchargement de **${gameName}**.`,
            color: errorColor,
            fields: [
              {
                name: '📋 Type d\'erreur',
                value: `\`${errorType}\``,
                inline: true
              },
              {
                name: '🕐 Date',
                value: dateStr,
                inline: true
              },
              {
                name: '🆔 Game ID',
                value: gameId ? `\`${gameId}\`` : 'N/A',
                inline: true
              },
              {
                name: '💬 Message d\'erreur',
                value: formattedError.length > 1024 ? 
                  `\`\`\`${formattedError.substring(0, 1021)}...\`\`\`` : 
                  `\`\`\`${formattedError}\`\`\``,
                inline: false
              }
            ],
            footer: {
              text: 'Actoris Launcher • Système de détection automatique'
            },
            timestamp: now.toISOString()
          }
        ]
      })
    })

    if (!response.ok) {
      console.error('[DownloadManager] ❌ Erreur lors de l\'envoi du webhook Discord:', response.status, response.statusText)
    } else {
      console.log('[DownloadManager] ✅ Webhook Discord envoyé avec succès pour:', gameName)
    }
  } catch (error) {
    console.error('[DownloadManager] ❌ Erreur lors de l\'envoi du webhook Discord:', error)
  }
}

// Gestionnaire global des téléchargements
class DownloadManager {
  constructor() {
    this.downloads = new Map() // Map<gameId, downloadInfo>
    this.listeners = new Set()
    this.toastCallback = null
    this.navigateCallback = null
    this.deadLinkRewardCallback = null // Callback pour afficher la modal de récompense
    this.initialized = false
    this.webhookSentFor = new Set() // Pour éviter d'envoyer plusieurs fois le même webhook
    this.webhookCooldown = new Map() // Cooldown pour éviter le spam de webhooks
    this.WEBHOOK_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes de cooldown entre webhooks pour le même jeu
  }

  // Initialiser le DownloadManager avec les callbacks
  init(toastCallback, navigateCallback, deadLinkRewardCallback = null, deadLinkNotificationCallback = null) {
    this.toastCallback = toastCallback
    this.navigateCallback = navigateCallback
    this.deadLinkRewardCallback = deadLinkRewardCallback
    this.deadLinkNotificationCallback = deadLinkNotificationCallback
    this.initialized = true

    // Écouter les événements IPC depuis Electron
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('download:started', (event, data) => {
        this.handleDownloadStarted(data)
      })

      window.electron.ipcRenderer.on('download:progress', (event, data) => {
        this.handleDownloadProgress(data)
      })

      window.electron.ipcRenderer.on('download:complete', (event, data) => {
        this.handleDownloadComplete(data)
      })

      window.electron.ipcRenderer.on('download:error', async (event, data) => {
        console.error('[DownloadManager] 📨 Événement download:error reçu:', data)
        await this.handleDownloadError(data)
      })

      window.electron.ipcRenderer.on('extraction-started', (event, data) => {
        this.handleExtractionStarted(data)
      })

      window.electron.ipcRenderer.on('extraction:progress', (event, data) => {
        this.handleExtractionProgress(data)
      })

      window.electron.ipcRenderer.on('download:extracted', (event, data) => {
        this.handleExtractionComplete(data)
      })

      window.electron.ipcRenderer.on('download:extraction-failed', (event, data) => {
        console.error('[DownloadManager] 📨 Événement download:extraction-failed reçu:', data)
        this.handleExtractionFailed(data)
      })
    }
  }

  // Nettoyer les listeners
  cleanup() {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.removeAllListeners('download:started')
      window.electron.ipcRenderer.removeAllListeners('download:progress')
      window.electron.ipcRenderer.removeAllListeners('download:complete')
      window.electron.ipcRenderer.removeAllListeners('download:error')
      window.electron.ipcRenderer.removeAllListeners('extraction-started')
      window.electron.ipcRenderer.removeAllListeners('extraction:progress')
      window.electron.ipcRenderer.removeAllListeners('download:extracted')
      window.electron.ipcRenderer.removeAllListeners('download:extraction-failed')
    }
    this.toastCallback = null
    this.navigateCallback = null
    this.initialized = false
  }

  // Gérer le démarrage d'un téléchargement
  handleDownloadStarted(data) {
    console.log('[DownloadManager] 🚀 handleDownloadStarted appelé avec:', data)
    const { gameId, gameName, totalBytes, installPath, folderPath } = data
    
    if (!gameId && !gameName) {
      console.warn('[DownloadManager] ⚠️ Données invalides pour handleDownloadStarted:', data)
      return
    }
    
    // Utiliser gameId comme ID, ou générer un ID unique si gameId n'existe pas
    const downloadId = gameId || `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const finalGameName = gameName || 'Jeu'
    
    // Récupérer le chemin d'installation depuis les données
    const finalInstallPath = installPath || folderPath || null
    
    console.log('[DownloadManager] 📝 Création du téléchargement:', {
      downloadId,
      finalGameName,
      totalBytes,
      finalInstallPath
    })
    
    this.startDownload(downloadId, finalGameName, { 
      total: totalBytes || 0,
      installPath: finalInstallPath
    })
    
    if (this.toastCallback) {
      // Créer l'action comme un objet avec les propriétés nécessaires
      // Le composant Toast créera le bouton à partir de ces propriétés
      const action = this.navigateCallback ? {
        label: 'Voir dans les téléchargements',
        onClick: () => this.navigateCallback('downloads')
      } : null
      this.toastCallback(`Téléchargement de ${finalGameName} lancé !`, 'download', 10000, action)
    }
    
    console.log('[DownloadManager] ✅ Téléchargement créé et listeners notifiés')
  }

  // Gérer la progression d'un téléchargement
  handleDownloadProgress(data) {
    console.log('[DownloadManager] 📈 handleDownloadProgress appelé avec:', data)
    const {
      gameId,
      gameName,
      progress,
      receivedBytes,
      totalBytes,
      bytesPerSecond,
      eta,
      received,
      total,
      downloaded,
      speed
    } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    console.log('[DownloadManager] 🔍 ID trouvé pour progression:', id)
    if (id) {
      this.updateProgress(id, {
        progress: progress ?? 0,
        downloaded: receivedBytes ?? received ?? downloaded ?? 0,
        total: totalBytes ?? total ?? 0,
        speed: bytesPerSecond ?? speed ?? 0,
        estimatedTime: eta ?? 0
      })
      console.log('[DownloadManager] ✅ Progression mise à jour pour:', id)
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun téléchargement trouvé pour:', { gameId, gameName })
    }
  }

  // Gérer la fin d'un téléchargement
  handleDownloadComplete(data) {
    const { gameId, gameName } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      this.completeDownload(id)
      if (this.toastCallback) {
        this.toastCallback(`${gameName} téléchargé avec succès !`, 'success', 5000)
      }
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun ID trouvé pour:', gameName)
    }
  }

  // Gérer une erreur de téléchargement
  async handleDownloadError(data) {
    console.error('[DownloadManager] ❌ Erreur de téléchargement:', data)
    const { gameId, gameName, error, lockrCompleted } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    console.error('[DownloadManager] ❌ ID trouvé:', id, 'Erreur:', error, 'LockrCompleted:', lockrCompleted)
    
    // Récupérer le nom du jeu
    let finalGameName = gameName
    if (!finalGameName && id) {
      const download = this.downloads.get(id)
      if (download && download.gameName) {
        finalGameName = download.gameName
      }
    }
    
    // Si le nom du jeu n'est toujours pas disponible, essayer de le récupérer depuis les données
    if (!finalGameName) {
      finalGameName = 'Jeu inconnu'
    }
    
    // Récupérer le message d'erreur
    const errorMessage = error?.message || error || 'Erreur inconnue'
    const errorString = String(errorMessage).toLowerCase()
    
    // Détecter si c'est un lien non fonctionnel (interrupted, network error, 404, etc.)
    // Vérifier en anglais ET en français
    const isNonFunctionalLink = 
      errorString.includes('interrupted') ||
      errorString.includes('interrompu') || // Français
      errorString.includes('network') ||
      errorString.includes('réseau') || // Français
      errorString.includes('404') ||
      errorString.includes('not found') ||
      errorString.includes('introuvable') || // Français
      errorString.includes('failed') ||
      errorString.includes('échoué') || // Français
      errorString.includes('timeout') ||
      errorString.includes('délai') || // Français
      errorString.includes('connection') ||
      errorString.includes('connexion') || // Français
      errorString.includes('refused') ||
      errorString.includes('refusé') // Français
    
    // Si c'est un lien mort ET que l'utilisateur a complété les publicités, vérifier si une récompense peut être offerte
    if (isNonFunctionalLink && lockrCompleted === true) {
      console.log('[DownloadManager] 🎁 Lien mort détecté après publicités pour:', finalGameName)
      console.log('[DownloadManager] 🔍 Données pour récompense:', { gameId: id, gameName: finalGameName, lockrCompleted })
      
      // Vérifier si l'utilisateur a déjà réclamé une clé gratuite pour CE JEU SPÉCIFIQUE
      let hasAlreadyClaimed = false
      try {
        const freeKeysData = localStorage.getItem('freeKeysClaimed')
        if (freeKeysData) {
          const parsed = JSON.parse(freeKeysData)
          // Vérifier si ce jeu spécifique a déjà donné une clé
          // On peut vérifier par gameId ou par gameName
          const gameKey = id || finalGameName
          if (parsed.claimedGames && Array.isArray(parsed.claimedGames)) {
            hasAlreadyClaimed = parsed.claimedGames.some(claimedGame => 
              claimedGame.gameId === id || 
              claimedGame.gameId === String(id) ||
              claimedGame.gameName === finalGameName ||
              claimedGame.gameName?.toLowerCase() === finalGameName?.toLowerCase()
            )
          }
          if (hasAlreadyClaimed) {
            console.log('[DownloadManager] ⚠️ Utilisateur a déjà réclamé une clé gratuite pour ce jeu:', finalGameName, '- modal non affichée')
          }
        }
      } catch (error) {
        console.error('[DownloadManager] Erreur lors de la vérification de la clé réclamée:', error)
      }
      
      // Afficher la modal seulement si l'utilisateur n'a pas déjà réclamé de clé
      if (!hasAlreadyClaimed && this.deadLinkRewardCallback) {
        console.log('[DownloadManager] ✅ Callback disponible, déclenchement de la récompense...')
        // Appeler le callback pour afficher la modal de récompense
        try {
          this.deadLinkRewardCallback({
            gameId: id,
            gameName: finalGameName,
            error: errorMessage
          })
          console.log('[DownloadManager] ✅ Callback exécuté avec succès')
        } catch (error) {
          console.error('[DownloadManager] ❌ Erreur lors de l\'exécution du callback:', error)
        }
      } else if (hasAlreadyClaimed) {
        console.log('[DownloadManager] ℹ️ Récompense non affichée: utilisateur a déjà réclamé une clé gratuite')
      } else {
        console.warn('[DownloadManager] ⚠️ Callback deadLinkRewardCallback non disponible')
      }
    } else {
      if (isNonFunctionalLink) {
        console.log('[DownloadManager] ℹ️ Lien mort détecté mais lockrCompleted =', lockrCompleted, '- récompense non disponible')
      }
    }
    
    // Afficher le modal d'information pour VIP/Boost si c'est un lien mort
    // Ce modal s'affiche pour tous les liens morts, pas seulement après publicités
    if (isNonFunctionalLink && this.deadLinkNotificationCallback) {
      try {
        // Récupérer les informations utilisateur depuis localStorage
        // On vérifie si l'utilisateur est VIP ou Boost avant d'afficher
        let shouldShowModal = false
        try {
          const userData = localStorage.getItem('currentUser')
          if (userData) {
            const user = JSON.parse(userData)
            // Afficher le modal seulement pour VIP, Boost ou Admin
            shouldShowModal = !!(user.isVip || user.isBoost || user.isAdmin)
            if (shouldShowModal) {
              console.log('[DownloadManager] ✅ Utilisateur VIP/Boost/Admin détecté - Modal sera affiché')
            } else {
              console.log('[DownloadManager] ℹ️ Utilisateur non-VIP/Boost - Modal non affiché')
            }
          } else {
            console.log('[DownloadManager] ⚠️ Aucun utilisateur trouvé dans localStorage - Modal non affiché')
          }
        } catch (e) {
          console.warn('[DownloadManager] Impossible de vérifier le rôle utilisateur:', e)
        }
        
        if (shouldShowModal) {
          console.log('[DownloadManager] 📢 Affichage du modal d\'information pour lien mort (VIP/Boost)')
          this.deadLinkNotificationCallback({
            gameId: id,
            gameName: finalGameName,
            error: errorMessage
          })
        }
      } catch (error) {
        console.error('[DownloadManager] ❌ Erreur lors de l\'affichage du modal d\'information:', error)
      }
    }

    // Envoyer le webhook Discord si c'est un lien non fonctionnel (avec protection anti-spam)
    if (isNonFunctionalLink) {
      console.log('[DownloadManager] 🔍 Lien non fonctionnel détecté:', {
        gameName: finalGameName,
        gameId: id,
        errorMessage: errorMessage,
        errorString: errorString
      })
      
      const gameIdForWebhook = id || finalGameName
      const now = Date.now()
      
      // Vérifier le cooldown pour ce jeu spécifique (évite le spam si plusieurs utilisateurs téléchargent le même jeu)
      const lastWebhookTime = this.webhookCooldown.get(gameIdForWebhook) || 0
      const timeSinceLastWebhook = now - lastWebhookTime
      
      console.log('[DownloadManager] ⏱️ Cooldown check:', {
        gameIdForWebhook,
        lastWebhookTime,
        timeSinceLastWebhook,
        cooldownMs: this.WEBHOOK_COOLDOWN_MS,
        canSend: timeSinceLastWebhook >= this.WEBHOOK_COOLDOWN_MS
      })
      
      if (timeSinceLastWebhook >= this.WEBHOOK_COOLDOWN_MS) {
        // Le cooldown est écoulé, on peut envoyer le webhook
        console.log('[DownloadManager] 📤 Envoi du webhook Discord pour:', finalGameName, '(cooldown écoulé)')
        
        // Mettre à jour le timestamp du dernier webhook pour ce jeu
        this.webhookCooldown.set(gameIdForWebhook, now)
        
        // Envoyer le webhook via IPC (backend) au lieu du frontend
        if (window.electron && window.electron.discord && window.electron.discord.notifyDeadLink) {
          console.log('[DownloadManager] ✅ IPC discord.notifyDeadLink disponible, envoi via backend...')
          try {
            const result = await window.electron.discord.notifyDeadLink(finalGameName, errorMessage, id)
            console.log('[DownloadManager] 📨 Résultat webhook:', result)
            if (result && result.success) {
              console.log('[DownloadManager] ✅ Webhook Discord envoyé avec succès (via backend)')
              // Afficher un message de confirmation à l'utilisateur
              if (this.toastCallback) {
                this.toastCallback(
                  `🔴 Lien mort détecté pour "${finalGameName}". Signalement envoyé au salon Discord #liens-non-fonctionnel.`,
                  'info',
                  8000
                )
              }
            } else {
              console.error('[DownloadManager] ⚠️ Échec envoi webhook (non bloquant):', result?.error || 'Résultat inattendu')
            }
          } catch (ipcError) {
            console.error('[DownloadManager] ❌ Erreur IPC pour webhook:', ipcError)
            // Fallback: essayer l'ancienne méthode (frontend)
            console.log('[DownloadManager] 🔄 Fallback vers méthode frontend...')
            try {
              await sendDiscordWebhook(finalGameName, errorMessage, id)
              // Afficher le message même en fallback
              if (this.toastCallback) {
                this.toastCallback(
                  `🔴 Lien mort détecté pour "${finalGameName}". Signalement envoyé au salon Discord #liens-non-fonctionnel.`,
                  'info',
                  8000
                )
              }
            } catch (fallbackError) {
              console.error('[DownloadManager] ❌ Échec webhook même en fallback:', fallbackError)
            }
          }
        } else {
          // Fallback: utiliser l'ancienne méthode si IPC n'est pas disponible
          console.warn('[DownloadManager] ⚠️ IPC discord.notifyDeadLink non disponible:', {
            hasElectron: !!window.electron,
            hasDiscord: !!(window.electron && window.electron.discord),
            hasNotifyDeadLink: !!(window.electron && window.electron.discord && window.electron.discord.notifyDeadLink)
          })
          console.log('[DownloadManager] 🔄 Utilisation de la méthode frontend (fallback)...')
          try {
            await sendDiscordWebhook(finalGameName, errorMessage, id)
            // Afficher le message même en fallback
            if (this.toastCallback) {
              this.toastCallback(
                `🔴 Lien mort détecté pour "${finalGameName}". Signalement envoyé au salon Discord #liens-non-fonctionnel.`,
                'info',
                8000
              )
            }
          } catch (fallbackError) {
            console.error('[DownloadManager] ❌ Échec webhook en fallback:', fallbackError)
          }
        }
        
        // Nettoyer le cooldown après la période définie
        setTimeout(() => {
          this.webhookCooldown.delete(gameIdForWebhook)
        }, this.WEBHOOK_COOLDOWN_MS)
      } else {
        const remainingMinutes = Math.ceil((this.WEBHOOK_COOLDOWN_MS - timeSinceLastWebhook) / 60000)
        console.log(`[DownloadManager] ⏸️ Webhook en cooldown pour ${finalGameName} (${remainingMinutes} minute(s) restante(s))`)
      }
    } else {
      console.log('[DownloadManager] ℹ️ Erreur non détectée comme lien mort:', {
        errorMessage: errorMessage,
        errorString: errorString
      })
    }
    
    if (id) {
      this.failDownload(id, error)
      if (this.toastCallback) {
        this.toastCallback(`Échec du téléchargement de ${finalGameName}: ${errorMessage}`, 'error', 10000)
      }
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun ID trouvé pour:', finalGameName)
    }
  }

  // Gérer le début de l'extraction
  handleExtractionStarted(data) {
    const { gameId, gameName, totalBytes, extractedBytes } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      const download = this.downloads.get(id)
      if (download) {
        download.status = 'extracting'
        download.extractionStartTime = Date.now()
        download.extractionTotal = totalBytes || download.total || 0
        download.extractedBytes = extractedBytes || 0
        download.extractionSpeed = 0
        download.extractionEta = 0
        this.notify()
      }
      if (this.toastCallback) {
        this.toastCallback(`Extraction de ${gameName} en cours...`, 'info', 5000)
      }
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun ID trouvé pour:', gameName)
    }
  }

  // Gérer la progression de l'extraction
  handleExtractionProgress(data) {
    const {
      gameId,
      gameName,
      progress,
      extractedBytes,
      totalBytes,
      bytesPerSecond,
      speed,
      eta
    } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      const download = this.downloads.get(id)
      if (download && download.status === 'extracting') {
        const now = Date.now()
        const elapsed = download.extractionStartTime ? (now - download.extractionStartTime) / 1000 : 0
        
        // Mettre à jour la progression
        if (progress !== undefined) {
          download.progress = Math.min(100, Math.max(0, progress))
        }
        
        // Utiliser le total du téléchargement si extractionTotal n'est pas défini
        if (!download.extractionTotal) {
          download.extractionTotal = download.total || 0
        }
        
        // Mettre à jour le total si fourni
        if (totalBytes !== undefined && totalBytes > 0) {
          download.extractionTotal = totalBytes
        }
        
        // Calculer les bytes extraits basés sur la progression
        if (extractedBytes !== undefined) {
          download.extractedBytes = extractedBytes
        } else if (download.extractionTotal > 0 && progress !== undefined) {
          download.extractedBytes = (download.extractionTotal * progress) / 100
        }
        
        // Calculer la vitesse d'écriture (basée sur la progression dans le temps)
        if (bytesPerSecond !== undefined || speed !== undefined) {
          download.extractionSpeed = bytesPerSecond || speed || 0
        } else if (elapsed > 0 && download.extractedBytes > 0) {
          // Calculer la vitesse moyenne depuis le début
          download.extractionSpeed = download.extractedBytes / elapsed
          
          // Lisser la vitesse avec la dernière valeur si disponible
          if (download.lastExtractionSpeed && download.lastExtractionBytes) {
            const timeSinceLastUpdate = (now - (download.lastExtractionUpdate || download.extractionStartTime)) / 1000
            if (timeSinceLastUpdate > 0) {
              const instantSpeed = (download.extractedBytes - download.lastExtractionBytes) / timeSinceLastUpdate
              // Moyenne pondérée (70% vitesse instantanée, 30% vitesse moyenne)
              download.extractionSpeed = (instantSpeed * 0.7) + (download.extractionSpeed * 0.3)
            }
          }
          
          download.lastExtractionSpeed = download.extractionSpeed
          download.lastExtractionBytes = download.extractedBytes
          download.lastExtractionUpdate = now
        }
        
        // Calculer le temps restant
        if (eta !== undefined && eta > 0) {
          download.extractionEta = eta
        } else if (download.extractionSpeed > 0 && download.extractionTotal > download.extractedBytes) {
          const remaining = download.extractionTotal - download.extractedBytes
          download.extractionEta = remaining / download.extractionSpeed
        } else if (progress !== undefined && progress < 100 && download.extractionSpeed > 0) {
          // Estimation basée sur la progression restante
          const remainingProgress = 100 - progress
          const progressPerSecond = progress / elapsed
          if (progressPerSecond > 0) {
            download.extractionEta = remainingProgress / progressPerSecond
          } else {
            download.extractionEta = 0
          }
        } else {
          download.extractionEta = 0
        }
        
        this.notify()
      }
    }
  }

  // Gérer la fin de l'extraction
  handleExtractionComplete(data) {
    const { gameId, gameName } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    if (id) {
      const download = this.downloads.get(id)
      if (download) {
        download.status = 'extracted'
        download.progress = 100
        this.notify()
      }
      if (this.toastCallback) {
        this.toastCallback(`${gameName} installé avec succès !`, 'success', 5000)
      }
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun ID trouvé pour:', gameName)
    }
  }

  // Gérer l'échec de l'extraction
  handleExtractionFailed(data) {
    console.error('[DownloadManager] ❌ Extraction échouée:', data)
    const { gameId, gameName, error } = data
    const id = gameId || this.findDownloadByGameName(gameName)
    console.error('[DownloadManager] ❌ ID trouvé:', id, 'Erreur:', error)
    if (id) {
      this.failDownload(id, error)
      if (this.toastCallback) {
        this.toastCallback(`Échec de l'extraction de ${gameName}: ${error}`, 'error', 10000)
      }
    } else {
      console.warn('[DownloadManager] ⚠️ Aucun ID trouvé pour:', gameName)
    }
  }

  // Trouver un téléchargement par nom de jeu
  findDownloadByGameName(gameName) {
    for (const [id, download] of this.downloads.entries()) {
      if (download.gameName === gameName) {
        return id
      }
    }
    return null
  }

  // Ajouter un listener pour les mises à jour
  addListener(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  // Alias pour compatibilité
  subscribe(callback) {
    return this.addListener(callback)
  }

  // Notifier tous les listeners
  notify() {
    const downloadsArray = Array.from(this.downloads.values())
    console.log('[DownloadManager] 📢 Notification des listeners:', downloadsArray.length, 'téléchargements')
    console.log('[DownloadManager] 📊 Téléchargements actuels:', downloadsArray.map(d => ({
      id: d.id,
      gameName: d.gameName,
      status: d.status,
      progress: d.progress
    })))
    
    this.listeners.forEach((callback, index) => {
      try {
        callback(downloadsArray)
        console.log(`[DownloadManager] ✅ Listener ${index + 1} notifié avec succès`)
      } catch (error) {
        console.error(`[DownloadManager] ❌ Erreur dans le listener ${index + 1}:`, error)
      }
    })
    
    console.log('[DownloadManager] 📢 Notification terminée,', this.listeners.size, 'listeners notifiés')
  }

  // Démarrer un téléchargement
  startDownload(gameId, gameName, downloadInfo = {}) {
    const download = {
      id: gameId,
      gameId,
      gameName,
      status: 'downloading',
      progress: 0,
      speed: 0, // bytes/s
      downloaded: 0, // bytes
      total: 0, // bytes
      estimatedTime: 0, // secondes
      startTime: Date.now(),
      lockrCompleted: false, // Par défaut
      ...downloadInfo
    }

    this.downloads.set(gameId, download)
    this.notify()
    return download
  }

  // Mettre à jour la progression d'un téléchargement
  updateProgress(gameId, progressData) {
    const download = this.downloads.get(gameId)
    if (!download) return

    const now = Date.now()
    const elapsed = (now - download.startTime) / 1000 // secondes
    const downloaded = progressData.downloaded !== undefined ? progressData.downloaded : download.downloaded
    const total = progressData.total !== undefined ? progressData.total : download.total
    const progress = progressData.progress !== undefined ? progressData.progress : (total > 0 ? (downloaded / total) * 100 : 0)

    // Utiliser la vitesse fournie, sinon la calculer
    if (progressData.speed !== undefined && progressData.speed > 0) {
      download.speed = progressData.speed
    } else if (elapsed > 0 && downloaded > download.downloaded) {
      const bytesDiff = downloaded - download.downloaded
      const timeDiff = (now - (download.lastUpdate || download.startTime)) / 1000
      download.speed = timeDiff > 0 ? bytesDiff / timeDiff : 0
    }

    // Utiliser le temps estimé fourni, sinon le calculer
    if (progressData.estimatedTime !== undefined && progressData.estimatedTime > 0) {
      download.estimatedTime = progressData.estimatedTime
    } else if (download.speed > 0 && total > downloaded) {
      const remaining = total - downloaded
      download.estimatedTime = remaining / download.speed
    } else {
      download.estimatedTime = 0
    }

    download.progress = Math.min(100, Math.max(0, progress))
    download.downloaded = downloaded
    download.total = total
    download.lastUpdate = now

    this.downloads.set(gameId, download)
    this.notify()
  }

  // Marquer un téléchargement comme terminé
  completeDownload(gameId, result = {}) {
    const download = this.downloads.get(gameId)
    if (!download) return

    download.status = 'completed'
    download.progress = 100
    download.completedAt = Date.now()
    Object.assign(download, result)

    this.downloads.set(gameId, download)
    this.notify()

    // Supprimer après 5 secondes
    setTimeout(() => {
      this.removeDownload(gameId)
    }, 5000)
  }

  // Marquer un téléchargement comme échoué
  failDownload(gameId, error = {}) {
    const download = this.downloads.get(gameId)
    if (!download) return

    download.status = 'failed'
    download.error = error.message || error || 'Erreur inconnue'
    download.failedAt = Date.now()

    this.downloads.set(gameId, download)
    this.notify()
  }

  // Supprimer un téléchargement
  removeDownload(gameId) {
    this.downloads.delete(gameId)
    this.notify()
  }

  // Obtenir un téléchargement
  getDownload(gameId) {
    return this.downloads.get(gameId)
  }

  // Obtenir tous les téléchargements
  getAllDownloads() {
    return Array.from(this.downloads.values())
  }

  // Obtenir les téléchargements actifs
  getActiveDownloads() {
    return Array.from(this.downloads.values()).filter(d => d.status === 'downloading')
  }
}

// Instance singleton
export const downloadManager = new DownloadManager()

// Exposer globalement pour le debugging (seulement en développement)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.downloadManager = downloadManager
  console.log('[DownloadManager] 🌍 Exposé globalement pour le debugging')
}

