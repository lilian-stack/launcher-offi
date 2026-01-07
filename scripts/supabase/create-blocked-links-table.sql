-- Table pour stocker les sessions bloquées (système de blocage instantané)
-- Utilisée pour empêcher le partage de liens de téléchargement
-- link_id contient le sessionId unique généré par redirect.html

CREATE TABLE IF NOT EXISTS blocked_links (
  id BIGSERIAL PRIMARY KEY,
  link_id TEXT NOT NULL UNIQUE, -- sessionId unique
  game_id TEXT NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_blocked_links_link_id ON blocked_links(link_id);
CREATE INDEX IF NOT EXISTS idx_blocked_links_game_id ON blocked_links(game_id);
CREATE INDEX IF NOT EXISTS idx_blocked_links_expires_at ON blocked_links(expires_at);

-- Fonction pour nettoyer automatiquement les liens expirés
CREATE OR REPLACE FUNCTION cleanup_expired_blocked_links()
RETURNS void AS $$
BEGIN
  DELETE FROM blocked_links
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Créer un job pour nettoyer les liens expirés (à exécuter manuellement ou via cron)
-- Vous pouvez l'exécuter périodiquement avec pg_cron si disponible
COMMENT ON TABLE blocked_links IS 'Stocke les sessions de téléchargement bloquées pour empêcher le partage';
COMMENT ON COLUMN blocked_links.link_id IS 'sessionId unique généré par redirect.html (ex: session_1234567890_abc123)';
COMMENT ON COLUMN blocked_links.game_id IS 'ID du jeu associé';
COMMENT ON COLUMN blocked_links.expires_at IS 'Date d''expiration du blocage (24h par défaut)';

