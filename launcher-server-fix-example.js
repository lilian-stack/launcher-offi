// EXEMPLE DE CODE À MODIFIER DANS launcher-server.js SUR VOTRE HÉBERGEUR
// 
// ⚠️ Ce fichier est un exemple de référence, ne l'utilisez pas directement
// Modifiez votre fichier launcher-server.js sur l'hébergeur avec ces changements

// ==================== MODIFICATION 1 : WebSocket Server ====================
// 
// REMPLACER CETTE LIGNE (ligne ~25) :
// const wss = new WebSocket.Server({ port: 8080 });
//
// PAR CETTE LIGNE :
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Écoute sur toutes les interfaces réseau
    port: 8080 
});

// ==================== MODIFICATION 2 : Express Server ====================
// 
// REMPLACER CETTE LIGNE (ligne ~245) :
// app.listen(3001, () => {
//     console.log("✅ API Express prête sur le port 3001 !");
//     console.log("📡 WebSocket serveur prêt sur le port 8080 !");
// });
//
// PAR CETTE LIGNE :
app.listen(3001, '0.0.0.0', () => {
    console.log("✅ API Express prête sur le port 3001 !");
    console.log("📡 WebSocket serveur prêt sur le port 8080 !");
});

// ==================== EXPLICATION ====================
// 
// - '0.0.0.0' signifie que le serveur écoute sur toutes les interfaces réseau
// - Cela permet aux connexions externes (depuis votre PC) de se connecter
// - Sans cela, le serveur n'accepte que les connexions locales (localhost)
//
// Après ces modifications :
// 1. Redémarrez le serveur sur votre hébergeur
// 2. Vérifiez que les ports 8080 et 3001 sont ouverts dans le firewall
// 3. Testez la connexion depuis votre application Electron


