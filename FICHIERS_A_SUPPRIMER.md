# 📋 LISTE DÉTAILLÉE DES FICHIERS À SUPPRIMER

**Date** : 2026-01-07  
**Total** : 226+ fichiers  
**Espace économisé** : ~30-40 MB

---

## 📊 RÉSUMÉ PAR CATÉGORIE

| Catégorie | Nombre | Espace | Priorité |
|---|---|---|---|
| Documentation .md | 43 | 2-3 MB | 🔴 HAUTE |
| Scripts de test | 122+ | 10-15 MB | 🔴 HAUTE |
| Fichiers de backup | 15 | 5-10 MB | 🔴 HAUTE |
| Fichiers JSON de test | 7 | 1-2 MB | 🟡 MOYENNE |
| Fichiers HTML de test | 3 | 100 KB | 🟡 MOYENNE |
| Fichiers texte de test | 4 | 50 KB | 🟡 MOYENNE |
| Doublons Electron | 4 | 50 KB | 🟡 MOYENNE |
| Services non utilisés | 2 | 20 KB | 🟡 MOYENNE |
| **TOTAL** | **226+** | **~30-40 MB** | |

---

## 1️⃣ DOCUMENTATION TEMPORAIRE (.md) - 43 fichiers

### À SUPPRIMER

```
ADMIN_PAGINATION_SUMMARY.md
BUZZ_SIZE_SCRAPING_FIX_SUMMARY.md
CLEANUP_AUDIT.md
CORRECTIONS_SUMMARY.md
DOWNLOAD_POPUP_CONFIRM_FIX_SUMMARY.md
DOWNLOAD_PROGRESS_FIX_SUMMARY.md
DOWNLOAD_UI_FIX_SUMMARY.md
FINAL_CORRECTIONS_SUMMARY.md
GAMES_CATALOG_SIMPLIFICATION_SUMMARY.md
GAMES_JSON_FORMATTING_SUMMARY.md
GAMES_LINKS_UPDATE_ANALYSIS.md
GOFILE_API_FIX_SUMMARY.md
GOFILE_AUTOMATIC_CLEANUP_SUMMARY.md
GOFILE_DOWNLOAD_FIX_SUMMARY.md
GOFILE_ENHANCED_INTEGRATION_SUMMARY.md
GOFILE_EXACT_SIZES_UPDATE_SUMMARY.md
GOFILE_EXTRACTION_FIX_SUMMARY.md
GOFILE_HYBRID_SYSTEM_SUMMARY.md
GOFILE_INTEGRATION_SUMMARY.md
GOFILE_IPC_FIX_SUMMARY.md
GOFILE_PROGRESS_UI_FIX_SUMMARY.md
GOFILE_PYTHON_TO_JAVASCRIPT_MIGRATION.md
GUIDE_EXTRACTION_GOFILE.md
GUIDE_VERSIONS_BUZZ.md
INSTALL_WINDOWS_SDK.md
KOYSO_INTEGRATION_SUMMARY.md
NEXT_STEPS_BUZZ_VERSIONS.md
OTHER_LINKS_INTEGRATION_SUMMARY.md
PIXELDRAIN_ADVANCED_BYPASS_SUMMARY.md
PIXELDRAIN_BYPASS_INTEGRATION_SUMMARY.md
PIXELDRAIN_GAMES_REMOVAL_SUMMARY.md
POPUP_PATH_SELECTION_SUMMARY.md
PRODUCTION_GOFILE_ANALYSIS.md
REBUILD_INSTRUCTIONS.md
SCRAPING_MULTI_SITES_GUIDE.md
STEAMRIP_INTEGRATION_SUMMARY.md
SYSTEM_CLEANUP_SUMMARY.md
VIKINGFILE_DOWNLOAD_FIX_SUMMARY.md
VIKINGFILE_SIZE_INTEGRATION_SUMMARY.md
WEBHOOK_DISABLE_SUMMARY.md
WMIC_FIX_SUMMARY.md
```

### À CONSERVER

```
README.md                    (Documentation principale)
CHANGELOG.md                 (Historique des changements)
```

### Raison de la suppression

- Documentation de développement temporaire
- Résumés de corrections et fixes
- Guides d'intégration obsolètes
- Pas nécessaire en production

### Espace économisé

**2-3 MB**

---

## 2️⃣ SCRIPTS DE TEST - 122+ fichiers

### Fichiers commençant par `test-`

```
scripts/test-2-games-scraping.js
scripts/test-admin-pagination.js
scripts/test-advanced-pixeldrain-bypass.js
scripts/test-akirabox-direct-url.js
scripts/test-akirabox-info-page.js
scripts/test-akirabox-service.js
scripts/test-akirabox-url.js
scripts/test-all-ipc-handlers.js
scripts/test-app-fix.js
scripts/test-app-startup.js
scripts/test-buzz-file-size.js
scripts/test-buzz-games-versions.js
scripts/test-buzz-integration.js
scripts/test-buzz-url-specific.js
scripts/test-complete-buzz-integration.js
scripts/test-complete-integration.js
scripts/test-complete-pixeldrain-bypass-system.js
scripts/test-direct-page-scraping.js
scripts/test-disk-space-fix.js
scripts/test-disk-space.js
scripts/test-download-display.js
scripts/test-download-flow.js
scripts/test-download-popup-fix.js
scripts/test-download-popup-integration.js
scripts/test-download-progress.js
scripts/test-download-system.js
scripts/test-download-with-logs.js
scripts/test-extraction-display.js
scripts/test-extraction-only.js
scripts/test-final-popup-behavior.js
scripts/test-gofile-api-fix.js
scripts/test-gofile-api-improved.js
scripts/test-gofile-api.js
scripts/test-gofile-cleanup-unwanted-files.js
scripts/test-gofile-download-fix.js
scripts/test-gofile-electron-final.js
scripts/test-gofile-enhanced-integration.js
scripts/test-gofile-enhanced-real-url.js
scripts/test-gofile-extraction-debug.js
scripts/test-gofile-extraction-real.js
scripts/test-gofile-final-fix.js
scripts/test-gofile-hybrid-system.js
scripts/test-gofile-in-electron.js
scripts/test-gofile-integration.js
scripts/test-gofile-ipc-fix.js
scripts/test-gofile-ipc-real.js
scripts/test-gofile-javascript.js
scripts/test-gofile-launcher-integration.js
scripts/test-gofile-popup-integration.js
scripts/test-gofile-popup-simulation.js
scripts/test-gofile-progress-ui.js
scripts/test-gofile-python-integration.js
scripts/test-gofile-real-url.js
scripts/test-gofile-size-service-enhanced.js
scripts/test-gofile-size-service-ipc-enhanced.js
scripts/test-gofile-url.js
scripts/test-gofile-with-valid-url.js
scripts/test-hybrid-with-existing-python.js
scripts/test-improved-buzz-system.js
scripts/test-integration.js
scripts/test-ipc-connection.js
scripts/test-ipc-debug.js
scripts/test-ipc-handlers.js
scripts/test-ipc-simple.js
scripts/test-ipc-timeout.js
scripts/test-koyso-complete.js
scripts/test-koyso-file-size.js
scripts/test-koyso-integration.js
scripts/test-library-debug.js
scripts/test-library-fix.js
scripts/test-library-installed-games.js
scripts/test-mediafire-final-debug.js
scripts/test-mediafire-progress-fix.js
scripts/test-mediafire-script-fix.js
scripts/test-mediafire-simple.js
scripts/test-missing-handlers.js
scripts/test-multi-site-scraper.js
scripts/test-pixeldrain-api-info.js
scripts/test-pixeldrain-api-real.js
scripts/test-pixeldrain-bypass-integration.js
scripts/test-pixeldrain-bypass-methods.js
scripts/test-pixeldrain-bypass.js
scripts/test-pixeldrain-complete-system.js
scripts/test-pixeldrain-direct-api.js
scripts/test-pixeldrain-launcher-integration.js
scripts/test-pixeldrain-page-scraping.js
scripts/test-pixeldrain-quota-system.js
scripts/test-popup-final-fix.js
scripts/test-popup-path-selection.js
scripts/test-popup-realtime-update.js
scripts/test-real-buzz-fetch.js
scripts/test-real-pixeldrain-bypass.js
scripts/test-rootz-button-fix.js
scripts/test-scraper-basic.js
scripts/test-scraping-quick.js
scripts/test-server-startup.js
scripts/test-services-debug.js
scripts/test-simplified-system.js
scripts/test-single-game-scraping.js
scripts/test-specific-gofile-url.js
scripts/test-specific-rootz-page.js
scripts/test-sqlite-library.js
scripts/test-steamrip-abyssus.js
scripts/test-steamrip-download-links.js
scripts/test-steamrip-page.js
scripts/test-steamrip-search.js
scripts/test-supabase-connection.js
scripts/test-supabase-is-online.js
scripts/test-supabase-update.js
scripts/test-syntax-fix-gofile.js
scripts/test-syntax-fix.js
scripts/test-version-ipc-handlers.js
scripts/test-vikingfile-button-detection.js
scripts/test-vikingfile-download-fix.js
scripts/test-vikingfile-fix-verification.js
scripts/test-vikingfile-size.js
scripts/test-vikingfile-starttime-fix.js
scripts/test-vikingfile-ui.js
scripts/test-vikingfile-url.js
scripts/test-webhook-disabled.js
scripts/test-with-anon-key.js
scripts/test-with-buzz-url.js
```

### Raison de la suppression

- Scripts de test de développement
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**5-8 MB**

---

## 3️⃣ SCRIPTS DE DEBUG - 12 fichiers

### Fichiers commençant par `debug-`

```
scripts/debug-download-blocking.js
scripts/debug-download-popup-confirm.js
scripts/debug-download-process.js
scripts/debug-download-ui.js
scripts/debug-favorites.js
scripts/debug-gofile-api.js
scripts/debug-popup-issue.js
scripts/debug-steamrip-detailed.js
scripts/debug-steamrip-page.js
scripts/debug-steamrip-search.js
scripts/debug-supabase-videos.js
scripts/debug-video-loading.js
```

### Raison de la suppression

- Scripts de debug de développement
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**1-2 MB**

---

## 4️⃣ SCRIPTS DE FIX - 10+ fichiers

### Fichiers commençant par `fix-`

```
scripts/fix-all-selectors.js
scripts/fix-catalog-cache.js
scripts/fix-css-selectors.js
scripts/fix-download-timeout.js
scripts/fix-env-encoding.ps1
scripts/fix-favorites.js
scripts/fix-gofile-extraction-display.js
scripts/fix-imports-cleanup.js
scripts/fix-invalid-selectors.js
scripts/fix-launcher-server-syntax.js
scripts/fix-main-js.js
scripts/fix-rootz-button-detection.js
scripts/fix-syntax-errors.js
scripts/fix-windows-sdk-v2.ps1
scripts/fix-windows-sdk.ps1
scripts/fix-wmic-alternative.js
```

### Raison de la suppression

- Scripts de correction de développement
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**1-2 MB**

---

## 5️⃣ SCRIPTS D'ANALYSE - 5+ fichiers

### Fichiers commençant par `analyze-`

```
scripts/analyze-other-links.js
scripts/analyze-production-gofile.js
scripts/analyze-rootz-button-live.js
```

### Raison de la suppression

- Scripts d'analyse de développement
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**500 KB**

---

## 6️⃣ FICHIERS DE BACKUP - 15 fichiers

### Fichiers de backup games_updated.json

```
games_updated.json.backup
games_updated.json.backup-auto-2026-01-07T07-01-58-291Z
games_updated.json.backup-auto-2026-01-07T07-02-26-582Z
games_updated.json.backup-auto-2026-01-07T07-32-10-072Z
games_updated.json.backup-auto-2026-01-07T07-32-38-986Z
games_updated.json.backup-auto-2026-01-07T07-33-33-089Z
games_updated.json.backup-auto-2026-01-07T07-34-02-046Z
games_updated.json.backup-auto-2026-01-07T07-35-21-171Z
games_updated.json.backup-before-db-sync
games_updated.json.backup-before-name-sync
games_updated.json.backup-before-other-links-1767681031046
games_updated.json.backup-before-pixeldrain-removal
games_updated.json.backup-before-simplification
games_updated.json.backup-before-supabase-sync
games_updated.json.backup-before-ultra-simplification
```

### Autres fichiers de backup

```
launcher-server-backup.js
electron/main.js.backup-debug-1767349546532
electron/main.js.backup-timeout-1767349597908
```

### Raison de la suppression

- Backups obsolètes
- Données déjà synchronisées avec Supabase
- Peuvent être recréés si besoin

### Espace économisé

**5-10 MB**

---

## 7️⃣ FICHIERS JSON DE TEST - 7 fichiers

```
games-comparison-report.json
scraping-results-2026-01-07T05-49-09-236Z.json
scraping-results-2026-01-07T06-46-21-763Z.json
scraping-results-2026-01-07T06-48-14-489Z.json
scraping-results-2026-01-07T06-56-03-428Z.json
supabase-links-analysis.json
test-scraping-basic-report.json
```

### Raison de la suppression

- Résultats de scraping obsolètes
- Données de test
- Pas nécessaire en production

### Espace économisé

**1-2 MB**

---

## 8️⃣ FICHIERS HTML DE TEST - 3 fichiers

```
steamrip-geometry-dash.html
steamrip-page-sample.html
steamrip-search-results.html
```

### Raison de la suppression

- Pages de test scraping
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**100 KB**

---

## 9️⃣ FICHIERS TEXTE DE TEST - 4 fichiers

```
jeux-non-buzz-2026-01-02-backup.txt
jeux-non-buzz-2026-01-02.txt
RESULTATS_SCRAPING_STEAMRIP.txt
MEMO_VERSIONS_BUZZ.txt
```

### Raison de la suppression

- Résultats de scraping obsolètes
- Données de test
- Pas nécessaire en production

### Espace économisé

**50 KB**

---

## 🔟 FICHIERS DE CONFIGURATION DE TEST - 6 fichiers

```
test-download-display-code.js
test-import.mjs
test-ipc-direct.js
test-ipc-in-app.js
diagnostic-console-code.js
mock_launcher_db.json
```

### Raison de la suppression

- Fichiers de test de configuration
- Pas nécessaire en production
- Peuvent être recréés si besoin

### Espace économisé

**100 KB**

---

## 1️⃣1️⃣ DOUBLONS ELECTRON - 4 fichiers

### Fichiers .js à supprimer (garder les .mjs)

```
electron/discord-config.js              → Garder discord-config.mjs
electron/discord-rpc-service.js         → Garder discord-rpc-service.mjs
electron/discord-service-secure.js      → Garder discord-service-secure.mjs
electron/game-extractor.js              → Garder game-extractor.mjs
```

### Raison de la suppression

- Doublons avec extensions différentes
- Les fichiers .mjs sont les versions modernes
- Éviter la confusion et les erreurs d'import

### Espace économisé

**50 KB**

---

## 1️⃣2️⃣ SERVICES NON UTILISÉS - 2 fichiers

```
src/services/steamRequirementsService.js
src/services/youtubeVideoService.js
```

### Raison de la suppression

- Services non importés dans le code
- Pas utilisés en production
- Peuvent être recréés si besoin

### Espace économisé

**20 KB**

---

## 📝 COMMANDES DE SUPPRESSION

### PowerShell

```powershell
# Exécuter le script de nettoyage
.\CLEANUP_SCRIPT.ps1

# Ou en mode dry-run (sans supprimer)
.\CLEANUP_SCRIPT.ps1 -DryRun

# Ou sans backup
.\CLEANUP_SCRIPT.ps1 -Backup:$false
```

### Bash/Linux

```bash
# Supprimer les fichiers .md
rm -f *.md !README.md !CHANGELOG.md

# Supprimer les scripts de test
rm -f scripts/test-*.js
rm -f scripts/debug-*.js
rm -f scripts/fix-*.js
rm -f scripts/analyze-*.js

# Supprimer les backups
rm -f games_updated.json.backup*
rm -f launcher-server-backup.js
rm -f electron/main.js.backup*

# Supprimer les fichiers de test
rm -f games-comparison-report.json
rm -f scraping-results-*.json
rm -f supabase-links-analysis.json
rm -f test-scraping-basic-report.json
rm -f steamrip-*.html
rm -f jeux-non-buzz-*.txt
rm -f RESULTATS_SCRAPING_STEAMRIP.txt
rm -f MEMO_VERSIONS_BUZZ.txt

# Supprimer les doublons Electron
rm -f electron/discord-config.js
rm -f electron/discord-rpc-service.js
rm -f electron/discord-service-secure.js
rm -f electron/game-extractor.js

# Supprimer les services non utilisés
rm -f src/services/steamRequirementsService.js
rm -f src/services/youtubeVideoService.js
```

---

## ✅ VÉRIFICATION APRÈS SUPPRESSION

```bash
# Vérifier que le projet compile toujours
npm run build

# Vérifier que l'application démarre
npm start

# Vérifier qu'il n'y a pas d'erreurs
npm run lint

# Vérifier les imports
npm run scan:deps
```

---

## 🔄 RESTAURATION

Si vous avez besoin de restaurer les fichiers :

```bash
# Restaurer depuis le backup
cp -r cleanup-backup-YYYY-MM-DD-HHMMSS/* .

# Ou restaurer depuis Git
git checkout HEAD -- <fichier>
```

---

**Fin de la liste**
