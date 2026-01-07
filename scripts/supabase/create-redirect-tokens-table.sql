-- Table pour stocker les tokens de redirection utilisés
-- Cette table empêche la réutilisation des liens de téléchargement

CREATE TABLE IF NOT EXISTS redirect_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Token JWT (hashé pour la sécurité)
  token_hash TEXT NOT NULL UNIQUE,
  
  -- Informations du jeu
  game_id TEXT NOT NULL,
  game_name TEXT,
  
  -- Informations utilisateur
  user_id TEXT,
  
  -- Nonce unique pour empêcher la réutilisation
  nonce TEXT NOT NULL UNIQUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Statut
  is_consumed BOOLEAN NOT NULL DEFAULT false,
  
  -- Métadonnées
  ip_address TEXT,
  user_agent TEXT
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_token_hash ON redirect_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_nonce ON redirect_tokens(nonce);
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_is_consumed ON redirect_tokens(is_consumed);
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_expires_at ON redirect_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_game_id ON redirect_tokens(game_id);
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_user_id ON redirect_tokens(user_id);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_redirect_tokens_consumed_expires ON redirect_tokens(is_consumed, expires_at);

-- Fonction pour nettoyer automatiquement les anciens tokens (optionnel)
-- Cette fonction peut être appelée périodiquement via un cron job Supabase
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM redirect_tokens
  WHERE expires_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour la documentation
COMMENT ON TABLE redirect_tokens IS 'Stocke les tokens de redirection pour empêcher la réutilisation des liens de téléchargement';
COMMENT ON COLUMN redirect_tokens.token_hash IS 'Hash SHA-256 du token JWT pour la recherche rapide';
COMMENT ON COLUMN redirect_tokens.nonce IS 'Nonce unique pour empêcher la réutilisation même avec le même token';
COMMENT ON COLUMN redirect_tokens.is_consumed IS 'Indique si le token a déjà été utilisé';
COMMENT ON COLUMN redirect_tokens.expires_at IS 'Date d''expiration du token (généralement 30 secondes après création)';

