import { motion as Motion } from 'framer-motion'
import {
  FiHome,
  FiGrid,
  FiBookOpen,
  FiDownload,
  FiMessageCircle,
} from 'react-icons/fi'
import { RiVipCrownLine } from 'react-icons/ri'
import { ActorisLogo } from './ActorisLogo'

const navItems = [
  { id: 'home', label: 'Accueil', icon: FiHome },
  { id: 'catalog', label: 'Catalogue', icon: FiGrid },
  { id: 'library', label: 'Bibliothèque', icon: FiBookOpen },
  { id: 'vip', label: 'VIP', icon: RiVipCrownLine },
  { id: 'support', label: 'Support', icon: FiMessageCircle },
]

export function Sidebar({ activeItem, onNavigate }) {
  return (
    <aside className="sidebar-shell">
      <div className="space-y-6">
        <Motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="brand-card"
        >
          <ActorisLogo size="default" showText={false} />
          <div>
            <p className="brand-title">ACTORIS</p>
            <span className="brand-subtitle">Launcher Gaming</span>
          </div>
        </Motion.div>

        <nav className="flex flex-col gap-2">
          {navItems.map(({ id, label, icon }, index) => {
            const Icon = icon
            const isActive = activeItem === id
            return (
              <Motion.button
                key={id}
                onClick={() => onNavigate(id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ x: 6, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="text-lg" />
                <span>{label}</span>
              </Motion.button>
            )
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <Motion.button
          onClick={() => onNavigate('downloads')}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          whileHover={{ x: 6, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          className={`nav-item ${activeItem === 'downloads' ? 'active' : ''}`}
        >
          <FiDownload className="text-lg" />
          <span>Téléchargements</span>
        </Motion.button>
        <Motion.p 
          className="version-tag"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          Version {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.8'}
        </Motion.p>
      </div>
    </aside>
  )
}
