import type { Tier, Visit, Redemption } from '@/types/database'

/**
 * Find the highest tier the customer has achieved based on lifetime confirmed visits.
 * Tier is a lifetime achievement — never resets.
 */
export function calculateTier(lifetimeVisits: number, tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => b.level - a.level)
  return sorted.find((t) => lifetimeVisits >= t.visit_threshold) ?? null
}

/**
 * Count confirmed visits since the last redemption (or since beginning if no redemptions).
 * This is the "reward cycle" counter shown to customers.
 */
export function calculateRewardCycleStamps(
  confirmedVisits: Visit[],
  lastRedemption: Redemption | null
): number {
  if (!lastRedemption) return confirmedVisits.length

  const cutoff = new Date(lastRedemption.redeemed_at)
  return confirmedVisits.filter((v) => new Date(v.confirmed_at!) > cutoff).length
}

/**
 * Check if a customer is still in the stamp cooldown window.
 * Returns onCooldown=true and the next eligible timestamp if they are.
 */
export function checkCooldown(
  lastConfirmedVisit: Visit | null,
  cooldownHours: number
): { onCooldown: boolean; nextEligibleAt: Date | null } {
  if (!lastConfirmedVisit?.confirmed_at) {
    return { onCooldown: false, nextEligibleAt: null }
  }

  const confirmedAt = new Date(lastConfirmedVisit.confirmed_at)
  const nextEligibleAt = new Date(confirmedAt.getTime() + cooldownHours * 60 * 60 * 1000)
  const now = new Date()

  if (now < nextEligibleAt) {
    return { onCooldown: true, nextEligibleAt }
  }

  return { onCooldown: false, nextEligibleAt: null }
}

/**
 * Get the next tier above the customer's current tier (null if already at max).
 */
export function getNextTier(currentTier: Tier | null, tiers: Tier[]): Tier | null {
  if (!currentTier) {
    const sorted = [...tiers].sort((a, b) => a.level - b.level)
    return sorted[0] ?? null
  }
  const sorted = [...tiers].sort((a, b) => a.level - b.level)
  return sorted.find((t) => t.level > currentTier.level) ?? null
}

/**
 * Get the lowest tier (the one customers start working toward).
 */
export function getLowestTier(tiers: Tier[]): Tier | null {
  const sorted = [...tiers].sort((a, b) => a.level - b.level)
  return sorted[0] ?? null
}

/**
 * Check if a reward is available for the customer to redeem.
 */
export function isRewardAvailable(
  rewardCycleStamps: number,
  currentTier: Tier | null
): boolean {
  if (!currentTier) return false
  return rewardCycleStamps >= currentTier.visit_threshold
}

/**
 * Check rapid succession fraud: 3+ taps in 60 minutes from the same customer.
 * Returns true if fraud pattern detected (alert only — never block).
 */
export function detectRapidSuccession(recentVisits: Visit[]): boolean {
  if (recentVisits.length < 3) return false

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const visitsInLastHour = recentVisits.filter(
    (v) => new Date(v.created_at) > oneHourAgo
  )

  return visitsInLastHour.length >= 3
}

/**
 * Check daily stamp limit: max 1 confirmed visit per card per calendar day (SAST).
 */
export function checkDailyLimit(
  confirmedVisits: Visit[],
  dailyLimit = 1
): boolean {
  const now = new Date()
  // SAST = UTC+2
  const sastOffset = 2 * 60 * 60 * 1000
  const nowSAST = new Date(now.getTime() + sastOffset)

  const todayStr = nowSAST.toISOString().slice(0, 10) // YYYY-MM-DD

  const todayVisits = confirmedVisits.filter((v) => {
    if (!v.confirmed_at) return false
    const visitSAST = new Date(new Date(v.confirmed_at).getTime() + sastOffset)
    return visitSAST.toISOString().slice(0, 10) === todayStr
  })

  return todayVisits.length >= dailyLimit
}

/**
 * Format a Date as "9:30 AM today" or "9:30 AM tomorrow" in SAST.
 */
export function formatNextEligible(nextEligibleAt: Date): string {
  const now = new Date()
  const sastOffset = 2 * 60 * 60 * 1000
  const nowSAST = new Date(now.getTime() + sastOffset)
  const eligibleSAST = new Date(nextEligibleAt.getTime() + sastOffset)

  const timeStr = eligibleSAST.toLocaleTimeString('en-ZA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Johannesburg',
  })

  const isToday = nowSAST.toISOString().slice(0, 10) === eligibleSAST.toISOString().slice(0, 10)

  return `${timeStr} ${isToday ? 'today' : 'tomorrow'}`
}
