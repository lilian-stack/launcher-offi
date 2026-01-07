// Backend API pour la validation sécurisée des tokens de redirection
// Utilise JWT + Supabase pour empêcher le partage de liens

import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔑 Configuration
const JWT_SECRET = process.env.JWT_SECRET || process.env.REDIRECT_JWT_SECRET || 'actoris_2024_secure_redirect_secret_change_in_production';
const TOKEN_EXPIRY_SECONDS = parseInt(process.env.TOKEN_EXPIRY_SECONDS || '30', 10); // 30 secondes par défaut

// 📦 Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fpxcefuqwvwdduzkmkrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA';

// Initialiser le client Supabase avec la service key (pour les opérations admin)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 🔐 Fonction pour hasher un token (SHA-256)
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 📍 ENDPOINT 1 : Générer un token sécurisé (appelé par Lockr.so ou le launcher)
app.post('/api/redirect/generate-token', async (req, res) => {
  try {
    const { userId, gameId, gameName } = req.body;
    
    // Vérifier les paramètres requis
    if (!gameId) {
      return res.status(400).json({ 
        error: 'gameId est requis',
        success: false 
      });
    }
    
    // Générer un nonce unique (empêche la réutilisation)
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Créer le payload JWT
    const payload = {
      userId: userId || 'anonymous',
      gameId,
      gameName: gameName || null,
      nonce,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
    };
    
    // Signer le token
    const token = jwt.sign(payload, JWT_SECRET);
    const tokenHash = hashToken(token);
    
    // Calculer la date d'expiration
    const expiresAt = new Date(Date.now() + (TOKEN_EXPIRY_SECONDS * 1000));
    
    // Stocker le token dans Supabase (avant qu'il soit utilisé)
    const { error: insertError } = await supabase
      .from('redirect_tokens')
      .insert({
        token_hash: tokenHash,
        game_id: gameId.toString(),
        game_name: gameName || null,
        user_id: userId || null,
        nonce: nonce,
        expires_at: expiresAt.toISOString(),
        is_consumed: false,
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown'
      });
    
    if (insertError) {
      console.error('[Redirect API] ❌ Erreur lors de l\'insertion du token:', insertError);
      return res.status(500).json({ 
        error: 'Erreur lors de la création du token',
        success: false 
      });
    }
    
    
    res.json({ 
      success: true,
      token,
      redirectUrl: `https://actoris-redirect.vercel.app/redirect.html?token=${encodeURIComponent(token)}`,
      expiresIn: TOKEN_EXPIRY_SECONDS
    });
    
  } catch (error) {
    console.error('[Redirect API] ❌ Erreur lors de la génération du token:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la génération du token',
      success: false 
    });
  }
});

// 📍 ENDPOINT 2 : Valider un token (appelé par redirect.html)
app.post('/api/redirect/validate-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Token manquant' 
      });
    }
    
    const tokenHash = hashToken(token);
    
    // Vérifier dans Supabase si le token existe et n'est pas consommé
    const { data: tokenData, error: fetchError } = await supabase
      .from('redirect_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();
    
    if (fetchError || !tokenData) {
      console.log(`[Redirect API] ❌ Token non trouvé dans la base de données`);
      return res.status(403).json({ 
        valid: false, 
        error: 'Token invalide ou introuvable' 
      });
    }
    
    // Vérifier si le token est déjà consommé
    if (tokenData.is_consumed) {
      console.log(`[Redirect API] ❌ Token déjà utilisé: game=${tokenData.game_id}`);
      return res.status(403).json({ 
        valid: false, 
        error: 'Ce lien a déjà été utilisé. Chaque lien ne peut être utilisé qu\'une seule fois.' 
      });
    }
    
    // Vérifier si le token a expiré
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.log(`[Redirect API] ❌ Token expiré: game=${tokenData.game_id}`);
      return res.status(403).json({ 
        valid: false, 
        error: `Ce lien a expiré. Les liens sont valides pendant ${TOKEN_EXPIRY_SECONDS} secondes seulement.` 
      });
    }
    
    // Vérifier la signature JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Vérifier que le nonce correspond
      if (decoded.nonce !== tokenData.nonce) {
        console.log(`[Redirect API] ❌ Nonce ne correspond pas: game=${tokenData.game_id}`);
        return res.status(403).json({ 
          valid: false, 
          error: 'Token corrompu ou modifié' 
        });
      }
      
      
      res.json({ 
        valid: true,
        userId: tokenData.user_id,
        gameId: tokenData.game_id,
        gameName: tokenData.game_name,
        nonce: tokenData.nonce
      });
      
    } catch (jwtError) {
      console.log(`[Redirect API] ❌ Erreur JWT: ${jwtError.message}`);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(403).json({ 
          valid: false, 
          error: `Ce lien a expiré. Les liens sont valides pendant ${TOKEN_EXPIRY_SECONDS} secondes seulement.` 
        });
      }
      
      return res.status(403).json({ 
        valid: false, 
        error: 'Token invalide ou corrompu' 
      });
    }
    
  } catch (error) {
    console.error('[Redirect API] ❌ Erreur lors de la validation:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Erreur serveur lors de la validation' 
    });
  }
});

// 📍 ENDPOINT 3 : Marquer un token comme utilisé (appelé après validation réussie)
app.post('/api/redirect/consume-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        error: 'Token manquant',
        consumed: false 
      });
    }
    
    const tokenHash = hashToken(token);
    
    // Marquer le token comme consommé dans Supabase
    const { data, error } = await supabase
      .from('redirect_tokens')
      .update({ 
        is_consumed: true,
        consumed_at: new Date().toISOString()
      })
      .eq('token_hash', tokenHash)
      .eq('is_consumed', false) // Ne mettre à jour que si pas déjà consommé
      .select();
    
    if (error) {
      console.error('[Redirect API] ❌ Erreur lors de la consommation:', error);
      return res.status(500).json({ 
        error: 'Erreur lors de la consommation du token',
        consumed: false 
      });
    }
    
    if (!data || data.length === 0) {
      console.log(`[Redirect API] ⚠️ Token déjà consommé ou introuvable`);
      return res.status(404).json({ 
        error: 'Token déjà consommé ou introuvable',
        consumed: false 
      });
    }
    
    
    res.json({ 
      consumed: true,
      message: 'Token consommé avec succès',
      gameId: data[0].game_id
    });
    
  } catch (error) {
    console.error('[Redirect API] ❌ Erreur lors de la consommation:', error);
    res.status(500).json({ 
      error: 'Erreur serveur lors de la consommation',
      consumed: false 
    });
  }
});

// 🏥 Health check
app.get('/api/redirect/health', async (req, res) => {
  try {
    // Vérifier la connexion à Supabase
    const { count, error } = await supabase
      .from('redirect_tokens')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return res.status(503).json({ 
        status: 'error',
        message: 'Supabase connection failed',
        error: error.message 
      });
    }
    
    res.json({ 
      status: 'ok',
      supabase: 'connected',
      totalTokens: count || 0,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

// 📊 Statistiques (optionnel, pour le monitoring)
app.get('/api/redirect/stats', async (req, res) => {
  try {
    const { data: stats, error } = await supabase
      .from('redirect_tokens')
      .select('is_consumed, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Dernières 24h
    
    if (error) {
      throw error;
    }
    
    const consumed = stats.filter(s => s.is_consumed).length;
    const total = stats.length;
    
    res.json({
      last24h: {
        total,
        consumed,
        unused: total - consumed
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exporter l'app Express pour être montée dans un serveur principal
export default app;

// Si ce fichier est exécuté directement, démarrer le serveur
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
  });
}

