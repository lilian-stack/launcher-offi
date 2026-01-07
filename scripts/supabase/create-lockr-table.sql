-- Table dédiée pour les liens et casiers Lockr
-- Cette table stocke tous les liens Lockr associés aux jeux

CREATE TABLE IF NOT EXISTS lockr_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Association avec le jeu
  game_id TEXT NOT NULL,
  game_name TEXT,
  
  -- Informations Lockr
  lockr_url TEXT NOT NULL,
  lockr_casier_id TEXT, -- ID du casier Lockr (optionnel)
  lockr_casier_name TEXT, -- Nom du casier (optionnel)
  
  -- Statut
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false, -- Vérifié manuellement ou automatiquement
  
  -- Métadonnées
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- ID de l'utilisateur qui a créé le lien
  last_used_at TIMESTAMPTZ, -- Dernière utilisation du lien
  
  -- Statistiques d'utilisation
  usage_count INTEGER NOT NULL DEFAULT 0, -- Nombre de fois que le lien a été utilisé
  
  -- Notes et commentaires
  notes TEXT, -- Notes optionnelles sur le lien
  
  -- Contraintes
  CONSTRAINT unique_game_lockr UNIQUE(game_id, lockr_url)
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_lockr_links_game_id ON lockr_links(game_id);
CREATE INDEX IF NOT EXISTS idx_lockr_links_lockr_url ON lockr_links(lockr_url);
CREATE INDEX IF NOT EXISTS idx_lockr_links_is_active ON lockr_links(is_active);
CREATE INDEX IF NOT EXISTS idx_lockr_links_is_verified ON lockr_links(is_verified);
CREATE INDEX IF NOT EXISTS idx_lockr_links_created_at ON lockr_links(created_at);
CREATE INDEX IF NOT EXISTS idx_lockr_links_last_used_at ON lockr_links(last_used_at);

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_lockr_links_active_verified ON lockr_links(is_active, is_verified);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_lockr_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS trigger_update_lockr_links_updated_at ON lockr_links;
CREATE TRIGGER trigger_update_lockr_links_updated_at
  BEFORE UPDATE ON lockr_links
  FOR EACH ROW
  EXECUTE FUNCTION update_lockr_links_updated_at();

-- Fonction pour incrémenter le compteur d'utilisation
CREATE OR REPLACE FUNCTION increment_lockr_link_usage(link_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE lockr_links
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les liens Lockr actifs et vérifiés
CREATE OR REPLACE VIEW lockr_links_active AS
SELECT 
  id,
  game_id,
  game_name,
  lockr_url,
  lockr_casier_id,
  lockr_casier_name,
  usage_count,
  last_used_at,
  created_at,
  updated_at
FROM lockr_links
WHERE is_active = true AND is_verified = true;

-- Vue pour les statistiques par jeu
CREATE OR REPLACE VIEW lockr_links_stats AS
SELECT 
  game_id,
  game_name,
  COUNT(*) as total_links,
  COUNT(*) FILTER (WHERE is_active = true) as active_links,
  COUNT(*) FILTER (WHERE is_verified = true) as verified_links,
  SUM(usage_count) as total_usage,
  MAX(last_used_at) as last_used
FROM lockr_links
GROUP BY game_id, game_name;

-- Commentaires pour la documentation
COMMENT ON TABLE lockr_links IS 'Stocke tous les liens Lockr associés aux jeux';
COMMENT ON COLUMN lockr_links.game_id IS 'ID du jeu (correspond à games.id)';
COMMENT ON COLUMN lockr_links.lockr_url IS 'URL complète du lien Lockr';
COMMENT ON COLUMN lockr_links.lockr_casier_id IS 'ID du casier Lockr (si disponible)';
COMMENT ON COLUMN lockr_links.is_active IS 'Indique si le lien est actif et utilisable';
COMMENT ON COLUMN lockr_links.is_verified IS 'Indique si le lien a été vérifié manuellement ou automatiquement';
COMMENT ON COLUMN lockr_links.usage_count IS 'Nombre de fois que le lien a été utilisé';
COMMENT ON COLUMN lockr_links.last_used_at IS 'Date de la dernière utilisation du lien';

-- Exemple de données de test (optionnel, à supprimer en production)
-- INSERT INTO lockr_links (game_id, game_name, lockr_url, is_verified) VALUES
-- ('1144200', 'Ready or Not', 'https://actoris-redirect.vercel.app/redirect.html?game=Ready%20or%20Not&gameId=1144200', true);

