/**
 * Serveur backend pour le launcher Actoris
 * Gère les WebSockets et l'API Discord sécurisée
 * 
 * Installation des dépendances:
 * npm install ws express discord.js axios cheerio dotenv cors
 */

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import net from "net";

// Déterminer le chemin du .env AVANT d'importer le router
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Backend server started

/**
 * Convertit un chemin Windows en URL file:// valide pour ESM
 * @param {string} filePath - Chemin du fichier (absolu ou relatif)
 * @returns {string} URL file:// valide
 */
function pathToFileURL(filePath) {
  // Résoudre le chemin absolu
  const resolvedPath = path.resolve(filePath);
  // Normaliser les séparateurs Windows (\) en séparateurs Unix (/)
  const normalized = resolvedPath.replace(/\\/g, '/');
  // Ajouter le préfixe file:// et échapper les caractères spéciaux
  // Sur Windows, on doit ajouter un / après file://
  return `file:///${normalized}`;
}

// Gestionnaire d'erreur global (logs désactivés)
process.on('uncaughtException', (error) => {
  // Logs désactivés
  if (process.send) {
    process.send({ type: 'backend-error', error: error.message, stack: error.stack });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Logs désactivés
  if (process.send) {
    process.send({ type: 'backend-error', error: String(reason) });
  }
});

// ⚠️ IMPORTANT : Ne PAS importer discord-auth-api.js ici !
// Il sera importé APRÈS le chargement des secrets Supabase
// pour que process.env soit rempli avant l'import
let discordAuthRouter = null;

// __filename et __dirname sont déjà définis plus haut

// ============================================
// 🔐 CONFIGURATION SUPABASE (intégrée directement - pas d'import externe)
// ============================================
const SUPABASE_CONFIG = {
  URL: process.env.SUPABASE_URL || 'https://fpxcefuqwvwdduzkmkrj.supabase.co',
  ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTI0MjksImV4cCI6MjA3OTQyODQyOX0.eav7rVxbs4fV6LxJs6y7c4zV9279X0DX0gEJtGPMdo8',
  SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA',
};

/**
 * Charge les secrets depuis Supabase (code intégré - pas d'import externe)
 * @returns {Promise<{success: boolean, secrets?: Object, error?: string}>}
 */
async function loadSecretsFromSupabase() {
  try {
    // Importer @supabase/supabase-js dynamiquement
    let createClient;
    try {
      const supabaseModule = await import('@supabase/supabase-js');
      createClient = supabaseModule.createClient;
    } catch (importError) {
      console.error('❌ [SUPABASE] Impossible d\'importer @supabase/supabase-js:', importError.message);
      console.error('   Assurez-vous que @supabase/supabase-js est installé: npm install @supabase/supabase-js');
      return { success: false, error: 'Module @supabase/supabase-js non disponible' };
    }

    const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

    // Récupérer tous les secrets depuis Supabase
    const { data, error } = await supabase
      .from('app_secrets')
      .select('key, value');

    if (error) {
      console.error('❌ [SUPABASE] Erreur lors du chargement:', error.message);
      console.error('   Code:', error.code);
      console.error('   Détails:', error.details);
      
      // Si la table n'existe pas, suggérer de créer la table
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.error('\n⚠️  [SUPABASE] La table app_secrets n\'existe pas!');
        console.error('   Exécutez le script SQL: scripts/supabase/create-app-secrets-table.sql');
      }
      
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error('❌ [SUPABASE] Aucun secret trouvé dans la table app_secrets');
      console.error('   Vérifiez que les secrets sont bien insérés dans Supabase');
      return { success: false, error: 'Aucun secret trouvé' };
    }

    // Secrets loaded

    // Charger les secrets dans process.env
    const secrets = {};
    let loadedCount = 0;
    
    for (const secret of data) {
      process.env[secret.key] = secret.value;
      secrets[secret.key] = secret.value;
      loadedCount++;
      
      // Masquer les valeurs sensibles dans les logs
      const isSecret = secret.key.includes('SECRET') || secret.key.includes('TOKEN');
      const displayValue = isSecret 
        ? (secret.value ? `***masqué*** (${secret.value.length} chars)` : '(vide)')
        : (secret.value ? (secret.value.length > 30 ? secret.value.substring(0, 30) + '...' : secret.value) : '(vide)');
      
      const status = secret.value ? '✅' : '⚠️ ';
      console.log(`   ${status} ${secret.key} = ${displayValue}`);
    }


    // Vérifier les variables critiques Discord
    const criticalVars = {
      'DISCORD_CLIENT_ID': process.env.DISCORD_CLIENT_ID,
      'DISCORD_CLIENT_SECRET': process.env.DISCORD_CLIENT_SECRET,
      'DISCORD_TOKEN': process.env.DISCORD_TOKEN,
      'DISCORD_GUILD_ID': process.env.DISCORD_GUILD_ID
    };

    let missingCritical = false;
    
    for (const [key, value] of Object.entries(criticalVars)) {
      if (!value || value.trim() === '') {
        console.log(`   ❌ ${key} - MANQUANT ou VIDE`);
        missingCritical = true;
      } else {
      }
    }

    if (missingCritical) {
      console.log('\n⚠️  [SUPABASE] ATTENTION: Des secrets Discord sont manquants!');
      console.log('    Vérifiez la table app_secrets dans Supabase');
      console.log('    Ou utilisez le fichier .env en fallback\n');
      return { success: false, error: 'Secrets critiques manquants', secrets };
    }

    console.log('');
    return { success: true, secrets };

  } catch (error) {
    console.error('❌ [SUPABASE] Erreur lors du chargement:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    return { success: false, error: error.message };
  }
}

// ============================================
// 🔐 CHARGEMENT DES SECRETS (SUPABASE en priorité, .env en fallback)
// ============================================
async function loadSecrets() {
  // Priorité 1 : TOUJOURS essayer Supabase en premier (même si variables déjà chargées)
  try {
    // Code Supabase intégré directement (pas d'import externe)
    const result = await loadSecretsFromSupabase();
    
    if (result.success) {
      // Les secrets de Supabase ont écrasé ceux du .env - parfait !
      return true;
    } else {
      console.warn('⚠️  [SECRETS] Échec du chargement depuis Supabase');
      console.warn('   Raison:', result.error || 'Inconnue');
      console.warn('   Fallback vers fichier .env...');
    }
  } catch (error) {
    console.warn('⚠️  [SECRETS] Erreur lors du chargement depuis Supabase:', error.message);
    if (error.stack) {
      console.warn('   Stack:', error.stack);
    }
    console.warn('   Fallback vers fichier .env...');
  }
  
  // Priorité 2 : Fallback vers fichier .env (seulement si Supabase a échoué)
  const alreadyLoaded = !!process.env.DISCORD_CLIENT_ID && 
                        !!process.env.DISCORD_CLIENT_SECRET &&
                        !!process.env.DISCORD_TOKEN;
  
  if (alreadyLoaded) {
    console.log('  DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || '❌');
    return true;
  }
  
  return loadEnvFile();
}

// 🔧 Fonction pour charger .env SANS ÉCRASER les variables existantes (FALLBACK)
function loadEnvFile() {
  console.log('🔍 [ENV] Vérification des variables d\'environnement...');
  
  // Vérifier si les variables critiques sont déjà chargées
  const alreadyLoaded = !!process.env.DISCORD_CLIENT_ID && 
                        !!process.env.DISCORD_CLIENT_SECRET &&
                        !!process.env.DISCORD_TOKEN;
  
  if (alreadyLoaded) {
    console.log('✅ [ENV] Variables déjà chargées par le processus parent!');
    console.log('🔐 [ENV] État des variables:');
    console.log('  DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID ? '✅' : '❌');
    console.log('  DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '✅ ***' : '❌');
    console.log('  DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ ***' : '❌');
    console.log('  DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || '❌');
    return true;
  }
  
  console.log('⚠️  [ENV] Variables non chargées, tentative de chargement...');
  
  // Chemins possibles pour le .env
  const envPaths = [
    process.env.ENV_FILE_PATH, // Passé depuis main.js
    path.join(process.env.APPDATA || '', 'actoris-launcher', '.env'),
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '..', '.env')
  ].filter(Boolean);

  console.log('📂 [ENV] Chemins testés:', envPaths);

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`✅ [ENV] Fichier trouvé: ${envPath}`);
      
      try {
        // ============================================
        // 🔧 DÉTECTION ET CORRECTION AUTOMATIQUE
        // ============================================
        const buffer = fs.readFileSync(envPath);
        const fileSize = buffer.length;
        console.log(`📄 [ENV] Taille: ${fileSize} octets`);
        
        let content;
        let needsFix = false;
        let fixed = false;
        
        // Détecter et corriger le BOM UTF-8 (EF BB BF)
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          console.log('⚠️  [ENV] BOM UTF-8 détecté - Correction automatique...');
          content = buffer.slice(3).toString('utf8'); // Enlever le BOM
          needsFix = true;
        }
        // Détecter UTF-16 LE (FF FE)
        else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
          console.log('⚠️  [ENV] UTF-16 LE détecté - Conversion en UTF-8...');
          content = buffer.toString('utf16le');
          needsFix = true;
        }
        // Détecter UTF-16 BE (FE FF)
        else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
          console.log('⚠️  [ENV] UTF-16 BE détecté - Conversion en UTF-8...');
          // Inverser les bytes puis décoder
          const swapped = Buffer.from(buffer);
          for (let i = 0; i < swapped.length - 1; i += 2) {
            const temp = swapped[i];
            swapped[i] = swapped[i + 1];
            swapped[i + 1] = temp;
          }
          content = swapped.toString('utf16le');
          needsFix = true;
        }
        // Pas de BOM - lecture normale
        else {
          console.log('✅ [ENV] Encodage UTF-8 sans BOM (correct)');
          content = buffer.toString('utf8');
        }
        
        // Enlever le BOM UTF-8 invisible si présent dans la chaîne
        if (content && content.charCodeAt(0) === 0xFEFF) {
          console.log('🔧 [ENV] Suppression du BOM UTF-8 (caractère invisible)...');
          content = content.substring(1);
          needsFix = true;
        }
        
        // Si correction nécessaire, réécrire le fichier en UTF-8 sans BOM
        if (needsFix && content) {
          try {
            // Créer un backup
            const backupPath = `${envPath}.backup`;
            if (fs.existsSync(envPath) && !fs.existsSync(backupPath)) {
              fs.copyFileSync(envPath, backupPath);
              console.log(`💾 [ENV] Backup créé: ${backupPath}`);
            }
            
            // Réécrire en UTF-8 sans BOM
            fs.writeFileSync(envPath, content, { encoding: 'utf8' });
            console.log('✅ [ENV] Fichier corrigé et sauvegardé en UTF-8 sans BOM');
            fixed = true;
          } catch (writeError) {
            console.error('❌ [ENV] Erreur lors de la réécriture:', writeError.message);
            // Continuer quand même avec le contenu en mémoire
          }
        }
        
        console.log('📄 [ENV] Aperçu (premiers 100 chars):', content.substring(0, 100).replace(/\n/g, '\\n'));
        
        // Essayer d'abord avec dotenv
        let dotenvSuccess = false;
        try {
          const result = dotenv.config({ 
            path: envPath, 
            override: false
          });
          
          if (!result.error) {
            // Vérifier si dotenv a réellement chargé des variables
            const testVars = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_TOKEN'];
            const loadedCount = testVars.filter(v => process.env[v]).length;
            
            if (loadedCount > 0) {
              console.log(`✅ [ENV] dotenv a chargé ${loadedCount} variables critiques`);
              dotenvSuccess = true;
            } else {
              console.warn('⚠️  [ENV] dotenv n\'a pas chargé de variables - parsing manuel...');
            }
          }
        } catch (dotenvError) {
          console.warn('⚠️  [ENV] Erreur dotenv:', dotenvError.message);
        }
        
        // Si dotenv n'a pas fonctionné, parser manuellement
        if (!dotenvSuccess && content) {
          console.log('🔧 [ENV] Parsing manuel du fichier .env...');
          const lines = content.split(/\r?\n/);
          let varCount = 0;
          const variables = {};
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Ignorer commentaires et lignes vides
            if (!line || line.startsWith('#')) {
              continue;
            }
            
            // Parser KEY=VALUE (plus strict)
            const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
            if (match) {
              const key = match[1];
              let value = match[2].trim();
              
              // Enlever les guillemets
              if ((value.startsWith('"') && value.endsWith('"')) || 
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              
              if (key && !process.env[key]) {
                process.env[key] = value;
                variables[key] = value;
                varCount++;
              }
            }
          }
          
          console.log(`✅ [ENV] ${varCount} variables parsées manuellement`);
          
          if (varCount > 0) {
            console.log('📋 [ENV] Variables chargées:');
            for (const [key, value] of Object.entries(variables)) {
              const isSecret = key.includes('SECRET') || key.includes('TOKEN');
              const displayValue = isSecret 
                ? (value ? `***masqué*** (${value.length} chars)` : '(vide)')
                : (value ? (value.length > 30 ? value.substring(0, 30) + '...' : value) : '(vide)');
              const status = value ? '✅' : '⚠️ ';
              console.log(`   ${status} ${key} = ${displayValue}`);
            }
          }
        }
        
        // Vérifier les variables critiques
        console.log('\n🔐 [ENV] Vérification des secrets Discord:');
        const criticalVars = {
          'DISCORD_CLIENT_ID': process.env.DISCORD_CLIENT_ID,
          'DISCORD_CLIENT_SECRET': process.env.DISCORD_CLIENT_SECRET,
          'DISCORD_TOKEN': process.env.DISCORD_TOKEN,
          'DISCORD_GUILD_ID': process.env.DISCORD_GUILD_ID
        };
        
        let missingCritical = false;
        for (const [key, value] of Object.entries(criticalVars)) {
          if (!value || value.trim() === '') {
            console.log(`   ❌ ${key} - MANQUANT ou VIDE`);
            missingCritical = true;
          } else {
            const isSecret = key.includes('SECRET') || key.includes('TOKEN');
            console.log(`   ✅ ${key} - OK${isSecret ? ' (masqué)' : ''}`);
          }
        }
        
        if (missingCritical) {
          console.log('\n⚠️  [ENV] ATTENTION: Des secrets Discord sont manquants!');
          console.log('    L\'authentification Discord ne fonctionnera pas.');
          console.log(`    Éditez le fichier: ${envPath}`);
          console.log('    Ou utilisez: scripts/setup-secrets.ps1\n');
          return false;
        }
        
        // Afficher quelques autres variables
        const otherVars = ['PORT', 'WS_PORT', 'DISCORD_REDIRECT_URI', 'API_URL'];
        const otherVarsFound = otherVars.filter(v => process.env[v]);
        if (otherVarsFound.length > 0) {
          console.log('\n📋 [ENV] Autres variables:');
          for (const key of otherVarsFound) {
            console.log(`   ${key}: ${process.env[key]}`);
          }
        }
        
        if (fixed) {
          console.log('\n✅ [ENV] Encodage corrigé automatiquement au démarrage');
        }
        
        console.log('');
        return true;
        
      } catch (error) {
        console.error(`❌ [ENV] Erreur lors du chargement:`, error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    } else {
      console.log(`❌ [ENV] Fichier non trouvé: ${envPath}`);
    }
  }
  
  console.error('❌ [ENV] Aucun fichier .env trouvé!');
  return false;
}

// ============================================
// 🔐 CHARGEMENT DES SECRETS EN PREMIER (BLOQUANT)
// ============================================
// ⚠️ CRITIQUE : Charger les secrets AVANT d'importer discord-auth-api.js
// pour que process.env soit rempli avec les secrets Supabase
await loadSecrets();

// ============================================
// 🔐 IMPORT DYNAMIQUE DES ROUTERS APRÈS CHARGEMENT DES SECRETS
// ============================================
// ⚠️ CRITIQUE : Importer discord-auth-api.js APRÈS loadSecrets()
// pour que process.env soit rempli avec les secrets Supabase
async function loadDiscordAuthRouter() {
  try {
    // Essayer d'abord le chemin relatif depuis le même dossier
    const routerModule = await import("./server/discord-auth-api.js");
    discordAuthRouter = routerModule.default || routerModule;
    return true;
  } catch (err) {
    try {
      // Si ça échoue, essayer depuis le répertoire parent
      const routerModule = await import("../server/discord-auth-api.js");
      discordAuthRouter = routerModule.default || routerModule;
      return true;
    } catch (err2) {
      try {
        // Si ça échoue encore, essayer avec le chemin absolu converti en URL file://
        const serverPath = path.join(__dirname, "server", "discord-auth-api.js");
        const apiUrl = pathToFileURL(serverPath);
        console.log('[Backend] 🔍 Tentative d\'import depuis:', apiUrl);
        const routerModule = await import(apiUrl);
        discordAuthRouter = routerModule.default || routerModule;
        return true;
      } catch (err3) {
        console.error('[Backend] ❌ Impossible de charger discord-auth-api.js');
        console.error('[Backend] ❌ __dirname:', __dirname);
        console.error('[Backend] ❌ Erreur 1:', err?.message);
        console.error('[Backend] ❌ Erreur 2:', err2?.message);
        console.error('[Backend] ❌ Erreur 3:', err3?.message);
        return false;
      }
    }
  }
}

// Charger le router Discord APRÈS les secrets
await loadDiscordAuthRouter();

const app = express();
const server = http.createServer(app);

// Middleware de compression (17,541 KiB économisés)
import compression from 'compression';
app.use(compression({
  level: 6, // Niveau de compression optimal
  filter: (req, res) => {
    // Compresser seulement les réponses textuelles
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024 // Compresser seulement les fichiers > 1KB
}));

// Middleware
app.use(cors());
app.use(express.json());

// Headers pour améliorer les performances et le cache bfcache
app.use((req, res, next) => {
  // Headers pour améliorer les performances
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Headers pour permettre le bfcache (back/forward cache)
  // Ne pas utiliser unswallowed unload listeners
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // Headers pour le cache et les performances (optimisé par type de ressource)
  const path = req.path.toLowerCase();
  if (path.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff|woff2|ico)$/)) {
    // Assets statiques - cache long terme (1 an) avec immutable
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (path.match(/\.(html|json)$/) || path === '/') {
    // HTML et JSON - pas de cache pour toujours avoir la dernière version
    res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    // Autres ressources - cache court terme (1 heure)
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  
  // Headers pour HTTP/2 Server Push (si supporté) - seulement pour les ressources critiques
  if (path === '/' || path.match(/\.html$/)) {
    res.setHeader('Link', '</actoris-logo.png>; rel=preload; as=image; fetchpriority=high, </src/index.css>; rel=preload; as=style');
  }
  
  next();
});

// Route de santé (IMPORTANT: doit être accessible rapidement, AVANT les autres routes)
app.get("/health", (req, res) => {
  console.log(`[Backend Server] 📥 Requête /health reçue`);
  res.status(200).json({ 
    status: 'ok', 
    message: 'Backend is running',
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.DISCORD_CLIENT_ID,
      hasClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
      hasToken: !!process.env.DISCORD_TOKEN,
      hasGuildId: !!process.env.DISCORD_GUILD_ID
    }
  });
});

// Middleware de logging pour toutes les requêtes
app.use((req, res, next) => {
  next();
});

// ✅ Enregistrer le router Discord (seulement si chargé avec succès)
if (discordAuthRouter) {
  app.use("/api/discord", discordAuthRouter);
} else {
  console.error('[Backend] ❌ Router Discord non disponible - routes /api/discord désactivées');
}

// Importer le router Rewards (récompenses)
let rewardsRouter;
try {
  const routerModule = await import("./server/rewards-api.js");
  rewardsRouter = routerModule.default || routerModule;
} catch (err) {
  try {
    const routerModule = await import("../server/rewards-api.js");
    rewardsRouter = routerModule.default || routerModule;
  } catch (err2) {
    console.error('[Backend] ⚠️ Impossible de charger rewards-api.js (optionnel)');
    rewardsRouter = null;
  }
}

// ✅ Enregistrer le router Rewards (si chargé)
if (rewardsRouter) {
  app.use("/api/rewards", rewardsRouter);
}

// Importer et initialiser le bot Discord pour les interactions et suggestions
let discordSuggestionBot = null;

// Fonction pour charger le module bot Discord
async function loadDiscordBotModule() {
  // Logs d sactiv s
  // Logs d sactiv s
  // Logs désactivés
  
  try {
    // Logs d sactiv s
    
    // Essayer plusieurs chemins possibles
    const possiblePaths = [
      path.resolve(__dirname, "./server/discord-suggestion-bot.js"),
      path.resolve(__dirname, "server/discord-suggestion-bot.js"),
      path.join(__dirname, "server", "discord-suggestion-bot.js")
    ];
    
    let botModulePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        botModulePath = testPath;
        // Logs d sactiv s
        break;
      }
    }
    
    if (!botModulePath) {
      // Logs d sactiv s
      // Logs désactivés
      throw new Error(`Fichier discord-suggestion-bot.js non trouvé`);
    }
    
    // Logs d sactiv s
    const fileUrl = pathToFileURL(botModulePath);
    // Logs d sactiv s
    
    // Essayer l'import avec un timeout réduit (5s au lieu de 10s)
    const importPromise = import(fileUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout lors de l'import (5s)")), 5000)
    );
    
    const botModule = await Promise.race([importPromise, timeoutPromise]);
    
    // Vérifier que le module est bien chargé
    if (!botModule) {
      throw new Error("Module retourné vide ou undefined");
    }
    
    // Logs d sactiv s
    // Logs d sactiv s
      // Logs désactivés
    // Logs d sactiv s
    // Logs d sactiv s
    // Logs d sactiv s
    
    // Vérifier que les fonctions essentielles existent
    if (typeof botModule.initDiscordBot !== 'function') {
      throw new Error("initDiscordBot n'est pas une fonction dans le module");
    }
    
    discordSuggestionBot = botModule;
    // Logs d sactiv s
    
    // Initialiser le bot
    // Logs d sactiv s
    try {
      const initResult = await botModule.initDiscordBot();
      if (initResult) {
        // Logs d sactiv s
      } else {
        // Logs désactivés
        // Logs d sactiv s
        // Logs d sactiv s
      }
    } catch (initErr) {
      // Logs d sactiv s
      // Logs d sactiv s
      // Logs d sactiv s
      // Ne pas retourner false ici, le module est chargé même si le bot n'est pas initialisé
    }
    
    return true;
  } catch (err) {
    // Logs d sactiv s
    // Logs d sactiv s
    // Logs d sactiv s
    // Logs d sactiv s
    if (err.stack) {
      // Logs d sactiv s
    }
    // Logs d sactiv s
    discordSuggestionBot = null;
    return false;
  }
}

// Charger le module bot Discord
// Logs d sactiv s
// Logs d sactiv s
// Logs d sactiv s
// Charger le bot en arrière-plan (non-bloquant pour démarrer le serveur plus vite)
(async () => {
  try {
    const botModuleLoaded = await loadDiscordBotModule();
    if (!botModuleLoaded) {
    // Logs d sactiv s
    // Logs d sactiv s
    // Logs d sactiv s
  } else {
    // Logs d sactiv s
    // Logs d sactiv s
    if (discordSuggestionBot) {
      // Logs désactivés
    }
  }
} catch (err) {
  // Logs d sactiv s
  // Logs d sactiv s
  // Logs d sactiv s
    discordSuggestionBot = null;
  }
})();
// Logs d sactiv s
// Logs d sactiv s
// Logs d sactiv s

// Route pour vérifier l'état du bot Discord
app.get("/api/discord/bot-status", async (req, res) => {
  try {
    if (!discordSuggestionBot) {
      // Logs d sactiv s
      return res.json({
        available: false,
        status: 'not_loaded',
        message: 'Module bot Discord non chargé. Vérifiez les logs du serveur pour plus de détails.'
      });
    }
    
    // Logs désactivés
    
    // Vérifier si le bot a une méthode pour vérifier l'état
    if (discordSuggestionBot.getBotStatus) {
      const status = await discordSuggestionBot.getBotStatus();
      // Logs d sactiv s
      return res.json(status);
    }
    
    // Fallback: vérifier si sendSuggestionWithBot existe
    // Logs d sactiv s
    return res.json({
      available: !!discordSuggestionBot.sendSuggestionWithBot,
      status: discordSuggestionBot.sendSuggestionWithBot ? 'unknown' : 'not_available',
      message: discordSuggestionBot.sendSuggestionWithBot ? 'Bot disponible (état inconnu)' : 'Bot non disponible'
    });
  } catch (error) {
    // Logs d sactiv s
    return res.status(500).json({
      available: false,
      status: 'error',
      message: error.message
    });
  }
});

// Route pour envoyer une suggestion via le bot Discord (SÉCURISÉ - côté serveur uniquement)
app.post("/api/discord/send-suggestion", async (req, res) => {
  try {
    const { gameName, username, description, gameUrl, userId, timestamp } = req.body;
    
    // Validation des données
    if (!gameName || !username || !description) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes: gameName, username et description sont requis'
      });
    }

    // Utiliser UNIQUEMENT le bot Discord (pas de fallback webhook)
    if (!discordSuggestionBot || !discordSuggestionBot.sendSuggestionWithBot) {
      // Logs d sactiv s
      return res.status(503).json({
        success: false,
        error: 'Bot Discord non disponible. Le module bot n\'est pas chargé. Vérifiez les logs du serveur.'
      });
    }

    const suggestionData = {
      gameName: gameName.trim(),
      username: username.trim(),
      description: description.trim(),
      gameUrl: gameUrl ? gameUrl.trim() : null,
      userId: userId || null,
      timestamp: timestamp || new Date().toISOString()
    };
    
    const result = await discordSuggestionBot.sendSuggestionWithBot(suggestionData);
    
    if (result.success) {
      // Logs d sactiv s
      return res.json(result);
    } else {
      // Logs d sactiv s
      return res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de l\'envoi de la suggestion via le bot Discord'
      });
    }
  } catch (error) {
    // Logs d sactiv s
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

// Route simplifiée pour les suggestions depuis le formulaire (nouveau endpoint)
app.post("/api/discord/suggestion", async (req, res) => {
  try {
    const { userName, gameName, steamLink, timestamp } = req.body;
    
    // Validation des données
    if (!gameName || !userName) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes: gameName et userName sont requis'
      });
    }

    // Utiliser UNIQUEMENT le bot Discord (pas de fallback webhook)
    if (!discordSuggestionBot || !discordSuggestionBot.sendSuggestionWithBot) {
      console.warn('[Discord] Bot Discord non disponible pour les suggestions');
      return res.status(503).json({
        success: false,
        error: 'Bot Discord non disponible. Le module bot n\'est pas chargé.'
      });
    }

    // Préparer les données pour le bot Discord
    const suggestionData = {
      gameName: gameName.trim(),
      username: userName.trim(),
      description: `Suggestion de jeu: ${gameName.trim()}${steamLink ? `\nLien Steam: ${steamLink.trim()}` : ''}`,
      gameUrl: steamLink ? steamLink.trim() : null,
      userId: null,
      timestamp: timestamp || new Date().toISOString()
    };
    
    console.log('[Discord] Envoi de suggestion:', {
      gameName: suggestionData.gameName,
      username: suggestionData.username,
      hasSteamLink: !!suggestionData.gameUrl
    });
    
    const result = await discordSuggestionBot.sendSuggestionWithBot(suggestionData);
    
    if (result.success) {
      console.log('[Discord] ✅ Suggestion envoyée avec succès');
      return res.json({
        success: true,
        message: 'Suggestion envoyée avec succès à Discord'
      });
    } else {
      console.error('[Discord] ❌ Erreur lors de l\'envoi:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Erreur lors de l\'envoi de la suggestion via le bot Discord'
      });
    }
  } catch (error) {
    console.error('[Discord] ❌ Erreur lors de l\'envoi de suggestion:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

// 📁 ENDPOINT : Récupérer la taille d'un fichier VikingFile
app.post("/api/get-vikingfile-size", async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('vik1ngfile.site')) {
      return res.status(400).json({
        success: false,
        error: 'URL VikingFile invalide'
      });
    }
    
    console.log('[VikingFileAPI] 🔍 Récupération taille pour:', url);
    
    // Importer axios dynamiquement
    const axios = (await import('axios')).default;
    
    // Récupérer la page VikingFile
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000,
      maxRedirects: 5
    });
    
    const html = response.data;
    
    // Patterns pour extraire la taille depuis le HTML VikingFile
    const sizePatterns = [
      /(\d+(?:\.\d+)?)\s*(MB|GB|KB)/gi,
      /Size[:\s]*(\d+(?:\.\d+)?)\s*(MB|GB|KB)/gi,
      /Taille[:\s]*(\d+(?:\.\d+)?)\s*(MB|GB|KB)/gi,
      /(\d+(?:\.\d+)?)\s*(Mo|Go|Ko)/gi,
      /"size"[:\s]*"([^"]+)"/gi,
      /class="size"[^>]*>([^<]+)</gi,
      /id="size"[^>]*>([^<]+)</gi,
      /<span[^>]*>(\d+(?:\.\d+)?)\s*(MB|GB|KB|Mo|Go|Ko)<\/span>/gi
    ];
    
    for (const pattern of sizePatterns) {
      const matches = [...html.matchAll(pattern)];
      
      for (const match of matches) {
        const sizeValue = parseFloat(match[1]);
        const unit = match[2] ? match[2].toUpperCase() : 'MB';
        
        if (sizeValue > 0) {
          let sizeInBytes = 0;
          
          switch (unit) {
            case 'KB':
            case 'KO':
              sizeInBytes = sizeValue * 1024;
              break;
            case 'MB':
            case 'MO':
              sizeInBytes = sizeValue * 1024 * 1024;
              break;
            case 'GB':
            case 'GO':
              sizeInBytes = sizeValue * 1024 * 1024 * 1024;
              break;
          }
          
          if (sizeInBytes > 0) {
            console.log('[VikingFileAPI] ✅ Taille trouvée:', sizeValue, unit, '=', sizeInBytes, 'bytes');
            
            return res.json({
              success: true,
              size: sizeInBytes,
              sizeText: `${sizeValue} ${unit}`,
              url: url
            });
          }
        }
      }
    }
    
    // Si aucune taille trouvée, chercher dans le titre de la page
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    if (titleMatch) {
      const title = titleMatch[1];
      const titleSizeMatch = title.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB|Mo|Go|Ko)/i);
      
      if (titleSizeMatch) {
        const sizeValue = parseFloat(titleSizeMatch[1]);
        const unit = titleSizeMatch[2].toUpperCase();
        
        let sizeInBytes = 0;
        switch (unit) {
          case 'KB':
          case 'KO':
            sizeInBytes = sizeValue * 1024;
            break;
          case 'MB':
          case 'MO':
            sizeInBytes = sizeValue * 1024 * 1024;
            break;
          case 'GB':
          case 'GO':
            sizeInBytes = sizeValue * 1024 * 1024 * 1024;
            break;
        }
        
        if (sizeInBytes > 0) {
          console.log('[VikingFileAPI] ✅ Taille trouvée dans le titre:', sizeValue, unit);
          
          return res.json({
            success: true,
            size: sizeInBytes,
            sizeText: `${sizeValue} ${unit}`,
            url: url
          });
        }
      }
    }
    
    console.warn('[VikingFileAPI] ⚠️ Aucune taille trouvée dans la page');
    return res.json({
      success: false,
      error: 'Taille non trouvée dans la page VikingFile'
    });
    
  } catch (error) {
    console.error('[VikingFileAPI] ❌ Erreur lors de la récupération:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de la récupération de la taille'
    });
  }
});

// ✅ Routes de confirmation pour le launcher (depuis le site web)
app.get("/get-locker-info", async (req, res) => {
  try {
    const lockerId = req.query.lockerId;
    if (!lockerId) {
      return res.status(400).json({ error: "lockerId manquant" });
    }

    // Importer le service Lockr de manière dynamique
    // Essayer d'abord avec un chemin relatif
    let lockrService = null;
    try {
      lockrService = await import("./electron/lockr-service.js");
    } catch (err) {
      try {
        // Si ça échoue, essayer avec le chemin absolu converti en URL file://
        const lockrPath = path.join(__dirname, "electron", "lockr-service.js");
        const lockrUrl = pathToFileURL(lockrPath);
        lockrService = await import(lockrUrl);
      } catch (err2) {
        // Logs d sactiv s
        lockrService = null;
      }
    }
    if (!lockrService) {
      return res.status(500).json({ error: "Service Lockr non disponible" });
    }

    const result = await lockrService.getLockerInfo(lockerId);
    if (result.success) {
      res.json({ success: true, title: result.title, description: result.description });
    } else {
      res.status(404).json({ error: result.error || "Casier non trouvé" });
    }
  } catch (err) {
    // Logs d sactiv s
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/confirm-download", async (req, res) => {
  try {
    const { gameId, gameName } = req.body;
    
    if (!gameId && !gameName) {
      return res.status(400).json({ error: "gameId ou gameName requis" });
    }

    // Cette route est appelée depuis le site web
    // Le launcher écoute via IPC, donc on retourne juste un succès
    res.json({ success: true, message: "Confirmation reçue" });
    
    // Note: Le launcher doit écouter les événements IPC ou WebSocket
    // pour recevoir cette confirmation. Cette route sert juste de confirmation HTTP.
  } catch (err) {
    // Logs d sactiv s
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      // Écho pour les tests
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (error) {
      // Logs d sactiv s
    }
  });

  ws.on("error", (error) => {
    // Logs d sactiv s
  });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Les gestionnaires d'erreur sont déjà définis au début du fichier

// Démarrer le serveur
const PORT = process.env.PORT || 3001;

// Démarrer le serveur avec gestion d'erreur améliorée
// FORCER IPv4 (127.0.0.1) pour éviter les problèmes de connexion IPv6
// Note: server est déjà créé avec http.createServer(app) plus haut, on utilise server.listen() au lieu de app.listen()
server.listen(PORT, '127.0.0.1', () => {
  // Server started
  console.log('  DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || '❌ MANQUANT');
  console.log('  DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI || '❌ MANQUANT');
  // Logs d sactiv s
  // Logs d sactiv s
  // Logs d sactiv s
  
  // IMPORTANT : Notifier Electron que le serveur Express écoute et est prêt
  if (process.send) {
    // Logs d sactiv s
    process.send({ type: 'backend-ready', port: PORT });
    // Logs d sactiv s
  }
  // Logs désactivés
}).on('error', (error) => {
  // Logs d sactiv s
  // Logs d sactiv s
  // Logs d sactiv s
  if (error.code !== 'EADDRINUSE') {
    // Logs d sactiv s
  }
});

