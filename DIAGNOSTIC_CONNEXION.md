# 🔍 Diagnostic de la connexion WebSocket

## Problème actuel
L'application Electron essaie de se connecter à `ws://51.68.234.157:8080` mais reçoit `ECONNREFUSED`.

## ✅ Vérifications à faire sur l'hébergeur

### 1. Vérifier que le fichier a été mis à jour

Sur votre hébergeur, vérifiez que le fichier contient bien :

```javascript
// Ligne ~25
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Écoute sur toutes les interfaces réseau
    port: 8080 
});

// Ligne ~248
app.listen(3001, '0.0.0.0', () => {
    console.log("✅ API Express prête sur le port 3001 !");
});
```

### 2. Vérifier que le serveur a été redémarré

Après avoir modifié le fichier, **redémarrez obligatoirement le serveur** :
- Arrêtez le processus actuel (Ctrl+C ou commande d'arrêt)
- Relancez avec `node launcher-server.js` (ou `node index.js`)

### 3. Vérifier les ports dans le firewall

Sur votre hébergeur katabump, assurez-vous que :
- Le port **8080** est ouvert pour les connexions entrantes
- Le port **3001** est ouvert pour les connexions entrantes

### 4. Vérifier que le serveur écoute bien sur 0.0.0.0

Une fois le serveur redémarré, vous devriez voir dans les logs :
```
✅ API Express prête sur le port 3001 !
📡 WebSocket serveur prêt sur le port 8080 !
```

### 5. Test de connexion depuis l'hébergeur

Depuis votre hébergeur, testez si le port est accessible :

```bash
# Test WebSocket (si disponible)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080

# Test API
curl http://localhost:3001/status
```

### 6. Vérifier l'adresse IP

Assurez-vous que l'adresse IP `51.68.234.157` est toujours correcte :
- Vérifiez dans le panneau de contrôle de votre hébergeur
- L'IP peut changer si vous utilisez un service avec IP dynamique

## 🔧 Solutions alternatives

### Si les ports ne peuvent pas être ouverts

Si votre hébergeur ne permet pas d'ouvrir les ports 8080/3001, vous pouvez :

1. **Utiliser un tunnel (ngrok, cloudflared, etc.)**
   ```bash
   # Exemple avec ngrok
   ngrok http 8080
   # Utilisez l'URL fournie par ngrok dans websocket-config.json
   ```

2. **Utiliser un reverse proxy**
   - Configurez nginx ou un autre reverse proxy
   - Faites passer les connexions WebSocket via le reverse proxy

3. **Utiliser un service de tunneling WebSocket**
   - Services comme `wss://` avec certificat SSL
   - Tunnel sécurisé pour WebSocket

## 📝 Checklist de résolution

- [ ] Fichier `launcher-server.js` modifié avec `host: '0.0.0.0'`
- [ ] Fichier `launcher-server.js` modifié avec `app.listen(3001, '0.0.0.0', ...)`
- [ ] Serveur redémarré après les modifications
- [ ] Ports 8080 et 3001 ouverts dans le firewall
- [ ] Adresse IP `51.68.234.157` correcte
- [ ] Test de connexion depuis l'hébergeur réussi
- [ ] Fichier `websocket-config.json` contient `ws://51.68.234.157:8080`

## 🆘 Si le problème persiste

1. **Vérifiez les logs du serveur** pour voir s'il y a des erreurs
2. **Contactez le support de votre hébergeur** pour vérifier les restrictions de ports
3. **Testez avec un autre outil** comme Postman ou un client WebSocket en ligne
4. **Vérifiez si votre hébergeur nécessite une configuration spéciale** pour les WebSockets


