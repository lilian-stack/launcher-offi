// CORRECTION POUR LE PORT 20036
// Remplacez les lignes suivantes dans votre launcher-server.js

// ==================== PARTIE 1 : Vérifier les imports (ligne ~12-13) ====================
// Assurez-vous d'avoir :
const http = require("http");

// ==================== PARTIE 2 : Modifier la création du serveur (ligne ~25-30) ====================
// REMPLACER :
// const wss = new WebSocket.Server({ 
//     host: '0.0.0.0',
//     port: 8080 
// });

// PAR :
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== PARTIE 3 : Modifier le démarrage (ligne ~248-253) ====================
// REMPLACER :
// app.listen(3001, '0.0.0.0', () => {
//     console.log("✅ API Express prête sur le port 3001 !");
//     console.log("📡 WebSocket serveur prêt sur le port 8080 !");
// });

// PAR :
const PORT = process.env.PORT || 20036;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ API Express prête sur le port ${PORT} !`);
    console.log(`📡 WebSocket serveur prêt sur le port ${PORT} !`);
});

// ==================== IMPORTANT ====================
// 1. Supprimez l'ancienne ligne app.listen(3001, ...)
// 2. Utilisez server.listen au lieu de app.listen
// 3. Le serveur HTTP doit être créé AVANT le serveur WebSocket
// 4. L'ordre doit être :
//    - const app = express();
//    - const server = http.createServer(app);
//    - const wss = new WebSocket.Server({ server });
//    - server.listen(PORT, ...);


