import { Motion } from '../components/Motion'
import { GameSuggestion } from '../components/GameSuggestion'

export function SupportPage({ currentUser }) {

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0f0f14] relative">
      {/* Background effects modernes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto scrollbar-simple px-6 py-6 relative z-10">
        <Motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GameSuggestion currentUser={currentUser} />
        </Motion.div>
      </div>
    </div>
  )
}

export default SupportPage
