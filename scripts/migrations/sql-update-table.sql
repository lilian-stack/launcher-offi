-- Ajouter les colonnes manquantes à la table games
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS cover_image TEXT,
ADD COLUMN IF NOT EXISTS genre JSONB,
ADD COLUMN IF NOT EXISTS release_date TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC,
ADD COLUMN IF NOT EXISTS is_vip_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS file_size TEXT,
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_installed BOOLEAN DEFAULT false;

-- Renommer 'name' en 'title' si nécessaire (garder les deux pour compatibilité)
-- ALTER TABLE games RENAME COLUMN name TO title;

