-- Script SQL pour ajouter la colonne is_online à la table games dans Supabase
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE games 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_games_is_online ON games(is_online);

-- Commentaire sur la colonne
COMMENT ON COLUMN games.is_online IS 'Indique si le jeu est disponible sur online-fix.me (true) ou non (false)';

