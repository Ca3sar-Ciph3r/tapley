'use client'

// app/(dashboard)/dashboard/cards/page.tsx
//
// Rendering:  Client component — search, filter, and pagination require interactivity.
// Auth:       Company Admin only. RLS on staff_cards scopes queries to the user's company.
// Supabase:   Browser client — RLS is active, company_id isolation is automatic.
//
// Data fetch (on mount + after mutations):
//   1. staff_cards with nfc_cards(slug, order_status) join
//   2. card_views for all fetched staff_card_ids in the last 30 days (for view counts)
//   View counts are computed in JS (acceptable for MVP per MVP.md tech debt allowances).
//
// Filters (client-side, no re-fetch):
//   all | active | deactivated | unassigned (no NFC card)
//
// Pagination: 50 per page (Karam Africa <50 staff so this may never trigger).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { deactivateStaffCard } from '@/lib/actions/cards'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NfcStatus = 'assigned' | 'unassigned' | 'deactivated'

type StaffCardRow = {
  id: string
  full_name: string
  job_title: string
  department: string | null
  photo_url: string | null
  is_active: boolean
  nfc_card_id: string | null
  nfc_slug: string | null
  nfc_status: NfcStatus
  view_count_30d: number
}

type Filter = 'all' | 'active' | 'deactivated' | 'unassigned'

const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CardsPage() {
  const [cards, setCards] = useState<StaffCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [deactivating, setDeactivating] = useState<string | null>(null)

  async function loadCards() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()

    // Fetch staff cards with NFC join
    const { data: rawCards, error: cardsError } = await supabase
      .from('staff_cards')
      .select('id, full_name, job_title, department, photo_url, is_active, nfc_card_id, nfc_cards(slug, order_status)')
      .order('full_name', { ascending: true })

    if (cardsError || !rawCards) {
      setLoadError('Failed to load staff cards. Please refresh.')
      setLoading(false)
      return
    }

    // Fetch 30-day view counts for all fetched cards
    const staffCardIds = rawCards.map(c => c.id)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: views } =
      staffCardIds.length > 0
        ? await supabase
            .from('card_views')
            .select('staff_card_id')
            .in('staff_card_id', staffCardIds)
            .gte('viewed_at', thirtyDaysAgo)
        : { data: [] as Array<{ staff_card_id: string | null }> }

    // Build view count map
    const viewCountMap = new Map<string, number>()
    for (const view of views ?? []) {
      if (view.staff_card_id) {
        viewCountMap.set(
          view.staff_card_id,
          (viewCountMap.get(view.staff_card_id) ?? 0) + 1
        )
      }
    }

    // Normalise NFC data and merge view counts
    const enriched: StaffCardRow[] = rawCards.map(card => {
      const nfcCard = Array.isArray(card.nfc_cards)
        ? card.nfc_cards[0]
        : (card.nfc_cards as { slug: string; order_status: string } | null)

      let nfcStatus: NfcStatus = 'unassigned'
      if (card.nfc_card_id && nfcCard) {
        nfcStatus = nfcCard.order_status === 'deactivated' ? 'deactivated' : 'assigned'
      }

      return {
        id: card.id,
        full_name: card.full_name,
        job_title: card.job_title,
        department: card.department,
        photo_url: card.photo_url,
        is_active: card.is_active,
        nfc_card_id: card.nfc_card_id,
        nfc_slug: nfcCard?.slug ?? null,
        nfc_status: nfcStatus,
        view_count_30d: viewCountMap.get(card.id) ?? 0,
      }
    })

    setCards(enriched)
    setLoading(false)
  }

  useEffect(() => {
    loadCards()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Client-side filter + search
  const filtered = cards.filter(card => {
    if (search) {
      const q = search.toLowerCase()
      const matches =
        card.full_name.toLowerCase().includes(q) ||
        card.job_title.toLowerCase().includes(q) ||
        (card.department?.toLowerCase().includes(q) ?? false)
      if (!matches) return false
    }
    if (filter === 'active') return card.is_active
    if (filter === 'deactivated') return !card.is_active
    if (filter === 'unassigned') return !card.nfc_card_id && card.is_active
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleDeactivate(cardId: string) {
    if (
      !confirm(
        'Deactivate this staff card? The public card page will stop showing this person immediately.'
      )
    )
      return
    setDeactivating(cardId)
    const result = await deactivateStaffCard(cardId)
    if (result.error) {
      alert(`Could not deactivate: ${result.error}`)
    } else {
      await loadCards()
    }
    setDeactivating(null)
  }

  const activeCount = cards.filter(c => c.is_active).length

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Team Cards</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${activeCount} active staff member${activeCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/cards/import"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Bulk Import
          </Link>
          <Link
            href="/dashboard/cards/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Staff Member
          </Link>
        </div>
      </div>

      {/* Main panel */}
      <div className="glass-panel rounded-2xl border border-slate-200/50 overflow-hidden">
        {/* Search + filter bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Name, title, department…"
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white/70 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100/70 rounded-xl p-1">
            {(['all', 'active', 'deactivated', 'unassigned'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f)
                  setPage(1)
                }}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors',
                  filter === f
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
            <span className="material-symbols-outlined text-[28px] animate-spin">
              progress_activity
            </span>
            <span className="text-sm">Loading staff cards…</span>
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center gap-2 py-24 text-red-500 text-sm">
            <span className="material-symbols-outlined">error</span>
            {loadError}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <span className="material-symbols-outlined text-[48px]">badge</span>
            <p className="text-sm font-medium">
              {search || filter !== 'all'
                ? 'No cards match your search or filter.'
                : 'No staff cards yet.'}
            </p>
            {!search && filter === 'all' && (
              <Link
                href="/dashboard/cards/new"
                className="text-sm text-teal-600 hover:text-teal-700 font-semibold"
              >
                Add your first staff member →
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-3 font-semibold">Staff Member</th>
                <th className="px-6 py-3 font-semibold">NFC Card</th>
                <th className="px-6 py-3 font-semibold text-right">Views (30d)</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginated.map(card => (
                <StaffCardRow
                  key={card.id}
                  card={card}
                  isDeactivating={deactivating === card.id}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 text-sm">
            <span className="text-slate-500">{filtered.length} results</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  chevron_left
                </span>
              </button>
              <span className="font-medium text-slate-700 tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StaffCardRow sub-component
// ---------------------------------------------------------------------------

type StaffCardRowProps = {
  card: StaffCardRow
  isDeactivating: boolean
  onDeactivate: (id: string) => void
}

function StaffCardRow({ card, isDeactivating, onDeactivate }: StaffCardRowProps) {
  const initials = card.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <tr
      className={[
        'group transition-colors hover:bg-slate-50/70',
        !card.is_active ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Staff member — photo + name + title + dept */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 truncate">{card.full_name}</span>
              {!card.is_active && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {card.job_title}
              {card.department ? ` · ${card.department}` : ''}
            </p>
          </div>
        </div>
      </td>

      {/* NFC status badge */}
      <td className="px-6 py-4">
        {card.nfc_status === 'assigned' && card.nfc_slug ? (
          <a
            href={`/c/${card.nfc_slug}?src=link`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full hover:bg-teal-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px] leading-none">nfc</span>
            {card.nfc_slug}
          </a>
        ) : card.nfc_status === 'deactivated' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
            <span className="material-symbols-outlined text-[14px] leading-none">block</span>
            NFC deactivated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            <span className="material-symbols-outlined text-[14px] leading-none">nfc</span>
            Unassigned
          </span>
        )}
      </td>

      {/* 30-day view count */}
      <td className="px-6 py-4 text-right">
        <span className="font-semibold text-slate-700 tabular-nums">
          {card.view_count_30d}
        </span>
        <span className="text-xs text-slate-400 ml-1">views</span>
      </td>

      {/* Action buttons */}
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-0.5">
          {/* View public card — only when NFC is assigned */}
          {card.nfc_status === 'assigned' && card.nfc_slug && (
            <a
              href={`/c/${card.nfc_slug}?src=link`}
              target="_blank"
              rel="noopener noreferrer"
              title="View public card"
              className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                open_in_new
              </span>
            </a>
          )}

          {/* Edit */}
          <Link
            href={`/dashboard/cards/${card.id}`}
            title="Edit card"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">edit</span>
          </Link>

          {/* Assign NFC — only when no NFC card assigned and card is active */}
          {!card.nfc_card_id && card.is_active && (
            <Link
              href={`/dashboard/cards/${card.id}/assign`}
              title="Assign NFC card"
              className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                add_link
              </span>
            </Link>
          )}

          {/* Reassign NFC — only when NFC is assigned */}
          {card.nfc_card_id && (
            <Link
              href={`/dashboard/cards/${card.id}/assign`}
              title="Reassign NFC card"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                swap_horiz
              </span>
            </Link>
          )}

          {/* Deactivate — only for active cards */}
          {card.is_active && (
            <button
              onClick={() => onDeactivate(card.id)}
              disabled={isDeactivating}
              title="Deactivate card"
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <span
                className={[
                  'material-symbols-outlined text-[18px] leading-none',
                  isDeactivating ? 'animate-spin' : '',
                ].join(' ')}
              >
                {isDeactivating ? 'progress_activity' : 'person_off'}
              </span>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
