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
  monthlyFeeZar: number | null
  billingCycle: string
  freeMonthsBalance: number
  subscriptionStatus: string
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
  const [plan, setPlan] = useState<PlanSummary | null>(null)
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

    const adminResult = await supabaseAny
      .from('company_admins')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single()

    const adminRow = adminResult.data as { company_id: string | null; role: string } | null

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
      .select('name, monthly_fee_zar, billing_cycle, free_months_balance, subscription_status')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      setLoadError('Failed to load billing information.')
      setLoading(false)
      return
    }

    setPlan({
      companyName: company.name,
      monthlyFeeZar: company.monthly_fee_zar ?? null,
      billingCycle: company.billing_cycle ?? 'monthly',
      freeMonthsBalance: company.free_months_balance ?? 0,
      subscriptionStatus: company.subscription_status ?? 'active',
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Monthly Fee</p>
              <p className="text-xl font-bold font-jakarta text-slate-900">
                {plan.monthlyFeeZar !== null
                  ? `R ${plan.monthlyFeeZar.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                  : '—'}
              </p>
            </div>
            <div className="glass-panel rounded-2xl px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Billing Cycle</p>
              <p className="text-xl font-bold font-jakarta text-slate-900 capitalize">{plan.billingCycle}</p>
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
            </div>
          </div>

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
    </div>
  )
}
