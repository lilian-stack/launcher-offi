// Script pour déployer uniquement les fichiers nécessaires sur Vercel
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const vercelDeployDir = path.join(projectRoot, 'vercel-deploy');

console.log('🚀 Déploiement Vercel (version minimale)...\n');
console.log('='.repeat(60));

// 1. Préparer le dossier de déploiement
console.log('📦 Étape 1 : Préparation du dossier de déploiement...\n');
try {
  execSync('node scripts/deploy/prepare-vercel-deploy.js', {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ Erreur lors de la préparation :', error.message);
  process.exit(1);
}

// 2. Vérifier que Vercel CLI est installé
console.log('\n🔍 Étape 2 : Vérification de Vercel CLI...\n');
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI détecté\n');
} catch (error) {
  console.error('❌ Vercel CLI n\'est pas installé !');
  console.error('   Installez-le avec : npm install -g vercel');
  process.exit(1);
}

// 3. Installer les dépendances dans le dossier de déploiement
console.log('📦 Étape 3 : Installation des dépendances...\n');
try {
  execSync('npm install', {
    cwd: vercelDeployDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.error('❌ Erreur lors de l\'installation des dépendances');
  process.exit(1);
}

// 4. Déployer sur Vercel
console.log('\n🚀 Étape 4 : Déploiement sur Vercel...\n');
try {
  execSync('vercel --prod --yes', {
    cwd: vercelDeployDir,
    stdio: 'inherit'
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Déploiement terminé avec succès !\n');
  console.log('📝 Prochaines étapes :\n');
  console.log('1. Configurez les variables d\'environnement sur Vercel :');
  console.log('   - JWT_SECRET');
  console.log('   - TOKEN_EXPIRY_SECONDS');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_KEY\n');
  console.log('2. Testez l\'API :');
  console.log('   curl https://votre-projet.vercel.app/api/redirect/health\n');
  console.log('3. Testez redirect.html :');
  console.log('   https://votre-projet.vercel.app/redirect.html\n');
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('\n❌ Erreur lors du déploiement :', error.message);
  console.error('\n💡 Assurez-vous d\'être connecté : vercel login');
  process.exit(1);
}

