/**
 * Script pour envoyer un message au webhook Discord
 */

import https from 'https'

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1443341632622821441/3F3MvkO-ALBB08okd8IA7-m-zSng3OukyzGcCa5JrMisgxStZ9ZHmt3mMe5WjLV-IkvB'

const message = {
  embeds: [
    {
      title: '💎 PACK PREMIUM ACTORIS',
      color: 0x7C3AED, // Violet profond élégant
      description: '**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n**🎯 L\'EXPÉRIENCE GAMING ULTIME**\n\n*Débloquez tous les avantages exclusifs réservés aux membres Premium*\n\n**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**',
      fields: [
        {
          name: '🚀 Accès Anticipé aux Nouveautés',
          value: '```\n✨ Nouvelles fonctionnalités en avant-première\n✨ Mises à jour exclusives\n✨ Tests beta prioritaires\n```',
          inline: true
        },
        {
          name: '💬 Support Discord Prioritaire',
          value: '```\n✨ Canal Discord dédié Premium\n✨ Réponses ultra-rapides\n✨ Assistance prioritaire 24/7\n```',
          inline: true
        },
        {
          name: '🎨 Expérience 100% Sans Publicités',
          value: '```\n✨ Interface épurée et optimisée\n✨ Zéro publicité, zéro interruption\n✨ Navigation fluide et agréable\n```',
          inline: true
        },
        {
          name: '⚡ Fonctionnalités Avancées Débloquées',
          value: '```\n✨ Tous les modules exclusifs Premium\n✨ Fonctionnalités avancées illimitées\n✨ Personnalisation complète de l\'expérience\n```',
          inline: true
        },
        {
          name: '🏆 Badge Spécial Premium',
          value: '```\n✨ Badge exclusif visible dans le launcher\n✨ Statut Premium affiché partout\n✨ Reconnaissance de votre statut VIP\n```',
          inline: true
        },
        {
          name: '💎 Qualité & Performance Améliorées',
          value: '```\n✨ Performances optimisées et stabilité accrue\n✨ Qualité graphique et audio supérieure\n✨ Expérience gaming premium\n```',
          inline: true
        }
      ],
      footer: {
        text: '💜 Actoris Premium • Accès Exclusif • Gaming Experience',
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
      console.log('✅ Message envoyé avec succès au webhook Discord !')
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

