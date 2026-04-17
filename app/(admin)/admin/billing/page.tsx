'use client'

// app/(admin)/admin/billing/page.tsx
//
// Rendering:  Client component — live data + add billing record action.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   Browser client (super_admin_all RLS policy).
//
// Sections:
//   1. Total platform MRR stat
//   2. Companies table: plan, monthly rate, active cards, MRR, outstanding, next billing, actions
//   3. Inline "Add Record" drawer per company row

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addBillingRecord, type BillingRecordType, type BillingRecordStatus } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyBillingRow = {
  id: string
  name: string
  subscriptionStatus: string
  ratePerCardZar: number | null
  activeCards: number
  nextBillingDate: string | null
  outstandingZar: number
  billingCycle: string | null
  pricingV2Enabled: boolean
}

type AddRecordForm = {
  type: BillingRecordType
  amountZar: string
  description: string
  billingDate: string
  status: BillingRecordStatus
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active:    'bg-emerald-50 text-emerald-700',
    trialing:  'bg-sky-50 text-sky-700',
    past_due:  'bg-red-50 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
    paused:    'bg-amber-50 text-amber-700',
  }
  return map[status] ?? 'bg-slate-100 text-slate-500'
}

const RECORD_TYPES: BillingRecordType[] = [
  'monthly_fee', 'setup_fee', 'referral_credit', 'manual_credit', 'payment',
]

const RECORD_TYPE_LABELS: Record<BillingRecordType, string> = {
  monthly_fee:     'Monthly Fee',
  setup_fee:       'Setup Fee',
  referral_credit: 'Referral Credit',
  manual_credit:   'Manual Credit',
  payment:         'Payment',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// AddRecordDrawer — inline form below a company row
// ---------------------------------------------------------------------------

function AddRecordDrawer({
  companyId,
  companyName,
  onSave,
  onCancel,
}: {
  companyId: string
  companyName: string
  onSave: (companyId: string, form: AddRecordForm) => Promise<void>
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AddRecordForm>({
    type: 'monthly_fee',
    amountZar: '',
    description: '',
    billingDate: todayIso(),
    status: 'pending',
  })

  function set<K extends keyof AddRecordForm>(field: K, value: AddRecordForm[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.amountZar || isNaN(parseFloat(form.amountZar))) {
      alert('Enter a valid amount.')
      return
    }
    setSaving(true)
    await onSave(companyId, form)
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'

  return (
    <tr>
      <td colSpan={8} className="px-6 py-5 bg-slate-50/80 border-b border-slate-100">
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Add billing record for <span className="text-slate-900">{companyName}</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value as BillingRecordType)}
                className={inputCls}
              >
                {RECORD_TYPES.map(t => (
                  <option key={t} value={t}>{RECORD_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount (ZAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amountZar}
                onChange={e => set('amountZar', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={form.billingDate}
                onChange={e => set('billingDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as BillingRecordStatus)}
                className={inputCls}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="waived">Waived</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input
                type="text"
                placeholder="Optional note…"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[14px] leading-none">add</span>
              )}
              {saving ? 'Saving…' : 'Add record'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminBillingPage() {
  const [companies, setCompanies] = useState<CompanyBillingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => unknown
    }

    // Fetch companies
    const { data: companiesData, error: companiesError } = await (supabase
      .from('companies')
      .select('id, name, subscription_status, rate_per_card_zar, next_billing_date') as unknown as Promise<{
        data: {
          id: string
          name: string
          subscription_status: string
          rate_per_card_zar: number | null
          next_billing_date: string | null
        }[] | null
        error: { message: string } | null
      }>)

    if (companiesError) {
      setLoadError('Failed to load billing data.')
      setLoading(false)
      return
    }

    // Fetch active staff card counts per company
    const { data: staffCards, error: staffError } = await supabase
      .from('staff_cards')
      .select('company_id, is_active')

    if (staffError) {
      setLoadError('Failed to load staff card data.')
      setLoading(false)
      return
    }

    const activeCardsByCompany = (staffCards ?? [])
      .filter(c => c.is_active)
      .reduce<Record<string, number>>((acc, c) => {
        acc[c.company_id] = (acc[c.company_id] ?? 0) + 1
        return acc
      }, {})

    // Fetch pending billing_records per company (outstanding balance)
    const { data: pendingRecords, error: recordsError } = await (
      (supabaseAny as unknown as {
        from: (t: string) => {
          select: (q: string) => {
            eq: (col: string, val: string) => Promise<{
              data: { company_id: string; amount_zar: number }[] | null
              error: { message: string } | null
            }>
          }
        }
      }).from('billing_records')
        .select('company_id, amount_zar')
        .eq('status', 'pending') as unknown as Promise<{
          data: { company_id: string; amount_zar: number }[] | null
          error: { message: string } | null
        }>
    )

    const outstandingByCompany: Record<string, number> = {}
    if (!recordsError && pendingRecords) {
      for (const r of pendingRecords) {
        outstandingByCompany[r.company_id] = (outstandingByCompany[r.company_id] ?? 0) + r.amount_zar
      }
    }

    // Fetch pricing_v2_enabled and billing_cycle (new columns — cast until types regenerated)
    const { data: extraCols } = await ((supabaseAny as unknown as {
      from: (t: string) => {
        select: (q: string) => Promise<{
          data: { id: string; pricing_v2_enabled: boolean | null; billing_cycle: string | null }[] | null
          error: unknown
        }>
      }
    }).from('companies').select('id, pricing_v2_enabled, billing_cycle'))

    const extraByCompany = Object.fromEntries(
      (extraCols ?? []).map(c => [c.id, { pricingV2Enabled: c.pricing_v2_enabled ?? false, billingCycle: c.billing_cycle ?? null }])
    )

    const rows: CompanyBillingRow[] = (companiesData ?? [])
      .map(c => ({
        id: c.id,
        name: c.name,
        subscriptionStatus: c.subscription_status,
        ratePerCardZar: c.rate_per_card_zar,
        activeCards: activeCardsByCompany[c.id] ?? 0,
        nextBillingDate: c.next_billing_date,
        outstandingZar: outstandingByCompany[c.id] ?? 0,
        billingCycle: extraByCompany[c.id]?.billingCycle ?? null,
        pricingV2Enabled: extraByCompany[c.id]?.pricingV2Enabled ?? false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    setCompanies(rows)
    setLoading(false)
  }

  async function handleAddRecord(companyId: string, form: AddRecordForm) {
    const { error } = await addBillingRecord({
      companyId,
      type: form.type,
      amountZar: parseFloat(form.amountZar),
      description: form.description || undefined,
      billingDate: form.billingDate,
      status: form.status,
    })
    if (error) {
      alert(`Failed to add record: ${error}`)
    } else {
      setAddingFor(null)
      await loadData()
    }
  }

  const totalMrrZar = companies.reduce((sum, c) => {
    return sum + (c.ratePerCardZar ?? 0) * c.activeCards
  }, 0)

  const totalOutstanding = companies.reduce((sum, c) => sum + c.outstandingZar, 0)

  return (
    <div className="px-10 py-10 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
            Platform Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">Company billing status and manual ledger entries</p>
        </div>

        {!loading && (
          <div className="flex items-center gap-4">
            <div className="glass-panel px-5 py-3 rounded-xl shadow-sm text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total MRR</p>
              <p className="font-jakarta text-xl font-extrabold text-teal-700">{formatZar(totalMrrZar)}</p>
            </div>
            {totalOutstanding > 0 && (
              <div className="glass-panel px-5 py-3 rounded-xl shadow-sm text-center border border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Outstanding</p>
                <p className="font-jakarta text-xl font-extrabold text-amber-700">{formatZar(totalOutstanding)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading billing data…</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center gap-2 py-24 text-red-500 text-sm">
          <span className="material-symbols-outlined">error</span>
          {loadError}
        </div>
      )}

      {/* Table */}
      {!loading && !loadError && (
        <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Rate/Card</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Cards</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Outstanding</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Billing</th>
                <th className="px-6 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => {
                const monthly = (company.ratePerCardZar ?? 0) * company.activeCards
                const isAdding = addingFor === company.id
                return (
                  <>
                    <tr
                      key={company.id}
                      className={[
                        'border-b border-slate-50 last:border-0 transition-colors',
                        isAdding ? 'bg-slate-50/80' : 'hover:bg-slate-50/60',
                      ].join(' ')}
                    >
                      <td className="px-6 py-4">
                        <a
                          href={`/admin/${company.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-teal-700 transition-colors"
                        >
                          {company.name}
                        </a>
                        {company.billingCycle === 'annual' && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase tracking-wide">Annual</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusBadge(company.subscriptionStatus)}`}>
                          {company.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-xs text-slate-600 tabular-nums">
                          {company.ratePerCardZar !== null ? formatZar(company.ratePerCardZar) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-bold text-slate-900 tabular-nums">{company.activeCards}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-teal-700 tabular-nums">{formatZar(monthly)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {company.outstandingZar > 0 ? (
                          <span className="text-sm font-semibold text-amber-600 tabular-nums">{formatZar(company.outstandingZar)}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-slate-500">{formatDate(company.nextBillingDate)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setAddingFor(isAdding ? null : company.id)}
                          className={[
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ml-auto',
                            isAdding
                              ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                              : 'text-teal-700 bg-teal-50 hover:bg-teal-100',
                          ].join(' ')}
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none">
                            {isAdding ? 'close' : 'add'}
                          </span>
                          {isAdding ? 'Cancel' : 'Add Record'}
                        </button>
                      </td>
                    </tr>

                    {isAdding && (
                      <AddRecordDrawer
                        key={`drawer-${company.id}`}
                        companyId={company.id}
                        companyName={company.name}
                        onSave={handleAddRecord}
                        onCancel={() => setAddingFor(null)}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
