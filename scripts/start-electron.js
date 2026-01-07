const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage d\'Electron...');

// Démarrer Electron avec la commande correcte pour Windows
const electronProcess = spawn('npm', ['run', 'electron'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true
});

electronProcess.on('close', (code) => {
  console.log(`Electron fermé avec le code ${code}`);
  process.exit(code);
});

electronProcess.on('error', (err) => {
  console.error('Erreur lors du démarrage d\'Electron:', err);
  process.exit(1);
});