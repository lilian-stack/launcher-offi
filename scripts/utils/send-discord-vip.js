/**
 * Script pour envoyer un message VIP au webhook Discord
 */

import https from 'https'

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1433280282257260626/qpfZB8LrZRSiMcrJ2HU-gS0dPwGZg6OcbM3cScQA5Z1VU9ctupvVZEMu1kGG2AV2JJnB'

const message = {
  embeds: [
    {
      title: '💎 OFFRE VIP - ACCÈS ULTIME',
      color: 0xFFA500, // Orange/Or premium
      description: '**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n**🎯 L\'EXPÉRIENCE VIP ULTIME**\n\n*Débloquez tous les avantages exclusifs réservés aux membres VIP*\n\n**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**',
      fields: [
        {
          name: '📥 Téléchargements Illimités',
          value: '```\n✨ Accès illimité à tous les jeux\n✨ Téléchargements sans restriction\n✨ Vitesse de téléchargement optimale\n```',
          inline: true
        },
        {
          name: '🚀 Accès Anticipé aux Nouveautés',
          value: '```\n✨ Nouvelles fonctionnalités en avant-première\n✨ Mises à jour exclusives\n✨ Contenus secrets et préversions\n```',
          inline: true
        },
        {
          name: '💬 Support Client 24/7 Prioritaire',
          value: '```\n✨ Assistance prioritaire dédiée\n✨ Réponses ultra-rapides\n✨ Support disponible 24h/24 et 7j/7\n```',
          inline: true
        },
        {
          name: '🎨 Thèmes & Ressources Exclusives VIP',
          value: '```\n✨ Thèmes personnalisés exclusifs\n✨ Ressources premium réservées\n✨ Personnalisation complète de l\'interface\n```',
          inline: true
        },
        {
          name: '📊 Statistiques Détaillées & Outils Avancés',
          value: '```\n✨ Statistiques complètes et détaillées\n✨ Outils avancés de gestion\n✨ Analyses et rapports personnalisés\n```',
          inline: true
        },
        {
          name: '🎯 Expérience 100% Sans Publicité',
          value: '```\n✨ Interface épurée sans publicités\n✨ Navigation fluide et agréable\n✨ Expérience gaming premium\n```',
          inline: true
        },
        {
          name: '🔐 Accès aux Préversions & Contenus Secrets',
          value: '```\n✨ Accès aux versions bêta\n✨ Contenus secrets et exclusifs\n✨ Tests de nouvelles fonctionnalités\n```',
          inline: true
        },
        {
          name: '👑 Rôle VIP Exclusif sur Discord',
          value: '```\n✨ Rôle VIP visible sur Discord\n✨ Canal exclusif pour les membres VIP\n✨ Communauté premium dédiée\n```',
          inline: true
        },
        {
          name: '🎁 Bonus Mensuels Réservés aux Membres VIP',
          value: '```\n✨ Bonus mensuels exclusifs\n✨ Récompenses spéciales\n✨ Avantages supplémentaires réguliers\n```',
          inline: true
        }
      ],
      footer: {
        text: '💜 Pack VIP • Expérience Premium • Actoris Gaming',
      },
      timestamp: new Date().toISOString()
    }
  ]
}

const url = new URL(WEBHOOK_URL)
const data = JSON.stringify(message)

const options = {
  hostname: url.hostname,
  path: url.pathname + url.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data, 'utf8')
  }
}

const req = https.request(options, (res) => {
  let responseData = ''

  res.on('data', (chunk) => {
    responseData += chunk
  })

  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Message VIP envoyé avec succès au webhook Discord !')
    } else {
      console.error('❌ Erreur lors de l\'envoi:', res.statusCode)
      console.error('Réponse:', responseData)
      process.exit(1)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Erreur de connexion:', error.message)
  process.exit(1)
})

req.write(data)
req.end()

