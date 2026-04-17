'use client'

// app/(admin)/admin/referrals/page.tsx
//
// Rendering:  Client component — live data + credit action.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   Browser client (super_admin_all RLS policy).
//
// Shows all referrals across all companies in one table.
// Filter by status. Credit button calls existing creditReferral server action.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { creditReferral } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReferralStatus = 'pending' | 'qualified' | 'credited'

type ReferralRow = {
  id: string
  referrerCompanyId: string
  referrerCompanyName: string
  referredCompanyId: string
  referredCompanyName: string
  status: ReferralStatus
  createdAt: string
  creditedAt: string | null
}

const STATUS_STYLES: Record<ReferralStatus, string> = {
  pending:   'bg-amber-50 text-amber-700',
  qualified: 'bg-sky-50 text-sky-700',
  credited:  'bg-emerald-50 text-emerald-700',
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  pending:   'Pending',
  qualified: 'Qualified',
  credited:  'Credited',
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type FilterStatus = 'all' | ReferralStatus

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [crediting, setCrediting] = useState<string | null>(null)

  useEffect(() => {
    loadReferrals()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadReferrals() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => {
        select: (q: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
        }
      }
    }

    const { data, error } = await supabaseAny
      .from('referrals')
      .select(`
        id,
        referrer_company_id,
        referred_company_id,
        status,
        created_at,
        credited_at,
        referrer:companies!referrals_referrer_company_id_fkey(name),
        referred:companies!referrals_referred_company_id_fkey(name)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Failed to load referrals.')
      setLoading(false)
      return
    }

    const mapped: ReferralRow[] = (data ?? []).map((r: unknown) => {
      const row = r as {
        id: string
        referrer_company_id: string
        referred_company_id: string
        status: string
        created_at: string
        credited_at: string | null
        referrer: { name: string } | { name: string }[] | null
        referred: { name: string } | { name: string }[] | null
      }
      const referrerName = Array.isArray(row.referrer)
        ? (row.referrer[0]?.name ?? 'Unknown')
        : (row.referrer?.name ?? 'Unknown')
      const referredName = Array.isArray(row.referred)
        ? (row.referred[0]?.name ?? 'Unknown')
        : (row.referred?.name ?? 'Unknown')
      return {
        id: row.id,
        referrerCompanyId: row.referrer_company_id,
        referrerCompanyName: referrerName,
        referredCompanyId: row.referred_company_id,
        referredCompanyName: referredName,
        status: row.status as ReferralStatus,
        createdAt: row.created_at,
        creditedAt: row.credited_at,
      }
    })

    setRows(mapped)
    setLoading(false)
  }

  async function handleCredit(referralId: string) {
    setCrediting(referralId)
    const { error } = await creditReferral(referralId)
    if (error) {
      alert(`Could not credit referral: ${error}`)
    } else {
      await loadReferrals()
    }
    setCrediting(null)
  }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  // Summary counts
  const counts = rows.reduce<Record<ReferralStatus, number>>(
    (acc, r) => { acc[r.status]++; return acc },
    { pending: 0, qualified: 0, credited: 0 }
  )

  return (
    <div className="px-10 py-10 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
            Referrals
          </h1>
          <p className="text-sm text-slate-500 mt-1">All referrals across the platform</p>
        </div>

        {/* Summary badges */}
        {!loading && (
          <div className="flex items-center gap-3">
            {(Object.entries(counts) as [ReferralStatus, number][]).map(([status, count]) => (
              <div key={status} className="glass-panel px-4 py-2 rounded-xl shadow-sm text-center">
                <p className="text-lg font-extrabold font-jakarta text-slate-900 tabular-nums">{count}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{STATUS_LABELS[status]}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {([
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'qualified', label: 'Qualified' },
            { key: 'credited', label: 'Credited' },
          ] as { key: FilterStatus; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                filter === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1.5 text-xs tabular-nums text-slate-400">
                  ({counts[key as ReferralStatus]})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading / error / empty */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading referrals…</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center gap-2 py-24 text-red-500 text-sm">
          <span className="material-symbols-outlined">error</span>
          {loadError}
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <span className="material-symbols-outlined text-[48px]">people</span>
          <p className="text-sm font-medium">No referrals yet.</p>
          <p className="text-xs text-center max-w-xs">
            Referrals are created when a company signs up using another company's referral code.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !loadError && rows.length > 0 && (
        <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              No {filter} referrals.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Referring Company</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Referred Company</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Credited</th>
                  <th className="px-6 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <a
                        href={`/admin/${row.referrerCompanyId}`}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-700 transition-colors"
                      >
                        {row.referrerCompanyName}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={`/admin/${row.referredCompanyId}`}
                        className="text-sm text-slate-700 hover:text-teal-700 transition-colors"
                      >
                        {row.referredCompanyName}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-slate-500">{formatDate(row.creditedAt)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {row.status !== 'credited' ? (
                        <button
                          onClick={() => handleCredit(row.id)}
                          disabled={crediting === row.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                        >
                          {crediting === row.id ? (
                            <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
                          )}
                          {crediting === row.id ? 'Crediting…' : 'Credit'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Credited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
