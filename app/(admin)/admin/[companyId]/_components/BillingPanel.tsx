'use client'

// app/(admin)/admin/[companyId]/_components/BillingPanel.tsx
//
// Read-only billing summary for a company.
// Supports both legacy (v1) and Pricing v2 modes, selected by pricing_v2_enabled.

import {
  calculateBilling,
  calculateBillingLegacy,
  formatZar,
  getTierForCardCount,
} from '@/lib/utils/pricing'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingInfo = {
  // Legacy fields
  pricing_tier_id: string | null
  rate_per_card_zar: number | null
  setup_fee_per_card_zar: number | null
  min_cards_committed: number | null
  // v2 fields (new migration columns — may be undefined until types regenerated)
  pricing_v2_enabled?: boolean | null
  is_qr_digital?: boolean | null
  billing_cycle?: string | null
  // Contract dates
  contract_start_date: string | null
  contract_end_date: string | null
  next_billing_date: string | null
  subscription_plan: string
}

type Props = {
  billing: BillingInfo
  activeCardCount: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function BillRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 border-b border-slate-50 last:border-0 ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm tabular-nums ${highlight ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingPanel({ billing, activeCardCount }: Props) {
  const isV2 = billing.pricing_v2_enabled === true

  if (isV2) {
    return <BillingPanelV2 billing={billing} activeCardCount={activeCardCount} />
  }

  return <BillingPanelLegacy billing={billing} activeCardCount={activeCardCount} />
}

// ---------------------------------------------------------------------------
// V2 panel — flat monthly rate per tier
// ---------------------------------------------------------------------------

function BillingPanelV2({ billing, activeCardCount }: Props) {
  const isQrDigital = billing.is_qr_digital === true
  const billingCycle = billing.billing_cycle === 'annual' ? 'annual' : 'monthly'

  let estimate: ReturnType<typeof calculateBilling> | null = null
  try {
    estimate = calculateBilling(activeCardCount || 1, isQrDigital, billingCycle)
  } catch {
    // activeCardCount may be 0 or out of tier range during setup
  }

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-jakarta text-base font-bold text-slate-900">Billing Summary</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
            Pricing v2
          </span>
          {isQrDigital && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              QR Digital
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Flat monthly rate · {billingCycle === 'annual' ? 'Annual billing (2 months free)' : 'Monthly billing'}
        </p>
      </div>

      {estimate ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: tier info */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Rate Card</p>
            <BillRow label="Tier" value={estimate.tier.name} />
            <BillRow label="Monthly rate" value={`${formatZar(estimate.tier.monthlyRateZar)}/mo`} />
            {estimate.tier.setupFeeZar > 0 && (
              <BillRow label="Setup fee" value={formatZar(estimate.tier.setupFeeZar)} />
            )}
            <BillRow label="Tier range" value={`${estimate.tier.minCards}–${estimate.tier.maxCards ?? '∞'} cards`} />
          </div>

          {/* Right: calculated totals */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              {billingCycle === 'annual' ? 'Annual Summary' : 'This Month'}
            </p>
            <BillRow label="Active cards" value={String(activeCardCount)} />
            <BillRow label="Monthly total" value={formatZar(estimate.monthlyTotalZar)} highlight />
            {billingCycle === 'annual' && (
              <BillRow
                label="Annual total (10 months)"
                value={formatZar(estimate.annualDiscountedTotalZar)}
                highlight
              />
            )}
            {estimate.tier.setupFeeZar > 0 && (
              <BillRow label="Setup fee total" value={formatZar(estimate.setupTotalZar)} />
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No active cards — billing will be calculated once cards are assigned.</p>
      )}

      {/* Contract dates */}
      <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contract Start</p>
          <p className="text-sm text-slate-700">{formatDate(billing.contract_start_date)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contract End</p>
          <p className="text-sm text-slate-700">{formatDate(billing.contract_end_date)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Next Billing Date</p>
          <p className="text-sm font-semibold text-slate-900">{formatDate(billing.next_billing_date)}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legacy panel — per-card rate
// ---------------------------------------------------------------------------

function BillingPanelLegacy({ billing, activeCardCount }: Props) {
  const minCommitted = billing.min_cards_committed ?? 0
  const rate = billing.rate_per_card_zar

  // Find tier for display label
  const tierFromId = billing.pricing_tier_id
    ? getTierForCardCount(parseInt(billing.pricing_tier_id) || activeCardCount, false)
    : null
  const tierLabel = tierFromId?.name ?? billing.pricing_tier_id ?? billing.subscription_plan

  const estimate = calculateBillingLegacy(
    activeCardCount,
    minCommitted,
    rate ?? undefined,
  )

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-jakarta text-base font-bold text-slate-900">Billing Summary</h2>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            Legacy
          </span>
        </div>
        <p className="text-xs text-slate-400">Amounts in ZAR · Billed cards = max(committed, active)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: rate card */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Rate Card</p>
          <BillRow label="Pricing Tier" value={tierLabel ?? '—'} />
          <BillRow
            label="Rate / card / month"
            value={rate !== null ? formatZar(rate) : '—'}
          />
          <BillRow
            label="Setup fee / card"
            value={billing.setup_fee_per_card_zar !== null ? formatZar(billing.setup_fee_per_card_zar) : '—'}
          />
          <BillRow label="Min. cards committed" value={String(minCommitted)} />
        </div>

        {/* Right: calculated totals */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">This Month</p>
          <BillRow label="Active cards" value={String(activeCardCount)} />
          <BillRow label="Billable cards" value={String(estimate.billedCards)} />
          <BillRow label="Monthly total" value={formatZar(estimate.monthlyTotalZar)} highlight />
          <BillRow label="Setup fee total" value={formatZar(estimate.setupTotalZar)} />
        </div>
      </div>

      {/* Contract dates */}
      <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contract Start</p>
          <p className="text-sm text-slate-700">{formatDate(billing.contract_start_date)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contract End</p>
          <p className="text-sm text-slate-700">{formatDate(billing.contract_end_date)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Next Billing Date</p>
          <p className="text-sm font-semibold text-slate-900">{formatDate(billing.next_billing_date)}</p>
        </div>
      </div>
    </div>
  )
}
