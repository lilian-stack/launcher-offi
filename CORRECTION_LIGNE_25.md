# 🔧 Correction de l'erreur ligne 25

## ❌ Erreur actuelle (ligne 25)

```javascript
const wss = new WebSocket.Server({ const server = http.createServer(app);
```

**Problème :** Les deux déclarations sont fusionnées en une seule ligne, ce qui est syntaxiquement incorrect.

## ✅ Correction : Séparer en deux lignes

**REMPLACER la ligne 25 par :**

```javascript
// Créer le serveur HTTP avec Express
const server = http.createServer(app);

// Créer le serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });
```

## Structure complète correcte (lignes ~22-30)

```javascript
// Initialiser Express
const app = express();
app.use(express.json());

// Créer le serveur HTTP avec Express
const server = http.createServer(app);

// Créer le serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });
let launchers = [];
```

## Points importants

1. **`const server`** doit être sur sa propre ligne
2. **`const wss`** doit être sur sa propre ligne
3. **`server`** est créé AVANT `wss`
4. **`wss`** utilise `{ server }` et non `{ port: 8080 }`

## Après correction

1. Vérifiez que les deux lignes sont bien séparées
2. Redémarrez le serveur
3. Le serveur devrait démarrer sans erreur


