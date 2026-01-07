-- ============================================
-- Table pour stocker les secrets de l'application
-- ============================================
-- Cette table stocke les secrets Discord et autres secrets sensibles
-- Protégée par RLS (Row Level Security) pour permettre uniquement la lecture

CREATE TABLE IF NOT EXISTS app_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour accès rapide par clé
CREATE INDEX IF NOT EXISTS idx_app_secrets_key ON app_secrets(key);

-- ============================================
-- Insérer les secrets Discord
-- ============================================
-- Remplacez les valeurs par vos propres secrets !

INSERT INTO app_secrets (key, value, description) VALUES
('DISCORD_CLIENT_ID', '1398485031189483642', 'Discord Application Client ID'),
('DISCORD_CLIENT_SECRET', 'VOTRE_CLIENT_SECRET_ICI', 'Discord Application Secret - À REMPLACER'),
('DISCORD_TOKEN', 'VOTRE_BOT_TOKEN_ICI', 'Discord Bot Token - À REMPLACER'),
('DISCORD_GUILD_ID', '1332072935682478202', 'Discord Server ID'),
('DISCORD_ROLE_MEMBER', '1332077241722605700', 'Member Role ID'),
('DISCORD_ROLE_VIP', '1351995593383350302', 'VIP Role ID'),
('DISCORD_ROLE_BOOST', '1332111013205770282', 'Boost Role ID'),
('DISCORD_ROLE_ADMIN', '1332076547422683268', 'Admin Role ID')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 🔒 SÉCURITÉ : Row Level Security (RLS)
-- ============================================
-- Activer RLS sur la table
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes si elles existent (pour éviter les erreurs)
DROP POLICY IF EXISTS "Allow public read access" ON app_secrets;
DROP POLICY IF EXISTS "Prevent public modifications" ON app_secrets;

-- Politique : Tout le monde peut LIRE (SELECT)
CREATE POLICY "Allow public read access" 
ON app_secrets 
FOR SELECT 
USING (true);

-- Politique : Personne ne peut MODIFIER via l'API publique
-- ⚠️ Les modifications doivent être faites depuis le Dashboard Supabase
CREATE POLICY "Prevent public modifications" 
ON app_secrets 
FOR ALL 
USING (false)
WITH CHECK (false);

-- ============================================
-- Fonction pour mettre à jour updated_at automatiquement
-- ============================================
CREATE OR REPLACE FUNCTION update_app_secrets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_app_secrets_updated_at ON app_secrets;
CREATE TRIGGER trigger_update_app_secrets_updated_at
  BEFORE UPDATE ON app_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_app_secrets_updated_at();

-- ============================================
-- Vérification
-- ============================================
-- Vérifier que les secrets sont bien insérés
SELECT key, 
       CASE 
         WHEN key LIKE '%SECRET%' OR key LIKE '%TOKEN%' THEN '***masqué***'
         ELSE LEFT(value, 20) || '...'
       END as value_preview,
       description
FROM app_secrets
ORDER BY key;

