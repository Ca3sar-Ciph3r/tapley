'use client'

// app/(dashboard)/dashboard/_components/DashboardOverview.tsx
//
// Rendering:  Client component — chart toggle and live data require interactivity.
// Auth:       Company Admin only. Rendered by /dashboard/page.tsx for admin role.
// Supabase:   Browser client — RLS auto-scopes all queries to the current admin's company.
//
// Data fetch (on mount, both queries in parallel):
//   1. card_views last 90 days — drives all stats, chart, top cards, activity feed
//   2. staff_cards (all) — active count, team count, top card names/photos
//
// Derived data (no additional queries):
//   - taps30d / taps30dPrev  → % change badge
//   - active / total staff cards
//   - chart points grouped by day/week
//   - top 4 staff cards by views (30d)
//   - recent 8 activity items
//
// Rules:
//   - Never expose raw card_view rows — only aggregated counts shown
//   - Browser client only (never service role in dashboard)

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartMode = '7d' | '30d' | '90d'

type RawView = {
  staff_card_id: string | null
  viewed_at: string
  source: string | null
}

type StaffCard = {
  id: string
  full_name: string
  job_title: string
  photo_url: string | null
  is_active: boolean
}

type TopCard = StaffCard & { views: number }

type ActivityItem = {
  staff_card_id: string | null
  viewed_at: string
  source: string | null
  staffName: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function percentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '—'
  const pct = Math.round(((current - previous) / previous) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function sourceBadge(source: string | null) {
  switch (source) {
    case 'nfc':
      return { label: 'NFC', cls: 'bg-teal-50 text-teal-700 border border-teal-100' }
    case 'qr':
      return { label: 'QR', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-100' }
    case 'link':
      return { label: 'Link', cls: 'bg-amber-50 text-amber-700 border border-amber-100' }
    default:
      return { label: 'Other', cls: 'bg-slate-100 text-slate-600' }
  }
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

const INITIALS_COLOURS = [
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-purple-100 text-purple-700',
  'bg-sky-100 text-sky-700',
]

function initialsColour(name: string): string {
  const index = name.charCodeAt(0) % INITIALS_COLOURS.length
  return INITIALS_COLOURS[index]
}

// ---------------------------------------------------------------------------
// Chart data builder
// ---------------------------------------------------------------------------

type ChartPoint = { label: string; count: number }

function buildChartPoints(views: RawView[], mode: ChartMode): ChartPoint[] {
  const days = mode === '7d' ? 7 : mode === '30d' ? 30 : 90
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000

  if (mode === '90d') {
    // Group by 7-day buckets
    const buckets = new Map<string, number>()
    for (let i = 12; i >= 0; i--) {
      const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      buckets.set(key, 0)
    }
    for (const v of views) {
      const ms = new Date(v.viewed_at).getTime()
      if (ms < cutoffMs) continue
      // Find which bucket this belongs to
      let bestKey: string | null = null
      for (const key of buckets.keys()) {
        const keyMs = new Date(key).getTime()
        if (ms >= keyMs && (bestKey === null || keyMs > new Date(bestKey).getTime())) {
          bestKey = key
        }
      }
      if (bestKey) buckets.set(bestKey, (buckets.get(bestKey) ?? 0) + 1)
    }
    return Array.from(buckets.entries()).map(([key, count]) => ({
      label: new Date(key).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
      count,
    }))
  }

  // Daily buckets for 7d and 30d
  const map = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    map.set(d.toISOString().split('T')[0], 0)
  }
  for (const v of views) {
    const day = v.viewed_at.split('T')[0]
    if (map.has(day)) {
      map.set(day, (map.get(day) ?? 0) + 1)
    }
  }
  const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return Array.from(map.entries()).map(([key, count]) => ({
    label: mode === '7d'
      ? DAY_ABBR[new Date(key + 'T12:00:00').getDay()]
      : new Date(key + 'T12:00:00').getDate().toString(),
    count,
  }))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  value: string | number
  badge?: string
  badgePositive?: boolean
  note?: string
}

function StatCard({ icon, iconBg, iconColor, label, value, badge, badgePositive, note }: StatCardProps) {
  return (
    <div className="glass-panel p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-transform duration-200">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <span
            className="material-symbols-outlined text-[20px] leading-none"
            style={{ color: iconColor }}
          >
            {icon}
          </span>
        </div>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
              badgePositive !== false
                ? 'bg-teal-50 text-teal-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {badgePositive !== false && (
              <span className="material-symbols-outlined text-[12px] leading-none">
                trending_up
              </span>
            )}
            {badge}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-jakarta text-slate-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-1">
        {label}
      </p>
      {note && (
        <p className="text-[10px] text-slate-400 mt-0.5">{note}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardOverview() {
  const [views, setViews] = useState<RawView[]>([])
  const [staffCards, setStaffCards] = useState<StaffCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<ChartMode>('30d')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [viewsResult, staffResult] = await Promise.all([
      supabase
        .from('card_views')
        .select('staff_card_id, viewed_at, source')
        .gte('viewed_at', ninetyDaysAgo)
        .order('viewed_at', { ascending: false }),
      supabase
        .from('staff_cards')
        .select('id, full_name, job_title, photo_url, is_active')
        .order('full_name', { ascending: true }),
    ])

    if (viewsResult.error) {
      setLoadError('Could not load analytics data.')
      setLoading(false)
      return
    }

    setViews((viewsResult.data ?? []) as RawView[])
    setStaffCards((staffResult.data ?? []) as StaffCard[])
    setLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const thirtyDaysAgo = useMemo(() => Date.now() - 30 * 24 * 60 * 60 * 1000, [])
  const sixtyDaysAgo = useMemo(() => Date.now() - 60 * 24 * 60 * 60 * 1000, [])

  const taps30d = useMemo(
    () => views.filter(v => new Date(v.viewed_at).getTime() >= thirtyDaysAgo).length,
    [views, thirtyDaysAgo],
  )

  const taps30dPrev = useMemo(
    () => views.filter(v => {
      const ms = new Date(v.viewed_at).getTime()
      return ms >= sixtyDaysAgo && ms < thirtyDaysAgo
    }).length,
    [views, sixtyDaysAgo, thirtyDaysAgo],
  )

  const activeCards = useMemo(() => staffCards.filter(c => c.is_active), [staffCards])

  const topCards = useMemo((): TopCard[] => {
    const staffById = new Map(staffCards.map(s => [s.id, s]))
    const counts = new Map<string, number>()
    for (const v of views) {
      if (!v.staff_card_id) continue
      if (new Date(v.viewed_at).getTime() < thirtyDaysAgo) continue
      counts.set(v.staff_card_id, (counts.get(v.staff_card_id) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, count]) => {
        const s = staffById.get(id)
        return s ? { ...s, views: count } : null
      })
      .filter((x): x is TopCard => x !== null)
  }, [views, staffCards, thirtyDaysAgo])

  const chartPoints = useMemo(
    () => buildChartPoints(views, chartMode),
    [views, chartMode],
  )

  const chartMax = useMemo(
    () => Math.max(1, ...chartPoints.map(p => p.count)),
    [chartPoints],
  )

  const recentActivity = useMemo((): ActivityItem[] => {
    const staffById = new Map(staffCards.map(s => [s.id, s]))
    return views.slice(0, 8).map(v => ({
      staff_card_id: v.staff_card_id,
      viewed_at: v.viewed_at,
      source: v.source,
      staffName: (v.staff_card_id && staffById.get(v.staff_card_id)?.full_name) || 'Unknown',
    }))
  }, [views, staffCards])

  // ---------------------------------------------------------------------------
  // Loading / error
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
        <span className="text-sm">Loading dashboard…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-2 text-red-500 text-sm">
        <span className="material-symbols-outlined">error</span>
        {loadError}
      </div>
    )
  }

  const tapChangeStr = percentChange(taps30d, taps30dPrev)
  const tapChangePositive = taps30d >= taps30dPrev

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-10 py-10 space-y-7">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Last 30 days at a glance</p>
        </div>
        <Link
          href="/dashboard/cards/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">add_circle</span>
          Add Team Member
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon="sensors"
          iconBg="#f0fdf9"
          iconColor="#0d9488"
          label="Total Taps — 30 days"
          value={taps30d}
          badge={tapChangeStr}
          badgePositive={tapChangePositive}
        />
        <StatCard
          icon="person_add"
          iconBg="#eef2ff"
          iconColor="#4f46e5"
          label="Contacts Captured"
          value="—"
          badge="Post-MVP"
          badgePositive={false}
          note="Contact capture coming soon"
        />
        <StatCard
          icon="credit_card"
          iconBg="#fffbeb"
          iconColor="#d97706"
          label="Active Cards"
          value={activeCards.length}
        />
        <StatCard
          icon="group"
          iconBg="#f8fafc"
          iconColor="#475569"
          label="Team Members"
          value={staffCards.length}
        />
      </div>

      {/* Chart + Top Cards */}
      <div className="grid grid-cols-12 gap-6">
        {/* Tap Activity chart — col-span-8 */}
        <div className="col-span-12 lg:col-span-8 glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-jakarta text-base font-bold text-slate-900">Tap Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Card views over time</p>
            </div>
            {/* Toggle */}
            <div className="flex items-center gap-1 bg-slate-100/60 p-1 rounded-xl">
              {(['7d', '30d', '90d'] as ChartMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    chartMode === m
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Bar chart */}
          <div className="relative h-40">
            {/* Horizontal grid lines */}
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-slate-200/60"
                style={{ bottom: `${(i / 3) * 100}%` }}
              />
            ))}
            {/* Bars */}
            <div className="relative h-full flex items-end gap-[3px]">
              {chartPoints.map((point, idx) => {
                const heightPct = chartMax > 0 ? (point.count / chartMax) * 100 : 0
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end gap-0.5 min-w-0"
                    title={`${point.label}: ${point.count} taps`}
                  >
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-teal-200/60 to-teal-400/70 transition-all duration-300 hover:from-teal-300/80 hover:to-teal-500/80"
                      style={{ height: `${Math.max(heightPct, point.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* X-axis labels — show a subset to avoid crowding */}
          <div className="flex mt-2">
            {chartPoints.map((point, idx) => {
              // Show every Nth label depending on count
              const total = chartPoints.length
              const showEvery = total <= 7 ? 1 : total <= 30 ? 5 : 2
              const show = idx % showEvery === 0 || idx === total - 1
              return (
                <div key={idx} className="flex-1 text-center min-w-0">
                  {show && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      {point.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Cards — col-span-4 */}
        <div className="col-span-12 lg:col-span-4 glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-jakarta text-base font-bold text-slate-900">Top Cards</h2>
            <Link
              href="/dashboard/analytics"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
            >
              View all →
            </Link>
          </div>

          {topCards.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No taps yet this month.</p>
          ) : (
            <div className="space-y-4">
              {topCards.map(card => {
                const widthPct = topCards[0].views > 0
                  ? Math.round((card.views / topCards[0].views) * 100)
                  : 0
                return (
                  <div key={card.id} className="flex items-center gap-3">
                    {/* Photo or initials */}
                    {card.photo_url ? (
                      <img
                        src={card.photo_url}
                        alt={card.full_name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${initialsColour(card.full_name)}`}
                      >
                        {initials(card.full_name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-bold text-slate-900 truncate mr-2">
                          {card.full_name}
                        </span>
                        <span className="text-xs font-bold text-teal-600 flex-shrink-0">
                          {card.views}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full">
                        <div
                          className="h-1.5 bg-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-jakarta text-base font-bold text-slate-900">Recent Taps</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest card view events across your team</p>
          </div>
          <Link
            href="/dashboard/analytics"
            className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors"
          >
            Full analytics →
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <span className="material-symbols-outlined text-[40px] text-slate-300 mb-3 block">
              sensors
            </span>
            <p className="text-sm text-slate-500">No taps recorded yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Taps will appear here once NFC cards are programmed and assigned.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((item, idx) => {
              const badge = sourceBadge(item.source)
              const colourCls = initialsColour(item.staffName)
              return (
                <div
                  key={idx}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colourCls}`}
                  >
                    {initials(item.staffName)}
                  </div>
                  {/* Name */}
                  <span className="flex-1 text-sm font-semibold text-slate-800 truncate">
                    {item.staffName}
                  </span>
                  {/* Source badge */}
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                  {/* Time ago */}
                  <span className="text-xs text-slate-400 flex-shrink-0 w-16 text-right">
                    {timeAgo(item.viewed_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
