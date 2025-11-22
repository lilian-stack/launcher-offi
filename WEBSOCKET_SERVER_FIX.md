# 🔧 Correction du serveur WebSocket pour connexions externes

## Problème
Le serveur WebSocket refuse les connexions depuis l'extérieur (`ECONNREFUSED`) car il écoute probablement uniquement sur `localhost` au lieu de toutes les interfaces réseau.

## Solution

Sur votre hébergeur, modifiez le fichier `launcher-server.js` pour que le serveur WebSocket écoute sur toutes les interfaces (`0.0.0.0`) :

### Modification à faire dans `launcher-server.js`

**AVANT (ne fonctionne que localement) :**
```javascript
const wss = new WebSocket.Server({ port: 8080 });
```

**APRÈS (accepte les connexions externes) :**
```javascript
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Écoute sur toutes les interfaces
    port: 8080 
});
```

**ET pour l'API Express :**
```javascript
// AVANT
app.listen(3001, () => {
    console.log("✅ API Express prête sur le port 3001 !");
});

// APRÈS
app.listen(3001, '0.0.0.0', () => {
    console.log("✅ API Express prête sur le port 3001 !");
});
```

## Vérification

1. **Redémarrez le serveur** sur votre hébergeur après les modifications
2. **Vérifiez que les ports sont ouverts** dans le firewall de votre hébergeur :
   - Port 8080 (WebSocket)
   - Port 3001 (API Express)
3. **Testez la connexion** depuis votre application Electron

## Configuration actuelle

Votre application Electron est configurée pour se connecter à :
- WebSocket : `ws://51.68.234.157:8080`
- API : `http://51.68.234.157:3001`

Ces adresses sont définies dans `websocket-config.json`.


