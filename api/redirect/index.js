// API Serverless pour Vercel - Gestion des tokens de redirection
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Configuration depuis les variables d'environnement Vercel
const JWT_SECRET = process.env.JWT_SECRET || 'actoris_2024_secure_redirect_secret_change_in_production';
const TOKEN_EXPIRY_SECONDS = parseInt(process.env.TOKEN_EXPIRY_SECONDS || '30', 10);
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fpxcefuqwvwdduzkmkrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Fonction pour hasher un token
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Note: Les headers CORS sont gérés dans jsonResponse()

// Fonction helper pour les réponses
function jsonResponse(res, statusCode, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  res.status(statusCode).json(data);
}

// Handler principal pour Vercel Serverless Functions
export default async function handler(req, res) {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const { method } = req;
  
  // Extraire le chemin depuis l'URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const path = pathParts[pathParts.length - 1] || '';
  
  // Parser le body si présent
  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      body = {};
    }
  }

  try {
    // Route: POST /api/redirect/generate-token
    if (method === 'POST' && path === 'generate-token') {
      const { userId, gameId, gameName } = body || {};
      
      if (!gameId) {
        return jsonResponse(res, 400, { 
          error: 'gameId est requis',
          success: false 
        });
      }
      
      const nonce = crypto.randomBytes(16).toString('hex');
      const payload = {
        userId: userId || 'anonymous',
        gameId,
        gameName: gameName || null,
        nonce,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS,
      };
      
      const token = jwt.sign(payload, JWT_SECRET);
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + (TOKEN_EXPIRY_SECONDS * 1000));
      
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
          ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown'
        });
      
      if (insertError) {
        console.error('[Redirect API] ❌ Erreur insertion:', insertError);
        return jsonResponse(res, 500, { 
          error: 'Erreur lors de la création du token',
          success: false 
        });
      }
      
      // Construire l'URL de redirection
      const redirectUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}/redirect.html?token=${encodeURIComponent(token)}`
        : `${url.origin}/redirect.html?token=${encodeURIComponent(token)}`;
      
      return jsonResponse(res, 200, { 
        success: true,
        token,
        redirectUrl: redirectUrl,
        expiresIn: TOKEN_EXPIRY_SECONDS
      });
    }

    // Route: POST /api/redirect/validate-token
    if (method === 'POST' && path === 'validate-token') {
      const { token } = body || {};
      
      if (!token) {
        return jsonResponse(res, 400, { 
          valid: false, 
          error: 'Token manquant' 
        });
      }
      
      const tokenHash = hashToken(token);
      
      const { data: tokenData, error: fetchError } = await supabase
        .from('redirect_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .single();
      
      if (fetchError || !tokenData) {
        return jsonResponse(res, 403, { 
          valid: false, 
          error: 'Token invalide ou introuvable' 
        });
      }
      
      if (tokenData.is_consumed) {
        return jsonResponse(res, 403, { 
          valid: false, 
          error: 'Ce lien a déjà été utilisé. Chaque lien ne peut être utilisé qu\'une seule fois.' 
        });
      }
      
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return jsonResponse(res, 403, { 
          valid: false, 
          error: `Ce lien a expiré. Les liens sont valides pendant ${TOKEN_EXPIRY_SECONDS} secondes seulement.` 
        });
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.nonce !== tokenData.nonce) {
          return jsonResponse(res, 403, { 
            valid: false, 
            error: 'Token corrompu ou modifié' 
          });
        }
        
        return jsonResponse(res, 200, { 
          valid: true,
          userId: tokenData.user_id,
          gameId: tokenData.game_id,
          gameName: tokenData.game_name,
          nonce: tokenData.nonce
        });
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return jsonResponse(res, 403, { 
            valid: false, 
            error: `Ce lien a expiré. Les liens sont valides pendant ${TOKEN_EXPIRY_SECONDS} secondes seulement.` 
          });
        }
        
        return jsonResponse(res, 403, { 
          valid: false, 
          error: 'Token invalide ou corrompu' 
        });
      }
    }

    // Route: POST /api/redirect/consume-token
    if (method === 'POST' && path === 'consume-token') {
      const { token } = body || {};
      
      if (!token) {
        return jsonResponse(res, 400, { 
          error: 'Token manquant',
          consumed: false 
        });
      }
      
      const tokenHash = hashToken(token);
      
      const { data, error } = await supabase
        .from('redirect_tokens')
        .update({ 
          is_consumed: true,
          consumed_at: new Date().toISOString()
        })
        .eq('token_hash', tokenHash)
        .eq('is_consumed', false)
        .select();
      
      if (error) {
        return jsonResponse(res, 500, { 
          error: 'Erreur lors de la consommation du token',
          consumed: false 
        });
      }
      
      if (!data || data.length === 0) {
        return jsonResponse(res, 404, { 
          error: 'Token déjà consommé ou introuvable',
          consumed: false 
        });
      }
      
      return jsonResponse(res, 200, { 
        consumed: true,
        message: 'Token consommé avec succès',
        gameId: data[0].game_id
      });
    }

    // Route: GET /api/redirect/health
    if (method === 'GET' && path === 'health') {
      const { count, error } = await supabase
        .from('redirect_tokens')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        return jsonResponse(res, 503, { 
          status: 'error',
          message: 'Supabase connection failed',
          error: error.message 
        });
      }
      
      return jsonResponse(res, 200, { 
        status: 'ok',
        supabase: 'connected',
        totalTokens: count || 0,
        timestamp: new Date().toISOString()
      });
    }

    // Route: GET /api/redirect/stats
    if (method === 'GET' && path === 'stats') {
      const { data: stats, error } = await supabase
        .from('redirect_tokens')
        .select('is_consumed, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      
      if (error) {
        return jsonResponse(res, 500, { error: error.message });
      }
      
      const consumed = stats.filter(s => s.is_consumed).length;
      const total = stats.length;
      
      return jsonResponse(res, 200, {
        last24h: {
          total,
          consumed,
          unused: total - consumed
        }
      });
    }

    // Route: POST /api/redirect/block-session
    // Endpoint appelé par le LAUNCHER pour bloquer une session immédiatement
    if (method === 'POST' && path === 'block-session') {
      const { sessionId, gameId } = body || {};
      
      if (!sessionId || !gameId) {
        return jsonResponse(res, 400, { 
          success: false,
          error: 'sessionId et gameId requis' 
        });
      }
      
      try {
        // Vérifier si la session est déjà bloquée
        const { data: existing, error: checkError } = await supabase
          .from('blocked_links')
          .select('*')
          .eq('link_id', sessionId)
          .single();
        
        if (existing && !checkError) {
          // Vérifier si le blocage n'a pas expiré
          const expiresAt = new Date(existing.expires_at);
          if (expiresAt > new Date()) {
            console.log(`[BlockSession] ⚠️ Session déjà bloquée: ${sessionId}`);
            return jsonResponse(res, 200, { 
              success: false,
              message: 'Session déjà bloquée',
              alreadyBlocked: true
            });
          }
        }
        
        // Bloquer la session dans Supabase (expire après 24 heures)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
        
        const { error: insertError } = await supabase
          .from('blocked_links')
          .insert({
            link_id: sessionId,
            game_id: gameId.toString(),
            blocked_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown'
          });
        
        if (insertError) {
          console.error('[BlockSession] ❌ Erreur insertion:', insertError);
          return jsonResponse(res, 500, { 
            success: false,
            error: 'Erreur lors du blocage de la session' 
          });
        }
        
        console.log(`[BlockSession] 🔒 Session bloquée avec succès: game=${gameId}, sessionId=${sessionId}`);
        
        return jsonResponse(res, 200, { 
          success: true,
          message: 'Session bloquée avec succès',
          sessionId,
          gameId
        });
        
      } catch (err) {
        console.error('[BlockSession] ❌ Erreur:', err);
        return jsonResponse(res, 500, { 
          success: false,
          error: 'Erreur serveur' 
        });
      }
    }

    // Route: POST /api/redirect/check-session
    // Endpoint pour vérifier si une session est bloquée
    if (method === 'POST' && path === 'check-session') {
      const { sessionId, gameId } = body || {};
      
      if (!sessionId) {
        return jsonResponse(res, 400, { 
          blocked: false,
          used: false,
          error: 'sessionId requis' 
        });
      }
      
      try {
        // Vérifier si la session est bloquée
        const { data: blocked, error: fetchError } = await supabase
          .from('blocked_links')
          .select('*')
          .eq('link_id', sessionId)
          .single();
        
        if (blocked && !fetchError) {
          // Vérifier si le blocage n'a pas expiré
          const expiresAt = new Date(blocked.expires_at);
          if (expiresAt > new Date()) {
            console.log(`[CheckSession] 🔒 Session bloquée détectée: ${sessionId}`);
            return jsonResponse(res, 200, { 
              blocked: true,
              used: true,
              blockedAt: blocked.blocked_at,
              gameId: blocked.game_id
            });
          } else {
            // Le blocage a expiré, le supprimer
            await supabase
              .from('blocked_links')
              .delete()
              .eq('link_id', sessionId);
          }
        }
        
        console.log(`[CheckSession] ✅ Session non bloquée: ${sessionId}`);
        return jsonResponse(res, 200, { 
          blocked: false,
          used: false,
          sessionId
        });
        
      } catch (err) {
        console.error('[CheckSession] ❌ Erreur:', err);
        return jsonResponse(res, 500, { 
          blocked: false,
          used: false,
          error: 'Erreur serveur' 
        });
      }
    }

    // Route non trouvée
    return jsonResponse(res, 404, { 
      error: 'Route non trouvée',
      availableRoutes: [
        'POST /api/redirect/generate-token',
        'POST /api/redirect/validate-token',
        'POST /api/redirect/consume-token',
        'POST /api/redirect/block-session',
        'POST /api/redirect/check-session',
        'GET /api/redirect/health',
        'GET /api/redirect/stats'
      ]
    });

  } catch (error) {
    console.error('[Redirect API] ❌ Erreur:', error);
    return jsonResponse(res, 500, { 
      error: 'Erreur serveur',
      message: error.message 
    });
  }
}

