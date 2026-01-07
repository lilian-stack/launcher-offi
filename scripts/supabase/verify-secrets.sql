-- ============================================
-- Script de vérification des secrets
-- ============================================
-- À exécuter dans l'éditeur SQL de Supabase pour vérifier que tout est bien configuré

-- Vérifier que tous les secrets sont présents
SELECT 
  key, 
  CASE 
    WHEN key LIKE '%SECRET%' OR key LIKE '%TOKEN%' THEN '***masqué*** (' || LENGTH(value) || ' caractères)'
    ELSE LEFT(value, 30) || '...'
  END as value_preview,
  description,
  created_at,
  updated_at
FROM app_secrets
ORDER BY key;

-- Compter le nombre de secrets
SELECT COUNT(*) as total_secrets FROM app_secrets;

-- Vérifier que les secrets critiques sont remplis (pas de valeurs vides)
SELECT 
  key,
  CASE 
    WHEN value IS NULL OR value = '' THEN '❌ VIDE'
    ELSE '✅ OK'
  END as status,
  LENGTH(value) as longueur
FROM app_secrets
WHERE key IN ('DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_TOKEN', 'DISCORD_GUILD_ID')
ORDER BY key;

