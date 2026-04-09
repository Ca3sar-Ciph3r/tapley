'use client'

// app/(dashboard)/dashboard/analytics/page.tsx
//
// Rendering:  Client component — charts and date-range toggles require interactivity.
// Auth:       Company Admin only. RLS on card_views scopes queries to the user's company.
// Supabase:   Browser client — RLS active, company isolation is automatic.
//
// Data fetch (on mount, both queries in parallel):
//   1. card_views for last 90 days — used for all stat cards, chart, and device breakdown
//   2. staff_cards (active only) — used for Top Team Members list
//
// Stat card derivations are computed from raw data in JS (MVP tech debt allowance).
// See JOURNEYS.md Journey 6 for the intended query pattern.
//
// Rules enforced:
//   - Never expose raw card_view rows — only aggregated counts shown in UI
//   - Browser client only (never admin/service-role in dashboard routes)

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartMode = 'daily' | 'weekly' | 'monthly'

type ChartPoint = { label: string; count: number }

type RawView = {
  staff_card_id: string | null
  viewed_at: string
  session_id: string
  os: string | null
  wa_clicked: boolean
  vcf_downloaded: boolean
}

type RawStaffCard = {
  id: string
  full_name: string
  job_title: string
  photo_url: string | null
}

type TopCard = RawStaffCard & { views: number }

// ---------------------------------------------------------------------------
// Chart data builders
// ---------------------------------------------------------------------------

function buildDailyPoints(views: RawView[], days: number): ChartPoint[] {
  const map = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    map.set(d.toISOString().split('T')[0], 0)
  }
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000
  for (const v of views) {
    if (new Date(v.viewed_at).getTime() < cutoffMs) continue
    const key = v.viewed_at.split('T')[0]
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries()).map(([date, count]) => {
    const [, m, d] = date.split('-')
    return { label: `${d}/${m}`, count }
  })
}

function buildWeeklyPoints(views: RawView[], weeks: number): ChartPoint[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekIndex = weeks - 1 - i // 0 = oldest week
    const startMs = Date.now() - (weekIndex + 1) * 7 * 24 * 60 * 60 * 1000
    const endMs = Date.now() - weekIndex * 7 * 24 * 60 * 60 * 1000
    const count = views.filter(v => {
      const t = new Date(v.viewed_at).getTime()
      return t >= startMs && t < endMs
    }).length
    return { label: `WK ${String(i + 1).padStart(2, '0')}`, count }
  })
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function buildMonthlyPoints(views: RawView[], months: number): ChartPoint[] {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const count = views.filter(v => {
      const vd = new Date(v.viewed_at)
      return vd.getFullYear() === year && vd.getMonth() === month
    }).length
    return { label: MONTH_NAMES[month], count }
  })
}

// ---------------------------------------------------------------------------
// SVG path helpers
// ---------------------------------------------------------------------------

const CHART_W = 800
const CHART_H = 200
const CHART_PAD_V = 16

function buildLinePath(points: ChartPoint[]): string {
  if (points.length < 2) return ''
  const maxCount = Math.max(...points.map(p => p.count), 1)
  const xs = points.map((_, i) => (i / (points.length - 1)) * CHART_W)
  const ys = points.map(
    p => CHART_PAD_V + (CHART_H - CHART_PAD_V * 2) * (1 - p.count / maxCount)
  )
  let d = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const cpx = ((xs[i - 1] + xs[i]) / 2).toFixed(1)
    d += ` C ${cpx} ${ys[i - 1].toFixed(1)}, ${cpx} ${ys[i].toFixed(1)}, ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`
  }
  return d
}

function buildAreaPath(points: ChartPoint[]): string {
  const line = buildLinePath(points)
  if (!line) return ''
  return `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  value: string
  change: number | null
}

function StatCard({ icon, iconBg, iconColor, label, value, change }: StatCardProps) {
  const positive = change !== null && change >= 0
  return (
    <div className="glass-panel p-6 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:-translate-y-1 transition-all duration-300">
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
        {change !== null && (
          <span
            className={[
              'text-[11px] font-bold px-2.5 py-1 rounded-full',
              positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
            ].join(' ')}
          >
            {positive ? '+' : ''}
            {change}%
          </span>
        )}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold font-jakarta text-slate-900">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// LineChart
// ---------------------------------------------------------------------------

interface LineChartProps {
  points: ChartPoint[]
  mode: ChartMode
  onModeChange: (mode: ChartMode) => void
}

function LineChart({ points, mode, onModeChange }: LineChartProps) {
  const linePath = buildLinePath(points)
  const areaPath = buildAreaPath(points)
  const hasData = points.some(p => p.count > 0)

  // Show at most 8 x-axis labels to avoid crowding
  const labelStep = points.length > 8 ? Math.ceil(points.length / 8) : 1

  return (
    <div className="glass-panel p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-jakarta text-lg font-bold text-slate-900">Engagement Trends</h2>
          <p className="text-xs text-slate-500 mt-0.5">Card views over time</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-full p-1">
          {(['daily', 'weekly', 'monthly'] as ChartMode[]).map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all',
                mode === m
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {m === 'daily' ? 'Daily' : m === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No data for this period
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H + 40}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="engagement-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C9A7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00C9A7" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={areaPath} fill="url(#engagement-grad)" />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke="#00C9A7"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data point dots — only when few points, otherwise cluttered */}
            {points.length <= 12 &&
              points.map((p, i) => {
                const maxCount = Math.max(...points.map(pt => pt.count), 1)
                const x = (i / (points.length - 1)) * CHART_W
                const y = CHART_PAD_V + (CHART_H - CHART_PAD_V * 2) * (1 - p.count / maxCount)
                return (
                  <circle
                    key={i}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r="5"
                    fill="#00C9A7"
                    stroke="white"
                    strokeWidth="2"
                  />
                )
              })}

            {/* X-axis separator */}
            <line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke="#E2E8F0" strokeWidth="1" />

            {/* X-axis labels */}
            {points.map((p, i) => {
              if (i % labelStep !== 0 && i !== points.length - 1) return null
              const x = (i / (points.length - 1)) * CHART_W
              return (
                <text
                  key={i}
                  x={x.toFixed(1)}
                  y={CHART_H + 24}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="#94A3B8"
                >
                  {p.label}
                </text>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeviceBar
// ---------------------------------------------------------------------------

interface DeviceBarProps {
  icon: string
  label: string
  percentage: number
  barColor: string
}

function DeviceBar({ icon, label, percentage, barColor }: DeviceBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] leading-none text-slate-400">
            {icon}
          </span>
          <span className="font-semibold text-slate-700">{label}</span>
        </div>
        <span className="font-semibold text-slate-700 tabular-nums">{percentage}%</span>
      </div>
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TeamMemberRow
// ---------------------------------------------------------------------------

function TeamMemberRow({ card, rank }: { card: TopCard; rank: number }) {
  const initials = card.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-300 w-4 tabular-nums flex-shrink-0">
          {rank}
        </span>
        {card.photo_url ? (
          <img
            src={card.photo_url}
            alt={card.full_name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold flex-shrink-0 ring-2 ring-white shadow-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{card.full_name}</p>
          <p className="text-[10px] uppercase tracking-tight text-slate-500 truncate">
            {card.job_title}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-sm font-bold text-slate-900 tabular-nums">{card.views}</p>
        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Taps</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<ChartMode>('daily')
  const [rawViews, setRawViews] = useState<RawView[]>([])
  const [staffCards, setStaffCards] = useState<RawStaffCard[]>([])

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const [viewsResult, cardsResult] = await Promise.all([
      supabase
        .from('card_views')
        .select('staff_card_id, viewed_at, session_id, os, wa_clicked, vcf_downloaded')
        .gte('viewed_at', ninetyDaysAgo),
      supabase
        .from('staff_cards')
        .select('id, full_name, job_title, photo_url')
        .eq('is_active', true),
    ])

    if (viewsResult.error || cardsResult.error) {
      setLoadError('Failed to load analytics data. Please refresh.')
      setLoading(false)
      return
    }

    setRawViews((viewsResult.data ?? []) as RawView[])
    setStaffCards((cardsResult.data ?? []) as RawStaffCard[])
    setLoading(false)
  }

  // --- Derived stats ---
  const MS_30D = 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const thirtyDaysAgoMs = now - MS_30D
  const sixtyDaysAgoMs = now - 2 * MS_30D

  const views30d = rawViews.filter(v => new Date(v.viewed_at).getTime() >= thirtyDaysAgoMs)
  const viewsPrev30d = rawViews.filter(v => {
    const t = new Date(v.viewed_at).getTime()
    return t >= sixtyDaysAgoMs && t < thirtyDaysAgoMs
  })

  const totalViews = views30d.length
  const prevTotalViews = viewsPrev30d.length
  const viewsChange =
    prevTotalViews > 0
      ? Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100)
      : null

  const uniqueUsers = new Set(views30d.map(v => v.session_id)).size
  const prevUniqueUsers = new Set(viewsPrev30d.map(v => v.session_id)).size
  const uniqueUsersChange =
    prevUniqueUsers > 0
      ? Math.round(((uniqueUsers - prevUniqueUsers) / prevUniqueUsers) * 100)
      : null

  const avgPerDay = Math.round(totalViews / 30)

  const conversions = views30d.filter(v => v.wa_clicked || v.vcf_downloaded).length
  const conversionRate =
    totalViews > 0 ? Math.round((conversions / totalViews) * 1000) / 10 : 0

  // Device breakdown
  const iosTaps = views30d.filter(v => v.os === 'ios').length
  const androidTaps = views30d.filter(v => v.os === 'android').length
  const otherTaps = totalViews - iosTaps - androidTaps
  const iosPct = totalViews > 0 ? Math.round((iosTaps / totalViews) * 100) : 0
  const androidPct = totalViews > 0 ? Math.round((androidTaps / totalViews) * 100) : 0
  const otherPct = Math.max(0, 100 - iosPct - androidPct)

  // Top cards by views in last 30 days
  const viewCountMap = new Map<string, number>()
  for (const v of views30d) {
    if (v.staff_card_id) {
      viewCountMap.set(v.staff_card_id, (viewCountMap.get(v.staff_card_id) ?? 0) + 1)
    }
  }
  const topCards: TopCard[] = staffCards
    .map(c => ({ ...c, views: viewCountMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)

  // Chart points (use full 90d dataset so all three modes work without re-fetch)
  const chartPoints =
    chartMode === 'daily'
      ? buildDailyPoints(rawViews, 30)
      : chartMode === 'weekly'
        ? buildWeeklyPoints(rawViews, 8)
        : buildMonthlyPoints(rawViews, 3)

  // --- Loading / error states ---
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 min-h-screen text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">
          progress_activity
        </span>
        <span className="text-sm">Loading analytics…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center gap-2 min-h-screen text-red-500 text-sm">
        <span className="material-symbols-outlined">error</span>
        {loadError}
      </div>
    )
  }

  return (
    <div className="px-12 py-12 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Company-wide card performance · last 30 days</p>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          icon="ads_click"
          iconBg="rgba(0,201,167,0.1)"
          iconColor="#00C9A7"
          label="Total Taps"
          value={totalViews.toLocaleString()}
          change={viewsChange}
        />
        <StatCard
          icon="group"
          iconBg="rgba(99,102,241,0.1)"
          iconColor="#6366f1"
          label="Unique Users"
          value={uniqueUsers.toLocaleString()}
          change={uniqueUsersChange}
        />
        <StatCard
          icon="calendar_today"
          iconBg="rgba(245,158,11,0.1)"
          iconColor="#f59e0b"
          label="Avg. Taps per Day"
          value={avgPerDay.toLocaleString()}
          change={null}
        />
        <StatCard
          icon="conversion_path"
          iconBg="rgba(0,201,167,0.1)"
          iconColor="#00C9A7"
          label="Conversion Rate"
          value={`${conversionRate}%`}
          change={null}
        />
      </div>

      {/* Row 2: Engagement trend chart */}
      <LineChart points={chartPoints} mode={chartMode} onModeChange={setChartMode} />

      {/* Row 3: Device breakdown + Top team members */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Taps by device */}
        <div className="lg:col-span-6 glass-panel p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <h2 className="font-jakarta text-lg font-bold text-slate-900 mb-6">Taps by Device</h2>
          {totalViews === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-5">
              <DeviceBar
                icon="smartphone"
                label="iPhone (iOS)"
                percentage={iosPct}
                barColor="#00C9A7"
              />
              <DeviceBar
                icon="android"
                label="Android Devices"
                percentage={androidPct}
                barColor="#6366f1"
              />
              <DeviceBar
                icon="laptop"
                label="Others (Desktop / Web)"
                percentage={otherPct}
                barColor="#94A3B8"
              />
            </div>
          )}
        </div>

        {/* Popular team members */}
        <div className="lg:col-span-4 glass-panel p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <h2 className="font-jakarta text-lg font-bold text-slate-900 mb-4">
            Popular Team Members
          </h2>
          {topCards.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No data yet</p>
          ) : (
            <div>
              {topCards.map((card, i) => (
                <TeamMemberRow key={card.id} card={card} rank={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
