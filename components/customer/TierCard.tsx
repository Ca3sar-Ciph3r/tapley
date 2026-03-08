import type { Tier } from '@/types/database'

/**
 * TierCard — the brand-color card showing current tier + all tiers in a row.
 * Past tiers: white/20 bg (earned)
 * Current tier: white bg, brand-color text
 * Future tiers: white/10 bg, lock icon, 40% opacity
 */
export default function TierCard({
  currentTier,
  allTiers,
  lifetimeVisits,
}: {
  currentTier: Tier | null
  allTiers: Tier[]
  lifetimeVisits: number
}) {
  const sorted = [...allTiers].sort((a, b) => a.level - b.level)

  return (
    <div
      className="rounded-2xl p-5 text-white"
      style={{ backgroundColor: 'var(--brand-color)' }}
    >
      {/* Tier heading */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl">◆</span>
        <h3 className="text-2xl font-black italic tracking-tight">
          {currentTier?.name ?? 'Apprentice'}
        </h3>
      </div>
      <p className="text-sm text-white/70 mb-4">
        Tier {currentTier?.level ?? '—'} of {sorted.length}
      </p>

      {/* Tier progression pill row */}
      <div className="flex flex-wrap gap-2">
        {sorted.map((tier) => {
          const earned = lifetimeVisits >= tier.visit_threshold
          const isCurrent = tier.id === currentTier?.id

          if (isCurrent) {
            return (
              <span
                key={tier.id}
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                style={{ color: 'var(--brand-color)' }}
              >
                ◆ {tier.name}
              </span>
            )
          }

          if (earned) {
            return (
              <span
                key={tier.id}
                className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/80"
              >
                {tier.name}
              </span>
            )
          }

          return (
            <span
              key={tier.id}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/40"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>lock</span>
              {tier.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}
