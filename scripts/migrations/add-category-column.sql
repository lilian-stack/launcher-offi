-- Script SQL pour ajouter la colonne 'category' à la table 'games' dans Supabase
-- 
-- Instructions:
-- 1. Allez sur https://supabase.com/dashboard
-- 2. Sélectionnez votre projet
-- 3. Allez dans "SQL Editor"
-- 4. Copiez-collez ce script
-- 5. Exécutez-le

-- Ajouter la colonne 'category' si elle n'existe pas déjà
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Optionnel: Ajouter un index pour améliorer les performances des requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_games_category ON games(category);

-- Vérifier que la colonne a été ajoutée
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'games' AND column_name = 'category';

