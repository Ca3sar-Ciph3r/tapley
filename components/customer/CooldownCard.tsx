import type { Tier } from '@/types/database'
import { formatNextEligible } from '@/lib/business-rules'

/**
 * CooldownCard — shown when a customer taps during their cooldown window.
 * Replaces the normal progress card on the /status page.
 */
export default function CooldownCard({
  nextEligibleAt,
  currentTier,
  nextTier,
  rewardCycleStamps,
}: {
  nextEligibleAt: Date
  currentTier: Tier | null
  nextTier: Tier | null
  rewardCycleStamps: number
}) {
  const timeLabel = formatNextEligible(nextEligibleAt)
  const stampsToNext = nextTier
    ? nextTier.visit_threshold - rewardCycleStamps
    : currentTier
    ? currentTier.visit_threshold - rewardCycleStamps
    : 0

  return (
    <div className="space-y-3">
      {/* Main cooldown card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {/* Clock icon */}
        <div className="flex justify-center mb-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--brand-color-light)' }}
          >
            <span
              className="material-symbols-outlined text-[40px]"
              style={{ color: 'var(--brand-color)', fontVariationSettings: "'FILL' 0" }}
            >
              schedule
            </span>
          </div>
        </div>

        <h3 className="text-center text-[22px] font-bold text-[#16181D] mb-1">
          Already stamped today
        </h3>
        <p className="text-center text-sm text-[#A7A3A8] mb-3">
          You can earn your next stamp after
        </p>

        <p
          className="text-center text-[24px] font-extrabold mb-4"
          style={{ color: 'var(--brand-color)' }}
        >
          {timeLabel}
        </p>

        {currentTier && nextTier && (
          <>
            <div className="border-t border-[#E7E5E4] my-4" />
            <p className="text-center text-sm font-medium text-[#A7A3A8]">
              You&apos;re a{' '}
              <span className="font-bold italic text-[#16181D]">{currentTier.name}</span>{' '}
              —{' '}
              {stampsToNext > 0
                ? `${stampsToNext} more visit${stampsToNext !== 1 ? 's' : ''} to ${nextTier.name} reward`
                : `${nextTier.name} reward ready to claim!`}
            </p>
          </>
        )}
      </div>

      {/* Fraud protection notice */}
      <div className="rounded-2xl bg-[#FEF3C7] px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="text-base">🕐</span>
          <p className="text-sm font-medium text-amber-800">
            <span className="font-bold">Fraud protection is on</span> · This keeps rewards fair for everyone.
          </p>
        </div>
      </div>
    </div>
  )
}
