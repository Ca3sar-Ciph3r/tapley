'use client'

// app/(admin)/admin/[companyId]/page.tsx
//
// Rendering:  Client component — live data, impersonation action.
// Auth:       Super Admin ONLY. AdminLayout enforces this.
//
// Supabase:   Browser client — super_admin_all RLS policy gives full read access
//             to this company's data.
//
// Shows:
//   - Back to All Companies link
//   - Company header: name, slug, plan badge, status badge, created date
//   - Subscription panel: plan, status, max cards, subscription ends
//   - Analytics summary: total views, views last 30d, active staff cards
//   - Staff cards list: photo | name | title | dept | NFC status | 30d views
//   - "Impersonate Admin" button → calls startImpersonation server action
//
// Impersonation:
//   startImpersonation sets a server-side httpOnly cookie and redirects to /dashboard.
//   The super admin's auth session is unchanged. An impersonation_log row is inserted.
//   The amber banner in the dashboard layout detects the cookie and shows an exit button.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { startImpersonation, generateNfcBatch, updateNfcCardStatus, inviteCompanyAdmin } from '@/lib/actions/admin'
import { sendMonthlyDigest, sendDay5Nudge, sendDay14Analytics } from '@/lib/actions/analytics'
import { ClientInfoPanel } from './_components/ClientInfoPanel'
import { BillingPanel } from './_components/BillingPanel'
import { OnboardingChecklist } from './_components/OnboardingChecklist'
import { DangerZone } from './_components/DangerZone'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Company = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  subscription_plan: string
  subscription_status: string
  subscription_ends_at: string | null
  max_staff_cards: number
  created_at: string
  website: string | null
  tagline: string | null
  // Client info (onboarding)
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  primary_contact_whatsapp: string | null
  internal_notes: string | null
  // Billing
  pricing_tier_id: string | null
  rate_per_card_zar: number | null
  setup_fee_per_card_zar: number | null
  min_cards_committed: number | null
  contract_start_date: string | null
  contract_end_date: string | null
  next_billing_date: string | null
  // Onboarding checklist
  onboarding_checklist: Record<string, boolean> | null
  // Data deletion (migration 20260415030000 — cast until types regenerated)
  deletion_scheduled_at?: string | null
  // Pricing v2 (migration 20260415010000/040000)
  pricing_v2_enabled?: boolean | null
  is_qr_digital?: boolean | null
  billing_cycle?: string | null
}

type NfcCardRow = {
  id: string
  slug: string
  order_status: string
  chip_uid: string | null
  print_batch_id: string | null
  notes: string | null
  created_at: string
  assignedTo: string | null  // staff member full_name if assigned
}

type StaffCardRow = {
  id: string
  full_name: string
  job_title: string
  department: string | null
  photo_url: string | null
  is_active: boolean
  nfc_card_id: string | null
  nfc_slug: string | null
  views30d: number
}

// ---------------------------------------------------------------------------
// Raw query result shapes — Supabase TS inferencer can't resolve embedded
// join columns (e.g. nfc_cards(slug)) so we cast explicitly.
// ---------------------------------------------------------------------------

type RawStaffCard = {
  id: string
  full_name: string
  job_title: string
  department: string | null
  photo_url: string | null
  is_active: boolean
  nfc_card_id: string | null
  nfc_cards: { slug: string } | { slug: string }[] | null
}

type RawNfcCard = {
  id: string
  slug: string
  order_status: string
  chip_uid: string | null
  print_batch_id: string | null
  notes: string | null
  created_at: string
  staff_cards: { full_name: string } | { full_name: string }[] | null
}

type RawCardView = {
  staff_card_id: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-sky-50 text-sky-700',
  active: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 uppercase tracking-wide">
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500'
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// EmailTriggersPanel — manual drip email + monthly digest triggers
// ---------------------------------------------------------------------------

function EmailTriggersPanel({
  companyId,
  primaryContactEmail,
}: {
  companyId: string
  primaryContactEmail: string | null
}) {
  const [sending, setSending] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string | null>>({})

  async function trigger(type: 'day5' | 'day14' | 'digest') {
    setSending(type)
    setResults(prev => ({ ...prev, [type]: null }))
    let error: string | undefined
    if (type === 'day5') ({ error } = await sendDay5Nudge(companyId))
    else if (type === 'day14') ({ error } = await sendDay14Analytics(companyId))
    else ({ error } = await sendMonthlyDigest(companyId))
    setResults(prev => ({ ...prev, [type]: error ?? 'sent' }))
    setSending(null)
  }

  const emails = [
    { type: 'day5' as const, label: 'Day 5 — Tap nudge', icon: 'touch_app', desc: 'Prompts admin to tap their first card.' },
    { type: 'day14' as const, label: 'Day 14 — Analytics snapshot', icon: 'bar_chart', desc: 'First 2-week stats with top card.' },
    { type: 'digest' as const, label: 'Monthly digest', icon: 'mail', desc: '30-day view count + top 3 cards.' },
  ]

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-6">
        <h2 className="font-jakarta text-base font-bold text-slate-900">Email Triggers</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manual send to{' '}
          <span className="font-mono text-slate-600">{primaryContactEmail ?? 'no email set'}</span>
        </p>
      </div>

      {!primaryContactEmail && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 mb-4">
          No primary contact email set — update Client Info before sending.
        </p>
      )}

      <div className="space-y-3">
        {emails.map(({ type, label, icon, desc }) => (
          <div key={type} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-teal-600 leading-none">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {results[type] && (
                <span className={`text-xs font-semibold ${results[type] === 'sent' ? 'text-teal-600' : 'text-red-500'}`}>
                  {results[type] === 'sent' ? '✓ Sent' : results[type]}
                </span>
              )}
              <button
                onClick={() => trigger(type)}
                disabled={sending !== null || !primaryContactEmail}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending === type && (
                  <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
                )}
                {sending === type ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CompanyDetailPage() {
  const params = useParams<{ companyId: string }>()
  const companyId = params.companyId

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [staffCards, setStaffCards] = useState<StaffCardRow[]>([])
  const [totalViews, setTotalViews] = useState(0)
  const [views30d, setViews30d] = useState(0)
  const [nfcCards, setNfcCards] = useState<NfcCardRow[]>([])
  const [impersonating, setImpersonating] = useState(false)
  const [impersonateError, setImpersonateError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [showReasonInput, setShowReasonInput] = useState(false)
  // Invite admin
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  // NFC batch generation
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchQty, setBatchQty] = useState('1')
  const [batchId, setBatchId] = useState('')
  const [generatingBatch, setGeneratingBatch] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [newSlugs, setNewSlugs] = useState<string[] | null>(null)

  useEffect(() => {
    if (companyId) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const companyResult = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyResult.error || !companyResult.data) {
      setLoadError('Company not found or access denied.')
      setLoading(false)
      return
    }

    const [cardsResult, nfcResult, viewsTotalResult, views30dResult] = await Promise.all([
      supabase
        .from('staff_cards')
        .select('id, full_name, job_title, department, photo_url, is_active, nfc_card_id, nfc_cards(slug)')
        .eq('company_id', companyId)
        .order('full_name', { ascending: true }),
      supabase
        .from('nfc_cards')
        .select('id, slug, order_status, chip_uid, print_batch_id, notes, created_at, staff_cards(full_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('card_views')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('card_views')
        .select('staff_card_id')
        .gte('viewed_at', thirtyDaysAgo),
    ])

    // Cast embedded-join results to explicit local shapes — Supabase TS
    // inferencer doesn't resolve nfc_cards(slug) / staff_cards(full_name) selects.
    const rawCards = (cardsResult.data ?? []) as RawStaffCard[]
    const views30dItems = (views30dResult.data ?? []) as RawCardView[]
    const rawNfc = (nfcResult.data ?? []) as RawNfcCard[]

    // Build staff card IDs set for filtering views
    const staffCardIds = new Set(rawCards.map(c => c.id))

    // Count views belonging to this company's cards
    const companyViews30d = views30dItems.filter(
      v => v.staff_card_id && staffCardIds.has(v.staff_card_id)
    ).length

    // Build view count per card for the last 30d
    const viewCountMap = new Map<string, number>()
    for (const v of views30dItems) {
      if (v.staff_card_id && staffCardIds.has(v.staff_card_id)) {
        viewCountMap.set(v.staff_card_id, (viewCountMap.get(v.staff_card_id) ?? 0) + 1)
      }
    }

    const rows: StaffCardRow[] = rawCards.map(c => {
      const nfcCard = Array.isArray(c.nfc_cards) ? c.nfc_cards[0] : c.nfc_cards
      return {
        id: c.id,
        full_name: c.full_name,
        job_title: c.job_title,
        department: c.department,
        photo_url: c.photo_url,
        is_active: c.is_active,
        nfc_card_id: c.nfc_card_id,
        nfc_slug: nfcCard?.slug ?? null,
        views30d: viewCountMap.get(c.id) ?? 0,
      }
    })

    // Build NFC card rows — join assignedTo from staff_cards reverse relation
    const nfcRows: NfcCardRow[] = rawNfc.map(n => {
      const staffArr = Array.isArray(n.staff_cards) ? n.staff_cards : n.staff_cards ? [n.staff_cards] : []
      const assigned = staffArr[0]?.full_name ?? null
      return {
        id: n.id,
        slug: n.slug,
        order_status: n.order_status,
        chip_uid: n.chip_uid,
        print_batch_id: n.print_batch_id,
        notes: n.notes,
        created_at: n.created_at,
        assignedTo: assigned,
      }
    })

    setCompany(companyResult.data as Company)
    setStaffCards(rows)
    setNfcCards(nfcRows)
    setTotalViews(viewsTotalResult.count ?? 0)
    setViews30d(companyViews30d)
    setLoading(false)
  }

  async function handleGenerateBatch() {
    if (!batchQty || parseInt(batchQty, 10) < 1) return
    setGeneratingBatch(true)
    setBatchError(null)
    setNewSlugs(null)

    const result = await generateNfcBatch(
      companyId,
      parseInt(batchQty, 10),
      batchId.trim() || undefined,
    )

    if (result.error) {
      setBatchError(result.error)
      setGeneratingBatch(false)
      return
    }

    setNewSlugs(result.slugs ?? [])
    setGeneratingBatch(false)
    setShowBatchForm(false)
    setBatchQty('1')
    setBatchId('')
    loadData()
  }

  async function handleStatusChange(nfcCardId: string, status: 'pending' | 'programmed' | 'shipped' | 'active' | 'deactivated') {
    await updateNfcCardStatus(nfcCardId, status)
    loadData()
  }

  async function handleImpersonate() {
    if (!company) return
    setImpersonating(true)
    setImpersonateError(null)

    const result = await startImpersonation(companyId, reason.trim() || undefined)

    // If startImpersonation succeeds it calls redirect() — we only reach here on error
    if (result?.error) {
      setImpersonateError(result.error)
      setImpersonating(false)
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(false)

    const result = await inviteCompanyAdmin(companyId, inviteEmail.trim())

    setInviting(false)
    if (result.error) {
      setInviteError(result.error)
    } else {
      setInviteSuccess(true)
      setInviteEmail('')
      // Auto-hide form after 3 seconds
      setTimeout(() => {
        setShowInviteForm(false)
        setInviteSuccess(false)
      }, 3000)
    }
  }

  // --- Loading / error ---
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 min-h-screen text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">
          progress_activity
        </span>
        <span className="text-sm">Loading company data…</span>
      </div>
    )
  }

  if (loadError || !company) {
    return (
      <div className="flex items-center justify-center gap-2 min-h-screen text-red-500 text-sm">
        <span className="material-symbols-outlined">error</span>
        {loadError ?? 'Company not found.'}
      </div>
    )
  }

  const activeCards = staffCards.filter(c => c.is_active)
  const inactiveCards = staffCards.filter(c => !c.is_active)

  return (
    <div className="px-12 py-12 space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[16px] leading-none">arrow_back</span>
          All Companies
        </Link>

        {/* Company header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-14 h-14 rounded-xl object-contain bg-white shadow-sm border border-slate-100"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ backgroundColor: company.brand_primary_color + '20' }}
              >
                <span
                  className="material-symbols-outlined text-[28px] leading-none"
                  style={{ color: company.brand_primary_color }}
                >
                  business
                </span>
              </div>
            )}
            <div>
              <h1 className="font-jakarta text-2xl font-bold text-slate-900">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-slate-400">{company.slug}</span>
                <span className="text-slate-200">·</span>
                <PlanBadge plan={company.subscription_plan} />
                <StatusBadge status={company.subscription_status} />
              </div>
            </div>
          </div>

          {/* Impersonate button */}
          <div className="flex flex-col items-end gap-2">
            {showReasonInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white w-52"
                  onKeyDown={e => { if (e.key === 'Enter') handleImpersonate() }}
                  autoFocus
                />
                <button
                  onClick={handleImpersonate}
                  disabled={impersonating}
                  className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {impersonating ? (
                    <span className="material-symbols-outlined text-[16px] leading-none animate-spin">
                      progress_activity
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px] leading-none">
                      person_play
                    </span>
                  )}
                  {impersonating ? 'Starting…' : 'Impersonate'}
                </button>
                <button
                  onClick={() => { setShowReasonInput(false); setReason('') }}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">close</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowReasonInput(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">
                  person_play
                </span>
                Impersonate Admin
              </button>
            )}
            {impersonateError && (
              <p className="text-xs text-red-600">{impersonateError}</p>
            )}

            {/* Invite Admin */}
            {showInviteForm ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="admin@company.com"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white w-52"
                  onKeyDown={e => { if (e.key === 'Enter') handleInvite() }}
                  autoFocus
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {inviting ? (
                    <span className="material-symbols-outlined text-[16px] leading-none animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px] leading-none">send</span>
                  )}
                  {inviting ? 'Sending…' : 'Send'}
                </button>
                <button
                  onClick={() => { setShowInviteForm(false); setInviteEmail(''); setInviteError(null); setInviteSuccess(false) }}
                  className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">close</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-teal-700 bg-teal-50 hover:bg-teal-100 text-sm font-semibold rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] leading-none">mail</span>
                Invite Admin
              </button>
            )}
            {inviteError && (
              <p className="text-xs text-red-600">{inviteError}</p>
            )}
            {inviteSuccess && (
              <p className="text-xs text-teal-700 font-semibold">
                ✓ Invite sent — they&apos;ll receive an email shortly.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Active Cards</p>
          <p className="text-2xl font-bold font-jakarta text-slate-900">
            {activeCards.length}
            <span className="text-sm font-normal text-slate-400 ml-1">/ {company.max_staff_cards}</span>
          </p>
        </div>
        <div className="glass-panel p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Views (30d)</p>
          <p className="text-2xl font-bold font-jakarta text-slate-900">{views30d.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total Views</p>
          <p className="text-2xl font-bold font-jakarta text-slate-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="glass-panel p-5 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Client Since</p>
          <p className="text-2xl font-bold font-jakarta text-slate-900">{formatDate(company.created_at)}</p>
        </div>
      </div>

      {/* Client Info panel */}
      <ClientInfoPanel
        companyId={company.id}
        info={{
          primary_contact_name: company.primary_contact_name,
          primary_contact_email: company.primary_contact_email,
          primary_contact_phone: company.primary_contact_phone,
          primary_contact_whatsapp: company.primary_contact_whatsapp,
          website: company.website,
          tagline: company.tagline,
          internal_notes: company.internal_notes,
        }}
        onSaved={loadData}
      />

      {/* Billing Summary panel */}
      <BillingPanel
        billing={{
          pricing_tier_id: company.pricing_tier_id,
          rate_per_card_zar: company.rate_per_card_zar,
          setup_fee_per_card_zar: company.setup_fee_per_card_zar,
          min_cards_committed: company.min_cards_committed,
          contract_start_date: company.contract_start_date,
          contract_end_date: company.contract_end_date,
          next_billing_date: company.next_billing_date,
          subscription_plan: company.subscription_plan,
          pricing_v2_enabled: company.pricing_v2_enabled,
          is_qr_digital: company.is_qr_digital,
          billing_cycle: company.billing_cycle,
        }}
        activeCardCount={activeCards.length}
      />

      {/* Onboarding Checklist */}
      <OnboardingChecklist
        companyId={company.id}
        checklist={company.onboarding_checklist as Record<string, boolean> | null}
      />

      {/* Email Triggers */}
      <EmailTriggersPanel
        companyId={company.id}
        primaryContactEmail={company.primary_contact_email}
      />

      {/* NFC Cards panel */}
      <div className="glass-panel rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-jakarta text-base font-bold text-slate-900">
              NFC Cards
              <span className="ml-2 text-sm font-normal text-slate-400">
                {nfcCards.length} total · {nfcCards.filter(c => !c.assignedTo).length} unassigned
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Slugs are permanent — they live in the NFC chip and QR code</p>
          </div>
          <button
            onClick={() => { setShowBatchForm(v => !v); setNewSlugs(null); setBatchError(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">add</span>
            Generate Cards
          </button>
        </div>

        {/* Batch generation form */}
        {showBatchForm && (
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Quantity
                </label>
                <input
                  type="number" value={batchQty} onChange={e => setBatchQty(e.target.value)}
                  min="1" max="200" placeholder="e.g. 12"
                  className="w-28 px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Print Batch ID <span className="text-slate-400 font-normal normal-case">(optional — for your records)</span>
                </label>
                <input
                  type="text" value={batchId} onChange={e => setBatchId(e.target.value)}
                  placeholder="e.g. KARAM-APR-2026"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                />
              </div>
              <button
                onClick={handleGenerateBatch} disabled={generatingBatch}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {generatingBatch
                  ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  : <span className="material-symbols-outlined text-[16px]">contactless</span>
                }
                {generatingBatch ? 'Generating…' : 'Generate'}
              </button>
              <button onClick={() => setShowBatchForm(false)}
                className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-200 transition-colors">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            {batchError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{batchError}</p>
            )}
          </div>
        )}

        {/* Newly generated slugs — copy/export panel */}
        {newSlugs && newSlugs.length > 0 && (
          <div className="px-8 py-5 border-b border-slate-100 bg-emerald-50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-emerald-800">
                {newSlugs.length} card{newSlugs.length > 1 ? 's' : ''} generated — copy slugs for NFC programming
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(newSlugs.join('\n'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy all slugs
                </button>
                <button
                  onClick={() => {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
                    const csv = ['slug,url_nfc,url_qr', ...newSlugs.map(s =>
                      `${s},${appUrl}/c/${s}?src=nfc,${appUrl}/c/${s}?src=qr`
                    )].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `nfc-cards-${new Date().toISOString().split('T')[0]}.csv`
                    a.click()
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export CSV
                </button>
                <button onClick={() => setNewSlugs(null)}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-200 transition-colors">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {newSlugs.map(s => (
                <span key={s} className="font-mono text-xs bg-white border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* NFC cards table */}
        {nfcCards.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            No NFC cards generated yet. Click <strong>Generate Cards</strong> to create a batch.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-8 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Slug / URL</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Assigned To</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Batch</th>
                <th className="px-8 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">Update Status</th>
              </tr>
            </thead>
            <tbody>
              {nfcCards.map(card => (
                <NfcCardTableRow key={card.id} card={card} onStatusChange={handleStatusChange} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Staff cards list */}
      <div className="glass-panel rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <h2 className="font-jakarta text-base font-bold text-slate-900">
            Staff Cards
            <span className="ml-2 text-sm font-normal text-slate-400">
              {activeCards.length} active{inactiveCards.length > 0 ? ` · ${inactiveCards.length} inactive` : ''}
            </span>
          </h2>
        </div>

        {staffCards.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No staff cards yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-8 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Title / Dept
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  NFC Card
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Status
                </th>
                <th className="px-8 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Views (30d)
                </th>
              </tr>
            </thead>
            <tbody>
              {staffCards.map(card => (
                <StaffCardRow key={card.id} card={card} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger Zone */}
      <DangerZone
        companyId={company.id}
        companyName={company.name}
        deletionScheduledAt={company.deletion_scheduled_at}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// NfcCardTableRow
// ---------------------------------------------------------------------------

const NFC_STATUS_STYLES: Record<string, string> = {
  pending:     'bg-slate-100 text-slate-600',
  programmed:  'bg-blue-50 text-blue-700',
  shipped:     'bg-amber-50 text-amber-700',
  active:      'bg-emerald-50 text-emerald-700',
  deactivated: 'bg-red-50 text-red-600',
}

const NFC_STATUS_NEXT: Record<string, { label: string; value: 'pending' | 'programmed' | 'shipped' | 'active' | 'deactivated' }[]> = {
  pending:     [{ label: 'Mark programmed', value: 'programmed' }],
  programmed:  [{ label: 'Mark shipped', value: 'shipped' }],
  shipped:     [{ label: 'Mark active', value: 'active' }],
  active:      [{ label: 'Deactivate', value: 'deactivated' }],
  deactivated: [],
}

function NfcCardTableRow({
  card,
  onStatusChange,
}: {
  card: NfcCardRow
  onStatusChange: (id: string, status: 'pending' | 'programmed' | 'shipped' | 'active' | 'deactivated') => void
}) {
  const appUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://tapleyconnect.co.za'

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      {/* Slug + URL */}
      <td className="px-8 py-3">
        <p className="text-sm font-mono font-semibold text-slate-900">{card.slug}</p>
        <a
          href={`/c/${card.slug}`} target="_blank" rel="noopener noreferrer"
          className="text-[11px] text-teal-500 hover:text-teal-700 truncate"
        >
          {appUrl}/c/{card.slug}
        </a>
      </td>

      {/* Status badge */}
      <td className="px-4 py-3">
        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${NFC_STATUS_STYLES[card.order_status] ?? 'bg-slate-100 text-slate-500'}`}>
          {card.order_status}
        </span>
      </td>

      {/* Assigned staff */}
      <td className="px-4 py-3">
        {card.assignedTo
          ? <span className="text-sm font-medium text-slate-800">{card.assignedTo}</span>
          : <span className="text-xs text-slate-400 italic">Unassigned</span>
        }
      </td>

      {/* Print batch */}
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-slate-400">{card.print_batch_id ?? '—'}</span>
      </td>

      {/* Status actions */}
      <td className="px-8 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {NFC_STATUS_NEXT[card.order_status]?.map(action => (
            <button key={action.value}
              onClick={() => onStatusChange(card.id, action.value)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// StaffCardRow
// ---------------------------------------------------------------------------

function StaffCardHealthDot({ views30d }: { views30d: number }) {
  const color = views30d > 0 ? 'bg-green-400' : 'bg-red-400'
  const title = views30d > 0 ? 'Viewed in last 30 days' : 'No views in last 30 days'
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`}
      title={title}
    />
  )
}

function StaffCardRow({ card }: { card: StaffCardRow }) {
  const initials = card.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
      {/* Photo + name */}
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          {card.photo_url ? (
            <img
              src={card.photo_url}
              alt={card.full_name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-white shadow-sm">
              {initials}
            </div>
          )}
          <div className="flex items-center gap-2">
            <StaffCardHealthDot views30d={card.views30d} />
            <span className="text-sm font-semibold text-slate-900">{card.full_name}</span>
          </div>
        </div>
      </td>

      {/* Title + dept */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-700">{card.job_title}</p>
        {card.department && (
          <p className="text-[11px] text-slate-400">{card.department}</p>
        )}
      </td>

      {/* NFC slug */}
      <td className="px-4 py-3">
        {card.nfc_slug ? (
          <a
            href={`/c/${card.nfc_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-teal-600 hover:text-teal-800"
          >
            {card.nfc_slug}
          </a>
        ) : (
          <span className="text-xs text-slate-400">Unassigned</span>
        )}
      </td>

      {/* Active / inactive */}
      <td className="px-4 py-3">
        {card.is_active ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide">
            Active
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide">
            Inactive
          </span>
        )}
      </td>

      {/* 30d views */}
      <td className="px-8 py-3 text-right">
        <span className="text-sm font-semibold text-slate-900 tabular-nums">
          {card.views30d}
        </span>
      </td>
    </tr>
  )
}
