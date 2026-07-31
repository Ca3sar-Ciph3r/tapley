// lib/utils/pricing.test.ts
//
// Tests for getTierForCardCount() and calculateBilling() v2 functions.
// Run with: npx jest lib/utils/pricing.test.ts

import {
  getTierForCardCount,
  getLegacyTierForCardCount,
  calculateBilling,
  calculateBillingLegacy,
  PRICING_TIERS,
  type BillingCycle,
} from './pricing'

// ---------------------------------------------------------------------------
// getTierForCardCount — NFC tiers
// ---------------------------------------------------------------------------

describe('getTierForCardCount — NFC tiers', () => {
  test('1 card → Solo', () => {
    expect(getTierForCardCount(1, false).name).toBe('Solo')
  })

  test('4 cards → Solo (boundary max)', () => {
    expect(getTierForCardCount(4, false).name).toBe('Solo')
  })

  test('5 cards → Starter (boundary min)', () => {
    expect(getTierForCardCount(5, false).name).toBe('Starter')
  })

  test('15 cards → Starter (boundary max)', () => {
    expect(getTierForCardCount(15, false).name).toBe('Starter')
  })

  test('16 cards → Growth (boundary min)', () => {
    expect(getTierForCardCount(16, false).name).toBe('Growth')
  })

  test('30 cards → Growth (boundary max)', () => {
    expect(getTierForCardCount(30, false).name).toBe('Growth')
  })

  test('31 cards → Scale (boundary min)', () => {
    expect(getTierForCardCount(31, false).name).toBe('Scale')
  })

  test('60 cards → Scale (boundary max)', () => {
    expect(getTierForCardCount(60, false).name).toBe('Scale')
  })

  test('61 cards → Enterprise (boundary min)', () => {
    expect(getTierForCardCount(61, false).name).toBe('Enterprise')
  })

  test('200 cards → Enterprise (unlimited)', () => {
    expect(getTierForCardCount(200, false).name).toBe('Enterprise')
  })

  test('throws for 0 cards', () => {
    expect(() => getTierForCardCount(0, false)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// getTierForCardCount — QR Digital
// ---------------------------------------------------------------------------

describe('getTierForCardCount — QR Digital', () => {
  test('1 card → QR Digital', () => {
    const tier = getTierForCardCount(1, true)
    expect(tier.name).toBe('QR Digital')
    expect(tier.isQrDigital).toBe(true)
  })

  test('15 cards → QR Digital (boundary max)', () => {
    expect(getTierForCardCount(15, true).name).toBe('QR Digital')
  })

  test('16 cards → throws (exceeds QR max)', () => {
    expect(() => getTierForCardCount(16, true)).toThrow('maximum of 15 cards')
  })
})

// ---------------------------------------------------------------------------
// calculateBilling
// ---------------------------------------------------------------------------

describe('calculateBilling', () => {
  const cycle: BillingCycle = 'monthly'

  test('5 cards NFC → Starter tier, correct monthly total', () => {
    const result = calculateBilling(5, false, cycle)
    expect(result.tier.name).toBe('Starter')
    expect(result.monthlyTotalZar).toBe(5 * 99)   // R495
    expect(result.setupTotalZar).toBe(5 * 299)     // R1495
  })

  test('annual discount = 10 months (2 months free)', () => {
    const result = calculateBilling(5, false, 'annual')
    expect(result.annualDiscountedTotalZar).toBe(result.monthlyTotalZar * 10)
  })

  test('QR Digital — 10 cards', () => {
    const result = calculateBilling(10, true, cycle)
    expect(result.tier.name).toBe('QR Digital')
    expect(result.monthlyTotalZar).toBe(10 * 49)   // R490
    expect(result.setupTotalZar).toBe(0)
  })

  test('Enterprise — 100 cards', () => {
    const result = calculateBilling(100, false, cycle)
    expect(result.tier.name).toBe('Enterprise')
    expect(result.monthlyTotalZar).toBe(100 * 65)  // R6500
  })

  test('annual: annualDiscountedTotalZar = monthlyTotalZar × 10', () => {
    const monthly = calculateBilling(20, false, 'monthly')
    const annual = calculateBilling(20, false, 'annual')
    // Both return same values — caller controls which to display
    expect(annual.annualDiscountedTotalZar).toBe(monthly.monthlyTotalZar * 10)
  })
})

// ---------------------------------------------------------------------------
// PRICING_TIERS sanity checks
// ---------------------------------------------------------------------------

describe('PRICING_TIERS constant', () => {
  test('has 6 tiers', () => {
    expect(PRICING_TIERS).toHaveLength(6)
  })

  test('exactly one QR Digital tier', () => {
    expect(PRICING_TIERS.filter(t => t.isQrDigital)).toHaveLength(1)
  })

  test('QR Digital has zero setup fee', () => {
    const qr = PRICING_TIERS.find(t => t.isQrDigital)!
    expect(qr.setupFeeZar).toBe(0)
  })

  test('Enterprise has null maxCards', () => {
    const enterprise = PRICING_TIERS.find(t => t.name === 'Enterprise')!
    expect(enterprise.maxCards).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getLegacyTierForCardCount / calculateBillingLegacy
//
// Legacy tiers start at 5 cards, so any count below that matches no tier. The
// fallback used to be the LAST tier — Enterprise — which priced a one-card
// company at its 61-card minimum. Jacks Bagels showed "Billable cards 61" and
// R4,819/mo against a single active card.
// ---------------------------------------------------------------------------

describe('getLegacyTierForCardCount — below the smallest tier', () => {
  test.each([0, 1, 2, 3, 4])('%i cards → Starter, not Enterprise', count => {
    expect(getLegacyTierForCardCount(count).name).toBe('starter')
  })

  test('5 cards → Starter (lower bound of the first tier)', () => {
    expect(getLegacyTierForCardCount(5).name).toBe('starter')
  })

  test('61+ cards still reaches Enterprise', () => {
    expect(getLegacyTierForCardCount(61).name).toBe('enterprise')
    expect(getLegacyTierForCardCount(500).name).toBe('enterprise')
  })
})

describe('calculateBillingLegacy — one-card company', () => {
  const estimate = calculateBillingLegacy(1, 0)

  test('bills the Starter minimum, not the Enterprise minimum', () => {
    expect(estimate.billedCards).toBe(5)
    expect(estimate.tier.name).toBe('starter')
  })

  test('monthly total is the Starter minimum, not thousands', () => {
    // 5 x R149, versus the 61 x R79 = R4,819 the fallback used to produce.
    expect(estimate.monthlyTotalZar).toBe(745)
  })

  test('setup fee follows the real card count, not the billed minimum', () => {
    expect(estimate.setupTotalZar).toBe(350)
  })
})
