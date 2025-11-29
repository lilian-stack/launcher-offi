/**
 * Script pour envoyer un comparatif Gratuit / Premium / VIP au webhook Discord
 */

import https from 'https'

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1443347568150056991/xNjNiddASBty6W7xVgUnOs-DHUptb-u1mhkvu8rVRC8VLD-w8Pa1015PwJRxqKCIBB1u'

const message = {
  embeds: [
    {
      title: '🌟 COMPARATIF DES OFFRES ACTORIS',
      color: 0x8B5CF6, // Violet premium
      description: '**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n\n**🎯 Choisissez l\'offre qui vous convient le mieux**\n\n*Comparez les fonctionnalités disponibles selon votre abonnement*\n\n**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**',
      fields: [
        {
          name: '📊 Comparatif des Offres',
          value: '```\nFonctionnalité              Gratuit  Premium  VIP\n─────────────────────────────────────────────────\n📥 Téléchargements          ✅       ✅       ✅\n🚀 Accès aux nouveautés     ❌       ✅       ✅\n💬 Support client           ❌       ✅       ✅\n   (prioritaire 24/7)                              \n🎨 Thèmes exclusifs         ❌       ❌       ✅\n📊 Statistiques détaillées  ❌       ❌       ✅\n🚫 Sans publicité           ❌       ✅       ✅\n👑 Rôle VIP Exclusif        ❌       ❌       ✅\n🔐 Préversions & Secrets    ❌       ❌       ✅\n🎁 Bonus Mensuels VIP       ❌       ❌       ✅\n```',
          inline: false
        }
      ],
      footer: {
        text: '💜 Actoris • Choisissez votre expérience • Gaming Platform',
      },
      timestamp: new Date().toISOString()
    }
  ]
}

console.log('\n📋 COMPARATIF GRATUIT / PREMIUM / VIP')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('Titre: 📊 COMPARATIF DES OFFRES ACTORIS')
console.log('\nDescription:')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎯 Choisissez l\'offre qui vous convient le mieux')
console.log('Comparez les fonctionnalités disponibles selon votre abonnement')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('Comparaisons:\n')
console.log('📥 Téléchargements')
console.log('   🆓 Gratuit : Limités')
console.log('   ✨ Premium : Illimités')
console.log('   💎 VIP : Illimités + Priorité\n')
console.log('🚀 Accès aux Nouveautés')
console.log('   🆓 Gratuit : Standard')
console.log('   ✨ Premium : Anticipé')
console.log('   💎 VIP : Ultra Anticipé\n')
console.log('💬 Support Client')
console.log('   🆓 Gratuit : Standard')
console.log('   ✨ Premium : Prioritaire')
console.log('   💎 VIP : 24/7 Prioritaire\n')
console.log('🎨 Publicités')
console.log('   🆓 Gratuit : Présentes')
console.log('   ✨ Premium : Aucune')
console.log('   💎 VIP : Aucune\n')
console.log('⚡ Fonctionnalités')
console.log('   🆓 Gratuit : De base')
console.log('   ✨ Premium : Avancées')
console.log('   💎 VIP : Toutes + Exclusives\n')
console.log('🏆 Badge & Statut')
console.log('   🆓 Gratuit : Standard')
console.log('   ✨ Premium : Badge Premium')
console.log('   💎 VIP : Badge VIP Exclusif\n')
console.log('🎁 Bonus & Récompenses')
console.log('   🆓 Gratuit : Aucun')
console.log('   ✨ Premium : Occasionnels')
console.log('   💎 VIP : Mensuels Exclusifs\n')
console.log('👑 Rôle Discord')
console.log('   🆓 Gratuit : Membre')
console.log('   ✨ Premium : Rôle Premium')
console.log('   💎 VIP : Rôle VIP Exclusif\n')
console.log('💎 Qualité & Performance')
console.log('   🆓 Gratuit : Standard')
console.log('   ✨ Premium : Améliorée')
console.log('   💎 VIP : Optimale Premium\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
console.log('\n💡 Envoi du comparatif au webhook Discord...')

// Envoyer le message
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
      console.log('\n✅ Comparatif envoyé avec succès au webhook Discord !')
    } else {
      console.error('\n❌ Erreur lors de l\'envoi:', res.statusCode)
      console.error('Réponse:', responseData)
      process.exit(1)
    }
  })
})

req.on('error', (error) => {
  console.error('\n❌ Erreur de connexion:', error.message)
  process.exit(1)
})

req.write(data)
req.end()
