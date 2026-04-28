'use client'

// app/(onboard)/onboard/_components/StepPlan.tsx
//
// Step 1: Plan selection.
// Shows Starter / Growth / Scale tiers. User picks a tier and enters card count.
// QR Digital excluded from self-service (no physical card = different flow).

import { useState } from 'react'
import { PRICING_TIERS, calculateBilling, formatZar, getAnnualMonthlyEquivalent, getAnnualSavings } from '@/lib/utils/pricing'
import type { WizardPlan } from '../_types'

// Show only NFC tiers (exclude QR Digital and Solo which needs 1-4 cards — edge case)
const SELF_SERVICE_TIERS = PRICING_TIERS.filter(t => !t.isQrDigital && t.name !== 'Enterprise')

interface StepPlanProps {
  initial: WizardPlan | null
  onNext: (plan: WizardPlan) => void
}

export function StepPlan({ initial, onNext }: StepPlanProps) {
  const [selectedTierName, setSelectedTierName] = useState<string>(
    initial?.tierName ?? 'Starter',
  )
  const [cardCount, setCardCount] = useState<string>(
    initial?.cardCount ? String(initial.cardCount) : '',
  )
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(
    initial?.billingCycle ?? 'monthly',
  )
  const [error, setError] = useState<string | null>(null)

  const selectedTier = SELF_SERVICE_TIERS.find(t => t.name === selectedTierName) ?? SELF_SERVICE_TIERS[0]

  function handleNext() {
    const count = parseInt(cardCount, 10)
    if (!count || count < 1) {
      setError('Please enter how many staff cards you need.')
      return
    }

    // Validate count is within selected tier range
    if (count < selectedTier.minCards) {
      setError(`The ${selectedTier.name} plan requires at least ${selectedTier.minCards} cards.`)
      return
    }
    if (selectedTier.maxCards !== null && count > selectedTier.maxCards) {
      setError(`The ${selectedTier.name} plan supports up to ${selectedTier.maxCards} cards. For more, contact us directly.`)
      return
    }

    const billing = calculateBilling(count, false, billingCycle)

    onNext({
      tierName: selectedTier.name,
      cardCount: count,
      isQrDigital: false,
      billingCycle,
      monthlyTotalZar: billing.monthlyTotalZar,
      setupTotalZar: billing.setupTotalZar,
      annualDiscountedTotalZar: billing.annualDiscountedTotalZar,
    })
  }

  const previewCount = parseInt(cardCount, 10) || 0
  const canPreview = previewCount >= selectedTier.minCards &&
    (selectedTier.maxCards === null || previewCount <= selectedTier.maxCards)

  const previewBilling = canPreview
    ? calculateBilling(previewCount, false, billingCycle)
    : null

  return (
    <div>
      <h2 className="text-2xl font-bold font-jakarta text-slate-900 mb-1">Choose your plan</h2>
      <p className="text-slate-500 text-sm mb-8">
        All plans include branded NFC + QR cards, analytics, and the admin dashboard.
      </p>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {SELF_SERVICE_TIERS.map(tier => (
          <button
            key={tier.name}
            type="button"
            onClick={() => { setSelectedTierName(tier.name); setError(null) }}
            className={[
              'text-left p-5 rounded-2xl border-2 transition-all duration-150',
              selectedTierName === tier.name
                ? 'border-teal-500 bg-teal-50/60 shadow-[0_0_0_3px_rgba(20,184,166,0.12)]'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-900 font-jakarta">{tier.name}</span>
              {selectedTierName === tier.name && (
                <span className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-0.5">
              {formatZar(billingCycle === 'annual'
                ? getAnnualMonthlyEquivalent(tier.monthlyRateZar)
                : tier.monthlyRateZar)}
              <span className="text-sm font-normal text-slate-500">/card/mo</span>
            </p>
            {billingCycle === 'annual' && (
              <p className="text-[11px] text-teal-600 font-medium">
                billed {formatZar(tier.monthlyRateZar * 10)}/card/year
              </p>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              {tier.minCards}–{tier.maxCards} cards
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Setup: {formatZar(tier.setupFeeZar)}/card
            </p>
          </button>
        ))}
      </div>

      {/* Card count + billing cycle */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            How many staff cards?
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={cardCount}
            onChange={e => { setCardCount(e.target.value); setError(null) }}
            placeholder={`${selectedTier.minCards}–${selectedTier.maxCards ?? '∞'}`}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
          />
          <p className="text-xs text-slate-400 mt-1">
            {selectedTier.name} plan: {selectedTier.minCards}–{selectedTier.maxCards ?? '∞'} cards
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Billing cycle
          </label>
          <div className="flex gap-2">
            {(['monthly', 'annual'] as const).map(cycle => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={[
                  'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all',
                  billingCycle === cycle
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                ].join(' ')}
              >
                {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                {cycle === 'annual' && (
                  <span className="block text-[10px] font-bold text-teal-600 mt-0.5">2 months FREE</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Live pricing preview */}
      {previewBilling && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pricing preview</p>
            {billingCycle === 'annual' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold">
                Save {formatZar(getAnnualSavings(previewBilling.monthlyTotalZar))}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-bold text-slate-900">
                {formatZar(billingCycle === 'annual'
                  ? Math.round(previewBilling.annualDiscountedTotalZar / 12)
                  : previewBilling.monthlyTotalZar)}
                <span className="text-sm font-normal text-slate-500">/mo</span>
              </p>
              {billingCycle === 'annual' ? (
                <>
                  <p className="text-xs text-teal-600 font-medium">
                    billed {formatZar(previewBilling.annualDiscountedTotalZar)}/year
                  </p>
                  <p className="text-xs text-slate-400">monthly equiv. (10 months paid)</p>
                </>
              ) : (
                <p className="text-xs text-slate-400">Billed monthly</p>
              )}
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{formatZar(previewBilling.setupTotalZar)}</p>
              <p className="text-xs text-slate-400">One-time setup fee (today)</p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
      >
        Continue to Company Details →
      </button>
    </div>
  )
}
