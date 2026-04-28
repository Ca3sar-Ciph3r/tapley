'use client'

// app/(dashboard)/dashboard/billing/page.tsx
//
// Rendering:  Client component — live data.
// Auth:       Company Admin / Super Admin. Dashboard layout enforces this.
// Supabase:   Browser client — RLS scopes billing_records to the current company.
//             Super admin sees all companies via super_admin_all policy.
//
// Shows:
//   - Current plan summary (monthly fee, billing cycle, free months balance)
//   - Full billing history from billing_records table
//   - Referral credits earned

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getImpersonationState } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BillingRecord = {
  id: string
  type: string
  amount_zar: number
  description: string | null
  billing_date: string
  status: string
  created_at: string
}

type PlanSummary = {
  companyName: string
  subscriptionPlan: string
  ratePerCardZar: number | null
  maxStaffCards: number
  activeCardCount: number
  billingCycle: string
  nextBillingDate: string | null
  freeMonthsBalance: number
  subscriptionStatus: string
  subscriptionRenewedAt: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatZar(amount: number): string {
  const abs = Math.abs(amount)
  const formatted = `R ${abs.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return amount < 0 ? `−${formatted}` : formatted
}

const TYPE_LABELS: Record<string, string> = {
  monthly_fee:      'Monthly Subscription',
  setup_fee:        'Setup Fee',
  referral_credit:  'Referral Credit',
  manual_credit:    'Manual Credit',
  payment:          'Payment Received',
}

const TYPE_STYLES: Record<string, string> = {
  monthly_fee:      'bg-slate-100 text-slate-600',
  setup_fee:        'bg-sky-50 text-sky-700',
  referral_credit:  'bg-teal-50 text-teal-700',
  manual_credit:    'bg-indigo-50 text-indigo-700',
  payment:          'bg-emerald-50 text-emerald-700',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  paid:    'bg-emerald-50 text-emerald-700',
  waived:  'bg-slate-100 text-slate-500',
}

function AmountCell({ amount, type }: { amount: number; type: string }) {
  const isCredit = type === 'referral_credit' || type === 'manual_credit' || type === 'payment'
  const colour = isCredit ? 'text-emerald-600' : amount === 0 ? 'text-slate-400' : 'text-slate-900'
  return (
    <span className={`text-sm font-bold tabular-nums ${colour}`}>
      {isCredit && amount > 0 ? `−${formatZar(amount).slice(0)}` : formatZar(amount)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const searchParams = useSearchParams()
  const cardsAdded = searchParams.get('added')

  const [plan, setPlan] = useState<PlanSummary | null>(null)
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelConfirmText, setCancelConfirmText] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const supabaseAny = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadError('Not authenticated.'); setLoading(false); return }

    // Resolve company ID — company admin: via company_admins join
    // Super admin impersonating: via impersonation cookie
    let companyId: string | null = null

    // Fetch all rows — user may have multiple (super_admin + admin for own company).
    // Prefer the row with a real company_id for billing context.
    const adminResult = await supabaseAny
      .from('company_admins')
      .select('company_id, role')
      .eq('user_id', user.id)

    const allAdminRows = (adminResult.data ?? []) as { company_id: string | null; role: string }[]
    const adminRow = allAdminRows.find(r => r.company_id !== null) ?? allAdminRows[0] ?? null

    if (adminRow?.company_id) {
      companyId = adminRow.company_id
    } else {
      // Super admin with null company_id — check impersonation
      const impersonation = await getImpersonationState()
      companyId = impersonation?.companyId ?? null
    }

    if (!companyId) {
      setLoadError('No company selected. Start impersonating a company from the Admin panel.')
      setLoading(false)
      return
    }

    // Fetch company plan details
    const { data: company, error: companyError } = await supabaseAny
      .from('companies')
      .select('name, subscription_plan, subscription_status, subscription_renewed_at, rate_per_card_zar, max_staff_cards, next_billing_date, billing_cycle, free_months_balance')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      setLoadError('Failed to load billing information.')
      setLoading(false)
      return
    }

    // Count active staff cards for the progress bar
    const { count: cardCount } = await supabaseAny
      .from('staff_cards')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true)

    setPlan({
      companyName: company.name,
      subscriptionPlan: company.subscription_plan ?? 'starter',
      ratePerCardZar: company.rate_per_card_zar ?? null,
      maxStaffCards: company.max_staff_cards ?? 0,
      activeCardCount: cardCount ?? 0,
      billingCycle: company.billing_cycle ?? 'monthly',
      nextBillingDate: company.next_billing_date ?? null,
      freeMonthsBalance: company.free_months_balance ?? 0,
      subscriptionStatus: company.subscription_status ?? 'active',
      subscriptionRenewedAt: company.subscription_renewed_at ?? null,
    })

    // Fetch billing records
    const { data: billingData } = await supabaseAny
      .from('billing_records')
      .select('id, type, amount_zar, description, billing_date, status, created_at')
      .eq('company_id', companyId)
      .order('billing_date', { ascending: false })
      .order('created_at', { ascending: false })

    setRecords((billingData ?? []) as BillingRecord[])
    setLoading(false)
  }

  const totalPaid = records
    .filter(r => r.status === 'paid' && r.type !== 'referral_credit' && r.type !== 'manual_credit' && r.type !== 'payment')
    .reduce((s, r) => s + r.amount_zar, 0)
  const totalCredits = records
    .filter(r => r.type === 'referral_credit' || r.type === 'manual_credit')
    .reduce((s, r) => s + r.amount_zar, 0)
  const totalPayments = records
    .filter(r => r.type === 'payment')
    .reduce((s, r) => s + r.amount_zar, 0)

  return (
    <div className="px-10 py-10 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">Billing</h1>
        <p className="text-sm text-slate-500 mt-1">Subscription details and payment history</p>
      </div>

      {cardsAdded && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-50 border border-teal-100">
          <span className="material-symbols-outlined text-[20px] text-teal-600">check_circle</span>
          <p className="text-sm text-teal-800 font-medium">
            Payment received — <strong>{cardsAdded} card slot{cardsAdded !== '1' ? 's' : ''}</strong> added to your plan. Your subscription has been updated.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading billing…</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center gap-2 py-10 text-red-500 text-sm">
          <span className="material-symbols-outlined">error</span>
          {loadError}
        </div>
      )}

      {!loading && !loadError && plan && (
        <>
          {/* Plan summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel rounded-2xl px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Plan</p>
              <p className="text-xl font-bold font-jakarta text-slate-900 capitalize">{plan.subscriptionPlan}</p>
              <p className="text-xs text-slate-400 mt-0.5">{plan.maxStaffCards} cards max</p>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Rate / Card</p>
              <p className="text-xl font-bold font-jakarta text-slate-900">
                {plan.ratePerCardZar !== null
                  ? `R ${plan.ratePerCardZar.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                  : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {plan.billingCycle === 'annual' ? 'Annual plan' : 'Monthly plan'}
                {plan.nextBillingDate ? ` — renews ${formatDate(plan.nextBillingDate)}` : ''}
              </p>
            </div>
            <div className={`glass-panel rounded-2xl px-5 py-4 shadow-sm ${plan.freeMonthsBalance > 0 ? 'ring-1 ring-teal-200' : ''}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Free Months</p>
              <p className={`text-xl font-bold font-jakarta ${plan.freeMonthsBalance > 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                {plan.freeMonthsBalance}
                {plan.freeMonthsBalance > 0 && (
                  <span className="text-xs font-normal text-teal-500 ml-1">earned</span>
                )}
              </p>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Status</p>
              <p className="text-xl font-bold font-jakarta text-slate-900 capitalize">{plan.subscriptionStatus}</p>
              {plan.nextBillingDate && (
                <p className="text-xs text-slate-400 mt-0.5">Next: {formatDate(plan.nextBillingDate)}</p>
              )}
            </div>
          </div>

          {/* Cards usage progress bar */}
          {(() => {
            const used = plan.activeCardCount
            const max  = plan.maxStaffCards
            const pct  = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
            const nearLimit = pct >= 80
            return (
              <div className="glass-panel rounded-2xl px-6 py-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Card slots used</p>
                  <span className={`text-sm font-bold tabular-nums ${nearLimit ? 'text-amber-600' : 'text-slate-700'}`}>
                    {used} / {max}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${nearLimit ? 'bg-amber-400' : 'bg-teal-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {nearLimit && (
                  <p className="text-xs text-amber-600">
                    You are approaching your plan limit. Add more card slots before you run out.
                  </p>
                )}
              </div>
            )
          })()}

          {/* Upgrade CTA + Cancel subscription */}
          {plan.subscriptionStatus === 'active' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Manage your plan</p>
                <p className="text-xs text-slate-500 mt-0.5">Add card slots or cancel your subscription.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/dashboard/billing/add-cards"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add card slots
                </Link>
                <button
                  onClick={() => { setShowCancelModal(true); setCancelConfirmText(''); setCancelError(null) }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 text-sm font-bold transition-colors"
                >
                  Cancel plan
                </button>
              </div>
            </div>
          )}

          {/* Summary row */}
          {records.length > 0 && (
            <div className="glass-panel rounded-2xl px-6 py-4 shadow-sm flex items-center gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Billed</p>
                <p className="text-base font-bold text-slate-900 tabular-nums">{formatZar(totalPaid)}</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Credits</p>
                <p className="text-base font-bold text-teal-600 tabular-nums">
                  {totalCredits > 0 ? `−${formatZar(totalCredits)}` : formatZar(0)}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payments Received</p>
                <p className="text-base font-bold text-emerald-600 tabular-nums">
                  {totalPayments > 0 ? `−${formatZar(totalPayments)}` : formatZar(0)}
                </p>
              </div>
            </div>
          )}

          {/* Billing records table */}
          {records.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center shadow-sm">
              <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-3">receipt_long</span>
              <p className="text-sm font-medium text-slate-500">No billing records yet.</p>
              <p className="text-xs text-slate-400 mt-1">Records will appear here once invoices are issued.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-jakarta text-base font-bold text-slate-900">Billing History</h2>
                <p className="text-xs text-slate-400 mt-0.5">{records.length} record{records.length !== 1 ? 's' : ''}</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                    <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-xs text-slate-500">{formatDate(r.billing_date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLES[r.type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="text-xs text-slate-500 truncate block">{r.description ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AmountCell amount={r.amount_zar} type={r.type} />
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Cancel subscription confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-red-500 mt-0.5">warning</span>
              <div>
                <h2 className="text-lg font-extrabold font-jakarta text-slate-900">Cancel subscription?</h2>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Your team&apos;s digital card pages will stop working at the end of your current
                  billing period. This cannot be undone from the dashboard.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">
                Type <span className="font-mono text-red-600">CANCEL</span> to confirm
              </p>
              <input
                type="text"
                value={cancelConfirmText}
                onChange={e => setCancelConfirmText(e.target.value)}
                placeholder="CANCEL"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            {cancelError && (
              <p className="text-xs text-red-500">{cancelError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Keep subscription
              </button>
              <button
                disabled={cancelConfirmText !== 'CANCEL' || cancelling}
                onClick={async () => {
                  setCancelling(true)
                  setCancelError(null)
                  try {
                    const res = await fetch('/api/billing/cancel', { method: 'POST' })
                    if (!res.ok) throw new Error('Request failed')
                    setShowCancelModal(false)
                    await loadData()
                  } catch {
                    setCancelError('Failed to cancel. Please contact support@tapleys.co.za.')
                  } finally {
                    setCancelling(false)
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-bold transition-colors"
              >
                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
