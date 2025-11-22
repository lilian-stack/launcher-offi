# 🔧 Modification du serveur pour utiliser le port 20036

## Problème identifié
Katabump n'a alloué qu'un seul port : **20036**. Les ports 8080 et 3001 ne sont pas accessibles depuis l'extérieur.

## Solution : Utiliser le port 20036 pour Express + WebSocket

### Modifications à faire dans `launcher-server.js`

#### 1. Vérifier que `http` est importé (ligne ~13)
```javascript
const http = require("http");
```
✅ Déjà présent

#### 2. Modifier la création du serveur WebSocket (ligne ~25-28)

**REMPLACER :**
```javascript
// Initialiser le serveur WebSocket
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Écoute sur toutes les interfaces réseau
    port: 8080 
});
```

**PAR :**
```javascript
// Créer le serveur HTTP avec Express
const server = http.createServer(app);

// Créer le serveur WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });
```

#### 3. Modifier le démarrage du serveur (ligne ~248-253)

**REMPLACER :**
```javascript
// Démarrer le serveur Express
app.listen(3001, '0.0.0.0', () => {
    console.log("✅ API Express prête sur le port 3001 !");
    console.log("📡 WebSocket serveur prêt sur le port 8080 !");
});
```

**PAR :**
```javascript
// Démarrer le serveur Express
// Utiliser le port alloué par katabump (20036)
const PORT = process.env.PORT || 20036;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Express prête sur le port ${PORT} !`);
    console.log(`📡 WebSocket serveur prêt sur le port ${PORT} !`);
});
```

#### 4. Mettre à jour l'endpoint /status (ligne ~232-238)

**REMPLACER :**
```javascript
        websocket: {
            connected: launchers.length,
            port: 8080
        },
        api: {
            port: 3001,
            status: "running"
        },
```

**PAR :**
```javascript
        websocket: {
            connected: launchers.length,
            port: PORT || 20036
        },
        api: {
            port: PORT || 20036,
            status: "running"
        },
```

**Note :** Ajoutez `const PORT = process.env.PORT || 20036;` en haut du fichier (après les imports) si vous voulez l'utiliser dans `/status`.

### 5. Mettre à jour la configuration Electron

Modifiez `websocket-config.json` :

```json
{
  "wsUrl": "ws://51.68.234.157:20036",
  "apiUrl": "http://51.68.234.157:20036"
}
```

## Après les modifications

1. **Téléchargez le fichier modifié** sur votre hébergeur katabump
2. **Redémarrez le serveur**
3. **Testez la connexion** depuis votre application Electron

## Avantages de cette solution

- ✅ Utilise le port alloué par katabump (20036)
- ✅ WebSocket et API sur le même port (standard)
- ✅ Pas besoin d'ouvrir d'autres ports
- ✅ Compatible avec les limitations de katabump

## Test

Après redémarrage, vous devriez voir :
```
✅ API Express prête sur le port 20036 !
📡 WebSocket serveur prêt sur le port 20036 !
```

Et la connexion depuis Electron devrait fonctionner !


