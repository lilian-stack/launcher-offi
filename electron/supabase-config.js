// Configuration Supabase
export const SUPABASE_CONFIG = {
  // URL de votre projet Supabase
  URL: process.env.SUPABASE_URL || 'https://fpxcefuqwvwdduzkmkrj.supabase.co',
  
  // Clé API publique (anon key) de Supabase
  ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NTI0MjksImV4cCI6MjA3OTQyODQyOX0.eav7rVxbs4fV6LxJs6y7c4zV9279X0DX0gEJtGPMdo8',
  
  // Clé API de service (service_role key) - pour les opérations admin
  // ⚠️ Ne jamais exposer cette clé côté client !
  SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweGNlZnVxd3Z3ZGR1emtta3JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg1MjQyOSwiZXhwIjoyMDc5NDI4NDI5fQ.Pp_nQhbXBDnpx88lnNRRU3e0Xfih62iOTy7GIZYiEyA',
  
  // Nom de la table dans Supabase
  GAMES_TABLE: 'games',
}

