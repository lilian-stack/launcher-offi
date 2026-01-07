
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ELECTRON_DIR = path.join(ROOT_DIR, 'electron');

const DIRECTORIES = [
  path.join(ELECTRON_DIR, 'handlers'),
  path.join(ELECTRON_DIR, 'services'),
  path.join(ELECTRON_DIR, 'services', 'download-providers'),
  path.join(ELECTRON_DIR, 'utils'), // Be careful here, some might be CJS
];

// Files to skip (already .mjs or specific exclusions)
const SKIP_FILES = [
  'preload.cjs',
  'main.js', // Keep main.js as CJS for now
];

function processContent(content) {
  // 1. Fix Electron imports
  // import { ipcMain } from 'electron' -> import electron from 'electron'; const { ipcMain } = electron;
  content = content.replace(/import\s+\{\s*([\s\S]*?)\s*\}\s+from\s+['"]electron['"]/g, (match, imports) => {
    return `import electron from 'electron';\nconst { ${imports.trim()} } = electron`;
  });

  // 2. Fix local imports (.js -> .mjs)
  // from './something.js' -> from './something.mjs'
  content = content.replace(/from\s+['"](\..+?)\.js['"]/g, "from '$1.mjs'");
  // import ... from './something.js'
  // import('./something.js')
  content = content.replace(/import\s*\(\s*['"](\..+?)\.js['"]\s*\)/g, "import('$1.mjs')");

  return content;
}

async function migrate() {
  console.log('Starting migration to ESM...');

  for (const dir of DIRECTORIES) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      if (!file.endsWith('.js')) continue;
      if (SKIP_FILES.includes(file)) continue;

      const oldPath = path.join(dir, file);
      const newPath = path.join(dir, file.replace(/\.js$/, '.mjs'));

      console.log(`Processing ${file}...`);

      let content = fs.readFileSync(oldPath, 'utf8');
      
      // Check if it's already using ESM syntax
      const hasExport = /export\s+/.test(content);
      const hasImport = /import\s+/.test(content);
      
      if (!hasExport && !hasImport) {
        console.log(`  Skipping ${file} (seems to be CJS or no imports/exports)`);
        // We might want to rename it anyway if it's imported by others?
        // For now, let's only migrate clear ESM files.
        continue;
      }

      const newContent = processContent(content);

      fs.writeFileSync(newPath, newContent);
      console.log(`  Created ${path.basename(newPath)}`);
      
      // Optional: Delete old file
      // fs.unlinkSync(oldPath); 
    }
  }

  console.log('Migration completed.');
}

migrate().catch(console.error);
