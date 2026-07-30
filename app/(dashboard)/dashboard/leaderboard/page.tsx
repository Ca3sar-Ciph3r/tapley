'use client'

// app/(dashboard)/dashboard/leaderboard/page.tsx
//
// Staff ranked by card activity. The single most engaging thing a client can
// show their team, and it comes almost free — card_views is already scoped per
// company through the nfc_cards join.
//
// Ranked on CONNECTIONS (WhatsApp taps, contacts saved, CTA clicks), not raw
// views. Views measure how often a card was opened; connections measure whether
// it did its job. Ranking on views would reward someone who tapped their own
// card twenty times, which is exactly the wrong incentive to design in.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getEffectiveCompanyId } from '@/lib/actions/admin'
import { NoCompanySelected } from '@/components/dashboard/no-company-selected'

type Period = 7 | 30 | 90

interface Row {
  id: string
  full_name: string
  job_title: string
  photo_url: string | null
  views: number
  connections: number
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(30)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const supabase = createClient()
    const since = new Date(Date.now() - period * 86_400_000).toISOString()

    const [staffResult, viewsResult] = await Promise.all([
      supabase
        .from('staff_cards')
        .select('id, full_name, job_title, photo_url')
        .eq('company_id', activeCompanyId)
        .eq('is_active', true),
      // Scoped through nfc_cards — card_views carries no company_id.
      supabase
        .from('card_views')
        .select(
          'staff_card_id, wa_clicked, vcf_downloaded, cta_clicked, nfc_cards!inner(company_id)'
        )
        .eq('nfc_cards.company_id', activeCompanyId)
        .gte('viewed_at', since),
    ])

    const staff = (staffResult.data ?? []) as Array<{
      id: string
      full_name: string
      job_title: string
      photo_url: string | null
    }>

    const views = (viewsResult.data ?? []) as unknown as Array<{
      staff_card_id: string | null
      wa_clicked: boolean
      vcf_downloaded: boolean
      cta_clicked: boolean
    }>

    const tally = new Map<string, { views: number; connections: number }>()
    for (const v of views) {
      if (!v.staff_card_id) continue
      const entry = tally.get(v.staff_card_id) ?? { views: 0, connections: 0 }
      entry.views += 1
      if (v.wa_clicked || v.vcf_downloaded || v.cta_clicked) entry.connections += 1
      tally.set(v.staff_card_id, entry)
    }

    const ranked = staff
      .map(s => ({
        ...s,
        views: tally.get(s.id)?.views ?? 0,
        connections: tally.get(s.id)?.connections ?? 0,
      }))
      // Connections first; views only break ties.
      .sort((a, b) => b.connections - a.connections || b.views - a.views)

    setRows(ranked)
    setLoading(false)
  }, [activeCompanyId, period])

  useEffect(() => {
    getEffectiveCompanyId().then(setActiveCompanyId)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!activeCompanyId) return <NoCompanySelected what="the leaderboard" />

  const topScore = rows[0]?.connections ?? 0
  const totalConnections = rows.reduce((sum, r) => sum + r.connections, 0)

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Leaderboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Ranked by connections made — WhatsApp taps, contacts saved and link
            clicks. Not just how often a card was opened.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                period === p.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No active staff cards yet.</p>
      ) : totalConnections === 0 ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            No connections in the last {period} days yet.
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">
            Once your team starts tapping their cards, this is where you will see
            who is converting those taps into saved contacts and WhatsApp chats.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const pct = topScore > 0 ? (r.connections / topScore) * 100 : 0
            return (
              <div
                key={r.id}
                className={`flex items-center gap-4 rounded-xl border p-4 ${
                  i === 0
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-slate-200/70 bg-white/60'
                }`}
              >
                <span className="w-7 shrink-0 text-center text-lg font-bold tabular-nums text-slate-400">
                  {MEDALS[i] ?? i + 1}
                </span>

                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photo_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                    {r.full_name
                      .split(' ')
                      .map(p => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {r.full_name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{r.job_title}</p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-1 rounded-full bg-teal-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-slate-900">
                    {r.connections}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    {r.connections === 1 ? 'connection' : 'connections'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                    {r.views} tap{r.views === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
