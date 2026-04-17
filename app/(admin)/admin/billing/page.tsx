'use client'

// app/(admin)/admin/billing/page.tsx
//
// Rendering:  Client component — live data + add billing record action.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   Browser client (super_admin_all RLS policy).
//
// Layout:
//   Header stats: Total MRR, Total Outstanding, Companies with overdue
//   Company table — each row expands into a full billing summary:
//     - Upcoming invoice card (calculated: rate × active cards, due on next_billing_date)
//     - Billing history table (all billing_records for this company)
//     - Quick-add billing record form

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addBillingRecord, type BillingRecordType, type BillingRecordStatus } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyRow = {
  id: string
  name: string
  subscriptionStatus: string
  ratePerCardZar: number | null
  activeCards: number
  nextBillingDate: string | null
  billingCycle: string | null
  minCardsCommitted: number | null
  outstandingZar: number
  paidThisMonth: number
  totalPaidAllTime: number
  lastPaymentDate: string | null
}

type BillingRecord = {
  id: string
  type: string
  amountZar: number
  description: string | null
  billingDate: string
  status: string
  createdAt: string
}

type AddRecordForm = {
  type: BillingRecordType
  amountZar: string
  description: string
  billingDate: string
  status: BillingRecordStatus
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECORD_TYPES: BillingRecordType[] = [
  'monthly_fee', 'setup_fee', 'referral_credit', 'manual_credit', 'payment',
]

const TYPE_LABELS: Record<string, string> = {
  monthly_fee:     'Monthly Fee',
  setup_fee:       'Setup Fee',
  referral_credit: 'Referral Credit',
  manual_credit:   'Manual Credit',
  payment:         'Payment',
}

const TYPE_STYLES: Record<string, string> = {
  monthly_fee:     'bg-indigo-50 text-indigo-700',
  setup_fee:       'bg-sky-50 text-sky-700',
  referral_credit: 'bg-teal-50 text-teal-700',
  manual_credit:   'bg-emerald-50 text-emerald-700',
  payment:         'bg-slate-100 text-slate-600',
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  paid:    'bg-emerald-50 text-emerald-700',
  waived:  'bg-slate-100 text-slate-500',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null
  const diff = new Date(dateIso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / (1000 * 60 * 60 * 24))
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

// ---------------------------------------------------------------------------
// UpcomingInvoiceCard
// ---------------------------------------------------------------------------

function UpcomingInvoiceCard({ company }: { company: CompanyRow }) {
  const billable = Math.max(company.activeCards, company.minCardsCommitted ?? 0)
  const amount = (company.ratePerCardZar ?? 0) * billable
  const days = daysUntil(company.nextBillingDate)

  const urgency =
    days === null ? 'text-slate-400' :
    days < 0     ? 'text-red-600 font-semibold' :
    days <= 7    ? 'text-amber-600 font-semibold' :
    'text-slate-500'

  return (
    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-[28px] text-indigo-500 leading-none">
          receipt
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5">
            Next Invoice
          </p>
          <p className="font-jakarta text-2xl font-extrabold text-slate-900">
            {formatZar(amount)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {billable} card{billable !== 1 ? 's' : ''} ×{' '}
            {company.ratePerCardZar !== null ? formatZar(company.ratePerCardZar) : '—'}
            {company.billingCycle === 'annual' && ' · Annual plan'}
            {company.minCardsCommitted && company.activeCards < company.minCardsCommitted
              ? ` (minimum ${company.minCardsCommitted} cards applied)`
              : ''}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-slate-400 mb-0.5">Due date</p>
        <p className={`text-sm font-bold ${urgency}`}>
          {formatDate(company.nextBillingDate)}
        </p>
        {days !== null && (
          <p className={`text-xs mt-0.5 ${urgency}`}>
            {days < 0
              ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
              : days === 0
              ? 'Due today'
              : `in ${days} day${days !== 1 ? 's' : ''}`}
          </p>
        )}
        <p className="text-[10px] text-slate-300 mt-1">Auto-generates on due date</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BillingHistoryTable
// ---------------------------------------------------------------------------

function BillingHistoryTable({
  records,
  onUpdateStatus,
  updating,
}: {
  records: BillingRecord[]
  onUpdateStatus: (id: string, status: BillingRecordStatus) => Promise<void>
  updating: string | null
}) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic py-4 text-center">
        No billing records yet.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
          <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
          <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</th>
          <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
          <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
          <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
        </tr>
      </thead>
      <tbody>
        {records.map(r => (
          <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors">
            <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
              {formatDate(r.billingDate)}
            </td>
            <td className="px-4 py-3">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TYPE_STYLES[r.type] ?? 'bg-slate-100 text-slate-600'}`}>
                {TYPE_LABELS[r.type] ?? r.type}
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
              {r.description ?? '—'}
            </td>
            <td className="px-4 py-3 text-right">
              <span className={`text-sm font-semibold tabular-nums ${r.type === 'payment' || r.type === 'referral_credit' || r.type === 'manual_credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {r.type === 'payment' || r.type === 'referral_credit' || r.type === 'manual_credit' ? '−' : ''}
                {formatZar(Math.abs(r.amountZar))}
              </span>
            </td>
            <td className="px-4 py-3">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {r.status}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                {r.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(r.id, 'paid')}
                      disabled={updating === r.id}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {updating === r.id ? '…' : 'Mark Paid'}
                    </button>
                    <button
                      onClick={() => onUpdateStatus(r.id, 'waived')}
                      disabled={updating === r.id}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
                    >
                      Waive
                    </button>
                  </>
                )}
                {r.status !== 'pending' && (
                  <span className="text-xs text-slate-300 italic">—</span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// QuickAddForm
// ---------------------------------------------------------------------------

function QuickAddForm({
  companyId,
  onSave,
}: {
  companyId: string
  onSave: (companyId: string, form: AddRecordForm) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
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
    setOpen(false)
    setForm({ type: 'monthly_fee', amountZar: '', description: '', billingDate: todayIso(), status: 'pending' })
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-100 transition-colors"
      >
        <span className="material-symbols-outlined text-[16px] leading-none">add</span>
        Add Record
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-bold text-slate-600 mb-3">Add Billing Record</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value as BillingRecordType)} className={inputCls}>
            {RECORD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Amount (ZAR)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={form.amountZar} onChange={e => set('amountZar', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.billingDate}
            onChange={e => set('billingDate', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value as BillingRecordStatus)} className={inputCls}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="waived">Waived</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input type="text" placeholder="Optional…"
            value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50">
          {saving
            ? <span className="material-symbols-outlined text-[13px] leading-none animate-spin">progress_activity</span>
            : <span className="material-symbols-outlined text-[13px] leading-none">save</span>}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompanyBillingDetail — the expanded drawer
// ---------------------------------------------------------------------------

function CompanyBillingDetail({
  company,
  records,
  loadingRecords,
  onAddRecord,
  onUpdateStatus,
  updating,
}: {
  company: CompanyRow
  records: BillingRecord[]
  loadingRecords: boolean
  onAddRecord: (companyId: string, form: AddRecordForm) => Promise<void>
  onUpdateStatus: (recordId: string, status: BillingRecordStatus) => Promise<void>
  updating: string | null
}) {
  // Payment summary stats
  const paid   = records.filter(r => r.status === 'paid' && r.type === 'payment')
  const pending = records.filter(r => r.status === 'pending')

  const totalPaid = paid.reduce((s, r) => s + r.amountZar, 0)
  const totalPending = pending.reduce((s, r) => s + r.amountZar, 0)
  const lastPayment = paid.sort((a, b) => b.billingDate.localeCompare(a.billingDate))[0] ?? null

  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-6 space-y-5">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid (All Time)', value: formatZar(totalPaid), icon: 'check_circle', accent: 'text-emerald-600' },
          { label: 'Outstanding', value: formatZar(totalPending), icon: 'pending', accent: totalPending > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Last Payment', value: lastPayment ? formatDate(lastPayment.billingDate) : '—', icon: 'calendar_today', accent: 'text-slate-500' },
          { label: 'Records Total', value: String(records.length), icon: 'receipt_long', accent: 'text-indigo-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl px-4 py-3 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className={`material-symbols-outlined text-[16px] leading-none ${s.accent}`}>{s.icon}</span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
            <p className={`font-jakarta text-lg font-extrabold ${s.accent === 'text-emerald-600' ? 'text-emerald-700' : 'text-slate-900'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Upcoming invoice */}
      <UpcomingInvoiceCard company={company} />

      {/* Billing history */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-900">Billing History</h4>
          <QuickAddForm companyId={company.id} onSave={onAddRecord} />
        </div>
        {loadingRecords ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            Loading…
          </div>
        ) : (
          <BillingHistoryTable
            records={records}
            onUpdateStatus={onUpdateStatus}
            updating={updating}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompanyBillingRow — summary row + expand toggle
// ---------------------------------------------------------------------------

function CompanyBillingRow({
  company,
  expanded,
  onToggle,
  records,
  loadingRecords,
  onAddRecord,
  onUpdateStatus,
  updating,
}: {
  company: CompanyRow
  expanded: boolean
  onToggle: () => void
  records: BillingRecord[]
  loadingRecords: boolean
  onAddRecord: (companyId: string, form: AddRecordForm) => Promise<void>
  onUpdateStatus: (recordId: string, status: BillingRecordStatus) => Promise<void>
  updating: string | null
}) {
  const monthly = (company.ratePerCardZar ?? 0) * Math.max(company.activeCards, company.minCardsCommitted ?? 0)
  const days = daysUntil(company.nextBillingDate)
  const isOverdue = days !== null && days < 0 && company.subscriptionStatus !== 'cancelled'

  return (
    <>
      {/* Summary row */}
      <tr
        onClick={onToggle}
        className={[
          'border-b border-slate-50 transition-colors cursor-pointer select-none',
          expanded ? 'bg-slate-50/80' : isOverdue ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50/60',
        ].join(' ')}
      >
        {/* Expand chevron + company name */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <span className={`material-symbols-outlined text-[18px] leading-none text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
              chevron_right
            </span>
            <div>
              <a
                href={`/admin/${company.id}`}
                onClick={e => e.stopPropagation()}
                className="text-sm font-semibold text-slate-900 hover:text-teal-700 transition-colors"
              >
                {company.name}
              </a>
              {company.billingCycle === 'annual' && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase tracking-wide">Annual</span>
              )}
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-4 py-4">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${statusBadge(company.subscriptionStatus)}`}>
            {company.subscriptionStatus}
          </span>
        </td>

        {/* Rate */}
        <td className="px-4 py-4 text-right">
          <span className="text-xs text-slate-500 tabular-nums">
            {company.ratePerCardZar !== null ? formatZar(company.ratePerCardZar) : '—'}
          </span>
        </td>

        {/* Active cards */}
        <td className="px-4 py-4 text-right">
          <span className="text-sm font-bold text-slate-900 tabular-nums">{company.activeCards}</span>
          {company.minCardsCommitted && company.activeCards < company.minCardsCommitted && (
            <span className="block text-[10px] text-amber-500 font-medium">min {company.minCardsCommitted}</span>
          )}
        </td>

        {/* Monthly */}
        <td className="px-4 py-4 text-right">
          <span className="text-sm font-semibold text-teal-700 tabular-nums">{formatZar(monthly)}</span>
        </td>

        {/* Outstanding */}
        <td className="px-4 py-4 text-right">
          {company.outstandingZar > 0 ? (
            <span className="text-sm font-semibold text-amber-600 tabular-nums">{formatZar(company.outstandingZar)}</span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>

        {/* Next billing */}
        <td className="px-4 py-4">
          <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : days !== null && days <= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
            {formatDate(company.nextBillingDate)}
            {isOverdue && <span className="ml-1 text-[10px]">(overdue)</span>}
            {!isOverdue && days !== null && days <= 7 && days >= 0 && (
              <span className="block text-[10px] text-amber-500">in {days}d</span>
            )}
          </span>
        </td>

        {/* Expand indicator */}
        <td className="px-5 py-4 text-right">
          <span className="text-xs text-slate-400 font-medium">
            {records.length > 0 ? `${records.length} record${records.length !== 1 ? 's' : ''}` : expanded ? '' : 'Click to expand'}
          </span>
        </td>
      </tr>

      {/* Expandable detail */}
      {expanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <CompanyBillingDetail
              company={company}
              records={records}
              loadingRecords={loadingRecords}
              onAddRecord={onAddRecord}
              onUpdateStatus={onUpdateStatus}
              updating={updating}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminBillingPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Map of companyId → billing records (loaded lazily on expand)
  const [records, setRecords] = useState<Record<string, BillingRecord[]>>({})
  const [loadingRecords, setLoadingRecords] = useState<Record<string, boolean>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingRecord, setUpdatingRecord] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()

    // Fetch companies with billing fields
    const { data: companiesData, error: companiesError } = await (supabase
      .from('companies')
      .select('id, name, subscription_status, rate_per_card_zar, next_billing_date')
      .order('name') as unknown as Promise<{
        data: { id: string; name: string; subscription_status: string; rate_per_card_zar: number | null; next_billing_date: string | null }[] | null
        error: { message: string } | null
      }>)

    if (companiesError) { setLoadError('Failed to load companies.'); setLoading(false); return }

    // Fetch extra billing columns (new — cast until types regenerated)
    const { data: extraData } = await (supabase
      .from('companies')
      .select('id, billing_cycle, min_cards_committed') as unknown as Promise<{
        data: { id: string; billing_cycle: string | null; min_cards_committed: number | null }[] | null
        error: unknown
      }>)
    const extraMap = Object.fromEntries((extraData ?? []).map(c => [c.id, c]))

    // Active staff cards per company
    const { data: staffCards } = await supabase
      .from('staff_cards').select('company_id, is_active')
    const activeByCompany = (staffCards ?? []).filter(c => c.is_active)
      .reduce<Record<string, number>>((acc, c) => { acc[c.company_id] = (acc[c.company_id] ?? 0) + 1; return acc }, {})

    // Pending billing records per company (outstanding)
    const { data: pendingRecs } = await (supabase
      .from('billing_records')
      .select('company_id, amount_zar, status') as unknown as Promise<{
        data: { company_id: string; amount_zar: number; status: string }[] | null
        error: unknown
      }>)

    const outstandingByCompany: Record<string, number> = {}
    const paidByCompany: Record<string, number> = {}
    for (const r of pendingRecs ?? []) {
      if (r.status === 'pending') outstandingByCompany[r.company_id] = (outstandingByCompany[r.company_id] ?? 0) + r.amount_zar
      if (r.status === 'paid') paidByCompany[r.company_id] = (paidByCompany[r.company_id] ?? 0) + r.amount_zar
    }

    setCompanies((companiesData ?? []).map(c => ({
      id: c.id,
      name: c.name,
      subscriptionStatus: c.subscription_status,
      ratePerCardZar: c.rate_per_card_zar,
      activeCards: activeByCompany[c.id] ?? 0,
      nextBillingDate: c.next_billing_date,
      billingCycle: extraMap[c.id]?.billing_cycle ?? null,
      minCardsCommitted: extraMap[c.id]?.min_cards_committed ?? null,
      outstandingZar: outstandingByCompany[c.id] ?? 0,
      paidThisMonth: 0,
      totalPaidAllTime: paidByCompany[c.id] ?? 0,
      lastPaymentDate: null,
    })))

    setLoading(false)
  }

  const loadRecordsForCompany = useCallback(async (companyId: string) => {
    if (records[companyId]) return  // already loaded
    setLoadingRecords(prev => ({ ...prev, [companyId]: true }))
    const supabase = createClient()

    const { data, error } = await (supabase
      .from('billing_records')
      .select('id, type, amount_zar, description, billing_date, status, created_at')
      .eq('company_id', companyId)
      .order('billing_date', { ascending: false }) as unknown as Promise<{
        data: { id: string; type: string; amount_zar: number; description: string | null; billing_date: string; status: string; created_at: string }[] | null
        error: { message: string } | null
      }>)

    if (!error && data) {
      setRecords(prev => ({
        ...prev,
        [companyId]: data.map(r => ({
          id: r.id, type: r.type, amountZar: r.amount_zar,
          description: r.description, billingDate: r.billing_date,
          status: r.status, createdAt: r.created_at,
        })),
      }))
    }
    setLoadingRecords(prev => ({ ...prev, [companyId]: false }))
  }, [records])

  function handleToggle(companyId: string) {
    if (expandedId === companyId) {
      setExpandedId(null)
    } else {
      setExpandedId(companyId)
      loadRecordsForCompany(companyId)
    }
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
    if (error) { alert(`Failed to add record: ${error}`); return }

    // Refresh records for this company
    setRecords(prev => { const n = { ...prev }; delete n[companyId]; return n })
    loadRecordsForCompany(companyId)
    await loadData()
  }

  async function handleUpdateStatus(recordId: string, status: BillingRecordStatus) {
    setUpdatingRecord(recordId)
    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
    }
    const { error } = await supabaseAny.from('billing_records')
      .update({ status })
      .eq('id', recordId)

    if (error) { alert(`Failed to update: ${error.message}`) }
    else {
      // Update local state
      setRecords(prev => {
        const updated = { ...prev }
        for (const cid of Object.keys(updated)) {
          updated[cid] = updated[cid].map(r => r.id === recordId ? { ...r, status } : r)
        }
        return updated
      })
      await loadData()
    }
    setUpdatingRecord(null)
  }

  // Platform totals
  const totalMrr = companies.reduce((s, c) => s + (c.ratePerCardZar ?? 0) * Math.max(c.activeCards, c.minCardsCommitted ?? 0), 0)
  const totalOutstanding = companies.reduce((s, c) => s + c.outstandingZar, 0)
  const overdueCount = companies.filter(c => {
    const d = daysUntil(c.nextBillingDate)
    return d !== null && d < 0 && c.subscriptionStatus !== 'cancelled'
  }).length

  return (
    <div className="px-10 py-10 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">Platform Billing</h1>
          <p className="text-sm text-slate-500 mt-1">Click any company to see full billing history and upcoming invoice</p>
        </div>

        {!loading && (
          <div className="flex items-center gap-4">
            <div className="glass-panel px-5 py-3 rounded-xl shadow-sm text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly MRR</p>
              <p className="font-jakarta text-xl font-extrabold text-teal-700">{formatZar(totalMrr)}</p>
            </div>
            {totalOutstanding > 0 && (
              <div className="glass-panel px-5 py-3 rounded-xl shadow-sm text-center border border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Outstanding</p>
                <p className="font-jakarta text-xl font-extrabold text-amber-700">{formatZar(totalOutstanding)}</p>
              </div>
            )}
            {overdueCount > 0 && (
              <div className="glass-panel px-5 py-3 rounded-xl shadow-sm text-center border border-red-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Overdue</p>
                <p className="font-jakarta text-xl font-extrabold text-red-600">{overdueCount}</p>
              </div>
            )}
          </div>
        )}
      </div>

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

      {!loading && !loadError && (
        <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="px-5 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Rate/Card</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Cards</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly</th>
                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Outstanding</th>
                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Next Billing</th>
                <th className="px-5 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map(company => (
                <CompanyBillingRow
                  key={company.id}
                  company={company}
                  expanded={expandedId === company.id}
                  onToggle={() => handleToggle(company.id)}
                  records={records[company.id] ?? []}
                  loadingRecords={loadingRecords[company.id] ?? false}
                  onAddRecord={handleAddRecord}
                  onUpdateStatus={handleUpdateStatus}
                  updating={updatingRecord}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
