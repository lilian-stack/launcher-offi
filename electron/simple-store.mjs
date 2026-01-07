import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class SimpleStore {
  constructor(options = {}) {
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, (options.name || 'config') + '.json');
    this.data = this.load();
    this.defaults = options.defaults || {};
    
    // Appliquer les valeurs par défaut si nécessaire
    if (Object.keys(this.defaults).length > 0) {
      let updated = false;
      for (const [key, value] of Object.entries(this.defaults)) {
        if (!(key in this.data)) {
          this.data[key] = value;
          updated = true;
        }
      }
      if (updated) {
        this.save();
      }
    }
  }

  load() {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[SimpleStore] Erreur de lecture:', error);
    }
    return {};
  }

  save() {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('[SimpleStore] Erreur d\'écriture:', error);
    }
  }

  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  has(key) {
    return key in this.data;
  }

  delete(key) {
    delete this.data[key];
    this.save();
  }

  clear() {
    this.data = {};
    this.save();
  }

  get store() {
    return this.data;
  }

  set store(value) {
    this.data = value;
    this.save();
  }
}

export default SimpleStore;

