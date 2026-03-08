import type { Tier } from '@/types/database'

/**
 * RewardCard — shown when a customer has a reward available to redeem.
 * Used on the /status page as a banner above the normal progress view.
 */
export default function RewardCard({
  tier,
  cardUuid,
}: {
  tier: Tier
  cardUuid: string
}) {
  return (
    <a
      href={`/redeem?card=${cardUuid}`}
      className="block rounded-2xl p-5 text-white reward-glow"
      style={{ backgroundColor: '#22C55E' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
          <span className="material-symbols-outlined text-white" style={{ fontSize: '28px', fontVariationSettings: "'FILL' 1" }}>
            redeem
          </span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-0.5">
            Reward Ready!
          </p>
          <p className="text-lg font-extrabold leading-tight">{tier.reward_description}</p>
          <p className="text-sm text-white/80 mt-0.5">Tap to claim →</p>
        </div>
      </div>
    </a>
  )
}
