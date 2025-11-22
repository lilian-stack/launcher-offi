# 🔧 Correction de l'erreur "Unexpected identifier 'server'"

## Problème
L'erreur `SyntaxError: Unexpected identifier 'server'` indique que `server` est utilisé avant d'être déclaré, ou qu'il y a un conflit avec `app.listen`.

## Solution : Ordre correct des déclarations

### Étape 1 : Vérifier les imports (lignes ~10-16)

Assurez-vous d'avoir :
```javascript
const WebSocket = require("ws");
const express = require("express");
const http = require("http");  // ← IMPORTANT : doit être présent
const { Client, ... } = require('discord.js');
```

### Étape 2 : Structure correcte (lignes ~20-30)

**L'ordre DOIT être :**

```javascript
// 1. Initialiser Express
const app = express();
app.use(express.json());

// 2. Créer le serveur HTTP avec Express
const server = http.createServer(app);

// 3. Créer le serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });
let launchers = [];
```

**❌ NE PAS FAIRE :**
```javascript
// ❌ Ne pas créer le serveur WebSocket séparément
const wss = new WebSocket.Server({ port: 8080 });  // ← SUPPRIMER
```

### Étape 3 : Modifier le démarrage (ligne ~248-253)

**REMPLACER :**
```javascript
app.listen(3001, '0.0.0.0', () => {
    console.log("✅ API Express prête sur le port 3001 !");
    console.log("📡 WebSocket serveur prêt sur le port 8080 !");
});
```

**PAR :**
```javascript
// Utiliser le port alloué par katabump (20036)
const PORT = process.env.PORT || 20036;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Express prête sur le port ${PORT} !`);
    console.log(`📡 WebSocket serveur prêt sur le port ${PORT} !`);
});
```

## Checklist de vérification

- [ ] `const http = require("http");` est présent dans les imports
- [ ] `const server = http.createServer(app);` est déclaré APRÈS `const app = express();`
- [ ] `const wss = new WebSocket.Server({ server });` utilise `server` et non `{ port: 8080 }`
- [ ] `app.listen(...)` a été REMPLACÉ par `server.listen(...)`
- [ ] Le port utilisé est `20036` (ou `process.env.PORT`)

## Structure finale attendue

```javascript
// Imports
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

// Express
const app = express();
app.use(express.json());

// Serveur HTTP
const server = http.createServer(app);

// WebSocket
const wss = new WebSocket.Server({ server });

// ... reste du code ...

// Démarrage
const PORT = process.env.PORT || 20036;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Express prête sur le port ${PORT} !`);
    console.log(`📡 WebSocket serveur prêt sur le port ${PORT} !`);
});
```

## Après correction

1. Vérifiez la syntaxe : `node --check launcher-server.js`
2. Redémarrez le serveur
3. Vérifiez les logs : vous devriez voir le port 20036


