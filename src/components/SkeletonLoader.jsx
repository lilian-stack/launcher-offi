import { Motion } from './Motion'

export function GameCardSkeleton({ index = 0 }) {
  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="card-simple overflow-hidden"
    >
      <div className="relative aspect-video bg-gradient-to-br from-[#1a1a20] to-[#0f0f14] rounded-lg mb-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-5 bg-[#1a1a20] rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-[#1a1a20] rounded w-1/2 animate-pulse" />
      </div>
    </Motion.div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="card-simple space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 bg-[#1a1a20] rounded animate-pulse" />
        <div className="h-6 bg-[#1a1a20] rounded w-32 animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[#1a1a20]">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700 rounded w-1/3 animate-pulse" />
            <div className="h-3 bg-gray-700 rounded w-2/3 animate-pulse" />
          </div>
          <div className="w-14 h-8 bg-[#1a1a20] rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-[#06b6d4]/10 to-[#3b82f6]/10 rounded-2xl blur-2xl -z-10" />
      <div className="relative flex items-center gap-4 mb-3">
        <div className="w-12 h-12 bg-[#1a1a20] rounded-xl animate-pulse" />
        <div className="space-y-2">
          <div className="h-8 bg-[#1a1a20] rounded w-48 animate-pulse" />
          <div className="h-4 bg-[#1a1a20] rounded w-32 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

