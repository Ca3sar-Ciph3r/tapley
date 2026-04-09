// lib/utils/pricing.ts
//
// Pricing tier definitions and billing calculation helpers.
// Tiers are seeded in the pricing_tiers table — these constants mirror them
// for client-side use (form calculators, previews) without a DB call.
//
// UPDATE THESE if you change the tiers in the database.

export type PricingTier = {
  id?: string          // populated when loaded from DB
  name: string
  displayName: string
  minCards: number
  maxCards: number | null
  ratePerCardZar: number
  setupFeePerCardZar: number
}

// Mirrors the seeded rows in pricing_tiers table.
// Used for client-side billing calculations without a round-trip.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: 'starter',
    displayName: 'Starter',
    minCards: 5,
    maxCards: 15,
    ratePerCardZar: 149,
    setupFeePerCardZar: 350,
  },
  {
    name: 'growth',
    displayName: 'Growth',
    minCards: 16,
    maxCards: 30,
    ratePerCardZar: 119,
    setupFeePerCardZar: 325,
  },
  {
    name: 'scale',
    displayName: 'Scale',
    minCards: 31,
    maxCards: 60,
    ratePerCardZar: 99,
    setupFeePerCardZar: 299,
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    minCards: 61,
    maxCards: null,
    ratePerCardZar: 79,
    setupFeePerCardZar: 275,
  },
]

// Get the correct tier for a given card count
export function getTierForCardCount(count: number): PricingTier {
  return (
    PRICING_TIERS.find(t => count >= t.minCards && (t.maxCards === null || count <= t.maxCards)) ??
    PRICING_TIERS[PRICING_TIERS.length - 1]
  )
}

export type BillingEstimate = {
  tier: PricingTier
  cardCount: number
  billedCards: number          // max(committed, actual)
  monthlyTotalZar: number
  setupTotalZar: number
  annualTotalZar: number
}

// Calculate billing for a given card count and minimum commitment
export function calculateBilling(
  cardCount: number,
  minCommitted: number,
  overrideRate?: number,
): BillingEstimate {
  const tier = getTierForCardCount(Math.max(cardCount, minCommitted))
  const rate = overrideRate ?? tier.ratePerCardZar
  const billedCards = Math.max(cardCount, minCommitted, tier.minCards)

  return {
    tier,
    cardCount,
    billedCards,
    monthlyTotalZar: billedCards * rate,
    setupTotalZar: cardCount * tier.setupFeePerCardZar,
    annualTotalZar: billedCards * rate * 12,
  }
}

export function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
