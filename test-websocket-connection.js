/**
 * Script de test pour vérifier la connexion WebSocket
 * 
 * Usage: node test-websocket-connection.js [URL]
 * Exemple: node test-websocket-connection.js ws://51.68.234.157:8080
 */

import WebSocket from 'ws';

const WS_URL = process.argv[2] || 'ws://51.68.234.157:8080';

console.log(`🔍 Test de connexion WebSocket à: ${WS_URL}`);
console.log('');

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connexion WebSocket établie avec succès !');
    console.log('');
    
    // Envoyer un message de test
    const testMessage = {
        type: 'ping',
        timestamp: Date.now()
    };
    
    console.log('📤 Envoi d\'un message de test...');
    ws.send(JSON.stringify(testMessage));
    
    // Fermer la connexion après 2 secondes
    setTimeout(() => {
        console.log('');
        console.log('✅ Test terminé avec succès !');
        ws.close();
        process.exit(0);
    }, 2000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📨 Message reçu:', message);
    } catch (error) {
        console.log('📨 Message reçu (texte):', data.toString());
    }
});

ws.on('error', (error) => {
    console.error('❌ Erreur de connexion:', error.message);
    console.error('');
    console.error('Détails de l\'erreur:');
    console.error('  - Code:', error.code);
    console.error('  - Address:', error.address);
    console.error('  - Port:', error.port);
    console.error('');
    
    if (error.code === 'ECONNREFUSED') {
        console.error('💡 Solutions possibles:');
        console.error('  1. Vérifiez que le serveur WebSocket est démarré');
        console.error('  2. Vérifiez que le port 8080 est ouvert dans le firewall');
        console.error('  3. Vérifiez que le serveur écoute sur 0.0.0.0 (pas seulement localhost)');
        console.error('  4. Vérifiez que l\'adresse IP est correcte');
    }
    
    process.exit(1);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connexion fermée (code: ${code}, raison: ${reason || 'N/A'})`);
});

// Timeout de 10 secondes
setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) {
        console.error('❌ Timeout: La connexion prend trop de temps');
        console.error('   Le serveur ne répond pas ou le port est bloqué');
        ws.terminate();
        process.exit(1);
    }
}, 10000);

