import { useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { FiHeadphones, FiBox, FiAward, FiArrowRight, FiCheck, FiTrendingUp, FiMessageCircle } from 'react-icons/fi'
import { RiVipCrownFill } from 'react-icons/ri'

const perks = [
  {
    icon: FiHeadphones,
    title: 'Support prioritaire',
    description: 'Assistance dédiée et réponses rapides.',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconBg: 'bg-gradient-to-br from-blue-500/30 to-cyan-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: FiTrendingUp,
    title: 'Mises à jour anticipées',
    description: 'Accès aux nouvelles versions en avant-première.',
    gradient: 'from-purple-500/20 to-pink-500/10',
    iconBg: 'bg-gradient-to-br from-purple-500/30 to-pink-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: FiBox,
    title: 'Contenu exclusif',
    description: 'Packs visuels et thèmes réservés VIP.',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    iconBg: 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: FiAward,
    title: 'Badge VIP',
    description: 'Montrez votre statut dans le launcher.',
    gradient: 'from-amber-500/20 to-orange-500/10',
    iconBg: 'bg-gradient-to-br from-amber-500/30 to-orange-500/20',
    iconColor: 'text-amber-400',
  },
]

const features = [
  'Téléchargements illimités',
  'Accès anticipé aux nouveautés',
  'Support client 24/7',
  'Thèmes exclusifs',
  'Statistiques détaillées',
  'Pas de publicités',
]

const discordFeatures = [
  'Support Discord',
  'Mises à jour anticipées',
  'Pas de publicités',
]

const discordPerks = [
  {
    icon: FiMessageCircle,
    title: 'Support Discord',
    description: 'Accès au canal support dédié.',
    gradient: 'from-indigo-500/20 to-blue-500/10',
    iconBg: 'bg-gradient-to-br from-indigo-500/30 to-blue-500/20',
    iconColor: 'text-indigo-400',
  },
  {
    icon: FiTrendingUp,
    title: 'Mises à jour anticipées',
    description: 'Accès aux nouvelles versions 1 semaine avant.',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconBg: 'bg-gradient-to-br from-blue-500/30 to-cyan-500/20',
    iconColor: 'text-blue-400',
  },
]

export function VipPage({ currentUser = null }) {
  const [isBoostMode, setIsBoostMode] = useState(false)
  const isVip = currentUser?.isVip || false
  
  return (
    <div className="flex h-full flex-col gap-6">
      {/* VIP/Boost Switch */}
      <div className="flex justify-center">
        <div className={`vip-boost-switch ${isBoostMode ? 'boost-active' : ''}`}>
          <input
            type="checkbox"
            id="mode"
            checked={isBoostMode}
            onChange={(e) => setIsBoostMode(e.target.checked)}
            className="hidden"
          />
          <label htmlFor="mode" className="switch cursor-pointer">
            <span className="option vip">VIP</span>
            <span className="option boost">BOOST</span>
            <span className="slider" />
          </label>
        </div>
      </div>

      <div className="grid h-full grid-cols-12 gap-6 flex-1">
        {/* Left Column - Hero Section */}
        <AnimatePresence mode="wait">
          {isBoostMode ? (
            <Motion.div
              key="boost-hero"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="col-span-12 lg:col-span-5"
            >
              <div className="relative h-full overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/20 via-indigo-800/10 to-blue-900/20 p-1 backdrop-blur-xl">
                <div className="relative h-full rounded-3xl bg-gradient-to-br from-zinc-900/95 via-zinc-800/90 to-zinc-900/95 p-6 md:p-8">
                  <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
                  
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-indigo-600 shadow-lg shadow-indigo-500/30">
                          <FiMessageCircle className="text-xl text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                            DISCORD BOOST
                          </p>
                          <p className="text-xs text-muted">Avantages limités</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                          Boost Discord
                        </h1>
                        <p className="text-sm text-muted">
                          Boostez notre serveur Discord pour débloquer des avantages exclusifs. 
                          Support dédié, accès anticipé et pas de publicités.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted">
                        <FiCheck className="text-indigo-400" />
                        <span>Obtenu en boostant le serveur Discord</span>
                      </div>
                    </div>

                    <Motion.button
                      whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(99, 102, 241, 0.3)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Rejoindre Discord
                        <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </Motion.button>
                  </div>
                </div>
              </div>
            </Motion.div>
          ) : (
            <Motion.div
              key="vip-hero"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="col-span-12 lg:col-span-5"
            >
              <div className="relative h-full overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-900/20 via-purple-800/10 to-pink-900/20 p-1 backdrop-blur-xl">
                <div className="relative h-full rounded-3xl bg-gradient-to-br from-zinc-900/95 via-zinc-800/90 to-zinc-900/95 p-6 md:p-8">
                  <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
                  <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-pink-500/10 blur-3xl" />
                  
                  <div className="relative z-10 flex h-full flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 shadow-lg shadow-amber-500/30">
                          <RiVipCrownFill className="text-xl text-zinc-900" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                            ACTORIS VIP
                          </p>
                          <p className="text-xs text-muted">Expérience premium</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h1 className="text-3xl font-bold text-white md:text-4xl">
                          {isVip ? 'Vous êtes VIP' : 'Passez en VIP'}
                        </h1>
                        <p className="text-sm text-muted">
                          {isVip 
                            ? 'Vous bénéficiez déjà de tous les avantages VIP. Profitez de votre expérience premium au maximum !'
                            : 'Débloquez une expérience gaming exceptionnelle avec des avantages exclusifs, un support prioritaire et du contenu premium.'
                          }
                        </p>
                      </div>

                      {!isVip && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">2,99€</span>
                            <span className="text-sm text-muted">Payer une fois</span>
                          </div>
                        </div>
                      )}

                      {isVip && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400">
                          <FiCheck className="text-lg" />
                          <span className="font-semibold">Statut VIP actif</span>
                        </div>
                      )}
                    </div>

                    {!isVip && (
                      <Motion.button
                        whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(234, 179, 8, 0.3)" }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg shadow-amber-500/30 transition-all duration-300"
                      >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          Devenir VIP
                          <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      </Motion.button>
                    )}

                    {isVip && (
                      <Motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/20 border border-emerald-500/30 px-6 py-4"
                      >
                        <div className="flex items-center gap-3">
                          <RiVipCrownFill className="text-2xl text-emerald-400" />
                          <div>
                            <p className="text-sm font-semibold text-white">Abonnement VIP actif</p>
                            <p className="text-xs text-muted">Merci de votre confiance !</p>
                          </div>
                        </div>
                      </Motion.div>
                    )}
                  </div>
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Right Column - Features and Perks */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {/* Features List */}
          <AnimatePresence mode="wait">
            {isBoostMode ? (
              <Motion.div
                key="boost-features"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 gap-2.5"
              >
                {discordFeatures.map((feature, idx) => (
                  <Motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group flex items-center gap-2.5 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 px-3.5 py-3 backdrop-blur-sm transition-all duration-200 hover:border-indigo-500/40 hover:bg-gradient-to-br hover:from-indigo-500/15 hover:to-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/10"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-indigo-500/20 shadow-md shadow-indigo-500/20">
                      <FiCheck className="text-sm text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold text-white">{feature}</span>
                  </Motion.div>
                ))}
              </Motion.div>
            ) : (
              <Motion.div
                key="vip-features"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-2 gap-2.5"
              >
                {features.map((feature, idx) => (
                  <Motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-3.5 py-3 backdrop-blur-sm transition-all duration-200 hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-500/15 hover:to-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/10"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/30 to-emerald-500/20 shadow-md shadow-emerald-500/20">
                      <FiCheck className="text-sm text-emerald-400" />
                    </div>
                    <span className="text-xs font-semibold text-white">{feature}</span>
                  </Motion.div>
                ))}
              </Motion.div>
            )}
          </AnimatePresence>

          {/* Perks Grid */}
          <div className="flex-1">
            <Motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="mb-4 text-lg font-bold text-white"
            >
              {isBoostMode ? 'Avantages Discord Boost' : 'Avantages VIP'}
            </Motion.h2>
            <AnimatePresence mode="wait">
              {isBoostMode ? (
                <Motion.div
                  key="discord"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {discordPerks.map(({ icon, title, description, gradient, iconBg, iconColor }, idx) => {
                    const Icon = icon
                    return (
                      <Motion.div
                        key={title}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1, duration: 0.5, ease: "easeOut" }}
                        whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                        className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm transition-all duration-300 hover:border-indigo-500/60 hover:shadow-2xl hover:shadow-indigo-500/20`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="relative z-10 space-y-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
                            <Icon className={`text-xl ${iconColor}`} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">{title}</h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
                          </div>
                        </div>
                      </Motion.div>
                    )
                  })}
                </Motion.div>
              ) : (
                <Motion.div
                  key="vip"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-2 gap-3"
                >
                  {perks.map(({ icon, title, description, gradient, iconBg, iconColor }, idx) => {
                    const Icon = icon
                    return (
                      <Motion.div
                        key={title}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 + idx * 0.1, duration: 0.5, ease: "easeOut" }}
                        whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                        className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm transition-all duration-300 hover:border-purple-500/60 hover:shadow-2xl hover:shadow-purple-500/20`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="relative z-10 space-y-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
                            <Icon className={`text-xl ${iconColor}`} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">{title}</h3>
                            <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
                          </div>
                        </div>
                      </Motion.div>
                    )
                  })}
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
