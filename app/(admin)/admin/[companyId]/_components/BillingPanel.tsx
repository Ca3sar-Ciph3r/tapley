'use client'

// app/(admin)/admin/[companyId]/_components/BillingPanel.tsx
//
// Read-only billing summary for a company.
// Uses calculateBilling() from lib/utils/pricing.ts.
// Billing fields are set at onboarding via createCompany — edit via the
// create/edit company flow, not here.

import { calculateBilling, formatZar, PRICING_TIERS } from '@/lib/utils/pricing'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingInfo = {
  pricing_tier_id: string | null
  rate_per_card_zar: number | null
  setup_fee_per_card_zar: number | null
  min_cards_committed: number | null
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
  // Resolve the pricing tier label
  const tierFromId = PRICING_TIERS.find(t => t.name === billing.pricing_tier_id)
  const tierLabel = tierFromId?.displayName ?? billing.pricing_tier_id ?? billing.subscription_plan

  // Use stored rate if set, otherwise fall back to tier default
  const rate = billing.rate_per_card_zar
  const minCommitted = billing.min_cards_committed ?? 0

  const estimate = calculateBilling(
    activeCardCount,
    minCommitted,
    rate ?? undefined,
  )

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-jakarta text-base font-bold text-slate-900">Billing Summary</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Amounts in ZAR · Billed cards = max(committed, active)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: rate card */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Rate Card</p>
          <BillRow label="Pricing Tier" value={tierLabel ?? '—'} />
          <BillRow
            label="Rate / card / month"
            value={rate !== null ? formatZar(rate) : (tierFromId ? formatZar(tierFromId.ratePerCardZar) : '—')}
          />
          <BillRow
            label="Setup fee / card"
            value={
              billing.setup_fee_per_card_zar !== null
                ? formatZar(billing.setup_fee_per_card_zar)
                : (tierFromId ? formatZar(tierFromId.setupFeePerCardZar) : '—')
            }
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
