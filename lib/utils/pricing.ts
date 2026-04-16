// lib/utils/pricing.ts
//
// Pricing tier definitions and billing calculation helpers.
//
// V2 TIERS (used when companies.pricing_v2_enabled = true):
//   - QR Digital tier: R49/card/month, no setup fee, no NFC card, max 15 cards
//   - Solo / Starter / Growth / Scale / Enterprise: NFC-backed tiers
//
// LEGACY (used when companies.pricing_v2_enabled = false):
//   calculateBillingLegacy() is preserved for existing contracts.
//
// UPDATE THESE if you change the tiers.

// ---------------------------------------------------------------------------
// V2 Pricing
// ---------------------------------------------------------------------------

export type PricingTier = {
  name: string
  minCards: number
  maxCards: number | null  // null = unlimited
  monthlyRateZar: number
  setupFeeZar: number
  isQrDigital: boolean     // true = no physical NFC card
}

export const PRICING_TIERS: PricingTier[] = [
  { name: 'QR Digital', minCards: 1,  maxCards: 15,  monthlyRateZar: 49,  setupFeeZar: 0,   isQrDigital: true  },
  { name: 'Solo',       minCards: 1,  maxCards: 4,   monthlyRateZar: 89,  setupFeeZar: 199, isQrDigital: false },
  { name: 'Starter',    minCards: 5,  maxCards: 15,  monthlyRateZar: 99,  setupFeeZar: 299, isQrDigital: false },
  { name: 'Growth',     minCards: 16, maxCards: 30,  monthlyRateZar: 89,  setupFeeZar: 275, isQrDigital: false },
  { name: 'Scale',      minCards: 31, maxCards: 60,  monthlyRateZar: 79,  setupFeeZar: 249, isQrDigital: false },
  { name: 'Enterprise', minCards: 61, maxCards: null, monthlyRateZar: 65, setupFeeZar: 220, isQrDigital: false },
]

export function getTierForCardCount(
  cardCount: number,
  isQrDigital: boolean,
): PricingTier {
  if (isQrDigital) {
    const tier = PRICING_TIERS.find(t => t.isQrDigital)!
    if (cardCount > (tier.maxCards ?? Infinity)) {
      throw new Error('QR Digital tier supports a maximum of 15 cards.')
    }
    return tier
  }
  const tier = PRICING_TIERS
    .filter(t => !t.isQrDigital)
    .find(t => cardCount >= t.minCards && (t.maxCards === null || cardCount <= t.maxCards))
  if (!tier) throw new Error(`No pricing tier found for ${cardCount} cards.`)
  return tier
}

export type BillingCycle = 'monthly' | 'annual'

export type BillingResult = {
  tier: PricingTier
  monthlyTotalZar: number
  setupTotalZar: number
  annualDiscountedTotalZar: number  // 10 months × monthly rate (2 months free)
}

export function calculateBilling(
  cardCount: number,
  isQrDigital: boolean,
  // billingCycle is accepted so callers can pass it for context;
  // both monthly and annual totals are always returned.
  _billingCycle: BillingCycle,
): BillingResult {
  const tier = getTierForCardCount(cardCount, isQrDigital)
  const monthlyTotalZar = cardCount * tier.monthlyRateZar
  const setupTotalZar = cardCount * tier.setupFeeZar
  const annualDiscountedTotalZar = monthlyTotalZar * 10  // 2 months free
  return { tier, monthlyTotalZar, setupTotalZar, annualDiscountedTotalZar }
}

// ---------------------------------------------------------------------------
// Legacy Pricing (pricing_v2_enabled = false)
// Preserves contracts negotiated before the v2 restructure.
// ---------------------------------------------------------------------------

/** @deprecated Use PricingTier (v2) for new companies */
export type LegacyPricingTier = {
  name: string
  displayName: string
  minCards: number
  maxCards: number | null
  ratePerCardZar: number
  setupFeePerCardZar: number
}

/** @deprecated Use PRICING_TIERS (v2) for new companies */
export const LEGACY_PRICING_TIERS: LegacyPricingTier[] = [
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

/** @deprecated Use getTierForCardCount (v2) for new companies */
export function getLegacyTierForCardCount(count: number): LegacyPricingTier {
  return (
    LEGACY_PRICING_TIERS.find(
      t => count >= t.minCards && (t.maxCards === null || count <= t.maxCards)
    ) ?? LEGACY_PRICING_TIERS[LEGACY_PRICING_TIERS.length - 1]
  )
}

export type LegacyBillingEstimate = {
  tier: LegacyPricingTier
  cardCount: number
  billedCards: number
  monthlyTotalZar: number
  setupTotalZar: number
  annualTotalZar: number
}

/** @deprecated Use calculateBilling (v2) for new companies */
export function calculateBillingLegacy(
  cardCount: number,
  minCommitted: number,
  overrideRate?: number,
): LegacyBillingEstimate {
  const tier = getLegacyTierForCardCount(Math.max(cardCount, minCommitted))
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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
