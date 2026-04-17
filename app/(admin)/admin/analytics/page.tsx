'use client'

// app/(admin)/admin/analytics/page.tsx
//
// Rendering:  Client component — fetches live data from Supabase.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   Browser client with super_admin_all RLS policy.
//
// Sections:
//   1. Headline stats: active companies, staff cards, all-time taps, 30d taps
//   2. Revenue summary: total MRR, projected annual
//   3. Growth chart: new companies per month (last 12 months)
//   4. Top companies by card views (last 30d)
//   5. Referral funnel: pending → qualified → credited

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeadlineStats = {
  activeCompanies: number
  totalStaffCards: number
  totalTapsAllTime: number
  totalTaps30d: number
  totalMrrZar: number
  projectedAnnualZar: number
}

type GrowthPoint = {
  month: string   // e.g. "Apr 2025"
  count: number
}

type TopCompany = {
  companyId: string
  companyName: string
  views30d: number
  activeCards: number
}

type ReferralFunnel = {
  pending: number
  qualified: number
  credited: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-4">
        <span
          className={`material-symbols-outlined text-[24px] leading-none ${accent ?? 'text-teal-600'}`}
        >
          {icon}
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <p className="font-jakarta text-2xl font-extrabold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GrowthChart — simple SVG bar chart
// ---------------------------------------------------------------------------

function GrowthChart({ data }: { data: GrowthPoint[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const barWidth = 32
  const gap = 8
  const chartHeight = 120
  const totalWidth = data.length * (barWidth + gap) - gap

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <h3 className="font-jakarta text-base font-bold text-slate-900 mb-1">Company Growth</h3>
      <p className="text-xs text-slate-400 mb-6">New companies per month — last 12 months</p>

      {data.every(d => d.count === 0) ? (
        <div className="flex items-center justify-center h-32 text-slate-300 text-sm">
          No data yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={totalWidth}
            height={chartHeight + 28}
            className="min-w-full"
          >
            {data.map((point, i) => {
              const barH = max > 0 ? Math.max((point.count / max) * chartHeight, point.count > 0 ? 4 : 0) : 0
              const x = i * (barWidth + gap)
              const y = chartHeight - barH
              return (
                <g key={point.month}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={5}
                    className="fill-teal-500/80"
                  />
                  {point.count > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 5}
                      textAnchor="middle"
                      className="fill-slate-600 text-[10px]"
                      fontSize={10}
                      fontWeight={700}
                    >
                      {point.count}
                    </text>
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 18}
                    textAnchor="middle"
                    className="fill-slate-400 text-[9px]"
                    fontSize={9}
                  >
                    {point.month.slice(0, 3)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReferralFunnelCard
// ---------------------------------------------------------------------------

function ReferralFunnelCard({ funnel }: { funnel: ReferralFunnel }) {
  const total = funnel.pending + funnel.qualified + funnel.credited || 1
  const stages = [
    { label: 'Pending', count: funnel.pending, color: 'bg-amber-400' },
    { label: 'Qualified', count: funnel.qualified, color: 'bg-sky-500' },
    { label: 'Credited', count: funnel.credited, color: 'bg-emerald-500' },
  ]

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <h3 className="font-jakarta text-base font-bold text-slate-900 mb-1">Referral Funnel</h3>
      <p className="text-xs text-slate-400 mb-6">All-time conversion pipeline</p>

      <div className="space-y-3">
        {stages.map(({ label, count, color }) => {
          const pct = Math.round((count / total) * 100)
          return (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-slate-600">{label}</span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{count}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        {total - 1} total referral{total - 1 !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TopCompaniesTable
// ---------------------------------------------------------------------------

function TopCompaniesTable({ companies }: { companies: TopCompany[] }) {
  return (
    <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-jakarta text-base font-bold text-slate-900">Top Companies</h3>
        <p className="text-xs text-slate-400 mt-0.5">Most card views — last 30 days</p>
      </div>

      {companies.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-300 text-sm">
          No views yet
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/40">
              <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">#</th>
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</th>
              <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">30d Views</th>
              <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Cards</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c, i) => (
              <tr key={c.companyId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3">
                  <span className="text-xs font-bold text-slate-400 tabular-nums">{i + 1}</span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/admin/${c.companyId}`}
                    className="text-sm font-semibold text-slate-900 hover:text-teal-700 transition-colors"
                  >
                    {c.companyName}
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold text-teal-700 tabular-nums">{c.views30d.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-xs text-slate-500 tabular-nums">{c.activeCards}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stats, setStats] = useState<HeadlineStats>({
    activeCompanies: 0,
    totalStaffCards: 0,
    totalTapsAllTime: 0,
    totalTaps30d: 0,
    totalMrrZar: 0,
    projectedAnnualZar: 0,
  })
  const [growth, setGrowth] = useState<GrowthPoint[]>([])
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([])
  const [funnel, setFunnel] = useState<ReferralFunnel>({ pending: 0, qualified: 0, credited: 0 })

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const supabaseAny = supabase as unknown as Record<string, (...args: unknown[]) => unknown>

    try {
      // 1. Companies — active count + MRR calc
      const { data: companies, error: companiesError } = await (supabase
        .from('companies')
        .select('id, name, subscription_status, rate_per_card_zar') as unknown as Promise<{
          data: { id: string; name: string; subscription_status: string; rate_per_card_zar: number | null }[] | null
          error: { message: string } | null
        }>)

      if (companiesError) throw new Error(companiesError.message)
      const companyList = companies ?? []

      // 2. Staff cards — count active per company
      const { data: staffCards, error: staffError } = await supabase
        .from('staff_cards')
        .select('id, company_id, is_active')
      if (staffError) throw new Error(staffError.message)

      const cardList = staffCards ?? []
      const activeCards = cardList.filter(c => c.is_active)

      // Active company count (subscription_status != 'cancelled')
      const activeCompanies = companyList.filter(c => c.subscription_status !== 'cancelled').length

      // MRR: sum of (rate_per_card_zar × active_card_count) per company
      const activeCardsByCompany = activeCards.reduce<Record<string, number>>((acc, c) => {
        acc[c.company_id] = (acc[c.company_id] ?? 0) + 1
        return acc
      }, {})

      const totalMrrZar = companyList.reduce((sum, company) => {
        const rate = company.rate_per_card_zar ?? 0
        const count = activeCardsByCompany[company.id] ?? 0
        return sum + rate * count
      }, 0)

      // 3. Card views — all-time and last 30d
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { count: totalTapsAllTime, error: tapsTotalError } = await supabase
        .from('card_views')
        .select('id', { count: 'exact', head: true })
      if (tapsTotalError) throw new Error(tapsTotalError.message)

      const { count: totalTaps30d, error: taps30dError } = await supabase
        .from('card_views')
        .select('id', { count: 'exact', head: true })
        .gte('viewed_at', thirtyDaysAgo)
      if (taps30dError) throw new Error(taps30dError.message)

      setStats({
        activeCompanies,
        totalStaffCards: activeCards.length,
        totalTapsAllTime: totalTapsAllTime ?? 0,
        totalTaps30d: totalTaps30d ?? 0,
        totalMrrZar,
        projectedAnnualZar: totalMrrZar * 12,
      })

      // 4. Growth chart — new companies per month (last 12 months)
      const now = new Date()
      const monthPoints: GrowthPoint[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = d.toISOString()
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
        const count = companyList.filter(c => {
          // companies don't have created_at in this query — use separate fetch below
          return false // placeholder
        }).length
        monthPoints.push({
          month: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
          count,
        })
        void start; void end; void count
      }

      // Fetch companies with created_at for growth chart
      const { data: companiesWithDates, error: datesError } = await (supabase
        .from('companies')
        .select('id, created_at') as unknown as Promise<{
          data: { id: string; created_at: string }[] | null
          error: { message: string } | null
        }>)

      if (!datesError && companiesWithDates) {
        const growthPoints: GrowthPoint[] = []
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const start = d.toISOString()
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
          const count = companiesWithDates.filter(c => c.created_at >= start && c.created_at < end).length
          growthPoints.push({
            month: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
            count,
          })
        }
        setGrowth(growthPoints)
      }

      // 5. Top companies by views last 30d — group card_views by staff_card.company_id
      const { data: recentViews, error: viewsError } = await supabase
        .from('card_views')
        .select('staff_card_id')
        .gte('viewed_at', thirtyDaysAgo)

      if (!viewsError && recentViews) {
        // Join staff_cards to get company_id
        const { data: staffCardsAll, error: scError } = await supabase
          .from('staff_cards')
          .select('id, company_id')
        if (!scError && staffCardsAll) {
          const cardToCompany = Object.fromEntries(staffCardsAll.map(c => [c.id, c.company_id]))
          const viewsByCompany: Record<string, number> = {}
          for (const v of recentViews) {
            const cid = cardToCompany[v.staff_card_id]
            if (cid) viewsByCompany[cid] = (viewsByCompany[cid] ?? 0) + 1
          }
          const sorted = Object.entries(viewsByCompany)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)

          const companyNameMap = Object.fromEntries(companyList.map(c => [c.id, c.name]))
          setTopCompanies(sorted.map(([companyId, views30d]) => ({
            companyId,
            companyName: companyNameMap[companyId] ?? 'Unknown',
            views30d,
            activeCards: activeCardsByCompany[companyId] ?? 0,
          })))
        }
      }

      // 6. Referral funnel
      const { data: referrals, error: refError } = await (supabaseAny['from']('referrals')
        .select('id, status') as unknown as Promise<{
          data: { id: string; status: string }[] | null
          error: { message: string } | null
        }>)

      if (!refError && referrals) {
        setFunnel({
          pending: referrals.filter(r => r.status === 'pending').length,
          qualified: referrals.filter(r => r.status === 'qualified').length,
          credited: referrals.filter(r => r.status === 'credited').length,
        })
      }
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 h-[60vh] text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
        <span className="text-sm">Loading analytics…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-red-500">
        <span className="material-symbols-outlined text-[36px]">error</span>
        <p className="text-sm font-medium">{loadError}</p>
        <button
          onClick={loadAll}
          className="text-xs text-teal-600 hover:underline font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="px-10 py-10 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
          Platform Analytics
        </h1>
        <p className="text-sm text-slate-500 mt-1">Live snapshot across all companies</p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon="business"
          label="Active Companies"
          value={String(stats.activeCompanies)}
          accent="text-indigo-600"
        />
        <StatCard
          icon="badge"
          label="Active Cards"
          value={formatNum(stats.totalStaffCards)}
          accent="text-teal-600"
        />
        <StatCard
          icon="nfc"
          label="All-Time Taps"
          value={formatNum(stats.totalTapsAllTime)}
          accent="text-teal-600"
        />
        <StatCard
          icon="trending_up"
          label="Taps (30d)"
          value={formatNum(stats.totalTaps30d)}
          accent="text-emerald-600"
        />
        <StatCard
          icon="payments"
          label="Monthly MRR"
          value={formatZar(stats.totalMrrZar)}
          accent="text-amber-600"
        />
        <StatCard
          icon="currency_exchange"
          label="Projected ARR"
          value={formatZar(stats.projectedAnnualZar)}
          sub="MRR × 12"
          accent="text-amber-500"
        />
      </div>

      {/* Growth chart + Referral funnel side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GrowthChart data={growth} />
        </div>
        <ReferralFunnelCard funnel={funnel} />
      </div>

      {/* Top companies table */}
      <TopCompaniesTable companies={topCompanies} />
    </div>
  )
}
