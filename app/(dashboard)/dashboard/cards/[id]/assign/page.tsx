'use client'

// app/(dashboard)/dashboard/cards/[id]/assign/page.tsx
//
// Rendering:  Client component — multi-step flow with confirmation.
// Auth:       Company Admin only. RLS scopes all DB reads/writes to the admin's company.
//
// Handles TWO distinct flows depending on whether the staff card already has
// an NFC card assigned:
//
// A. INITIAL ASSIGNMENT (nfc_card_id === null)
//    Pick an unassigned NFC card from the company's inventory → assign it.
//    Calls assignNfcCard server action. No deactivation of any existing card.
//
// B. REASSIGNMENT (nfc_card_id is set)  — See JOURNEYS.md Journey 2
//    Three reassignment modes (radio select):
//      1. existing — move NFC to an active staff card that has no NFC card yet
//      2. new      — create a new staff card inline and assign immediately
//      3. unassign — remove NFC from the current card, return to inventory
//
// Flow (both):
//   Load → Choose target → Confirm summary → Run action → Redirect

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  assignNfcCard,
  reassignNfcCard,
  type ReassignNfcCardInput,
} from '@/lib/actions/cards'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CurrentCard = {
  id: string
  full_name: string
  job_title: string
  is_active: boolean
  nfc_card_id: string | null
  nfc_slug: string | null
}

type AvailableStaff = {
  id: string
  full_name: string
  job_title: string
  department: string | null
}

type ReassignMode = 'existing' | 'new' | 'unassign'

type NewStaffForm = {
  full_name: string
  job_title: string
  email: string
}

type NewStaffErrors = Partial<Record<keyof NewStaffForm, string>>

type InventoryNfcCard = {
  id: string
  slug: string
  order_status: string
  chip_uid: string | null
  notes: string | null
}

const EMPTY_NEW_STAFF: NewStaffForm = {
  full_name: '',
  job_title: '',
  email: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateNewStaff(values: NewStaffForm): NewStaffErrors {
  const errors: NewStaffErrors = {}
  if (!values.full_name.trim()) errors.full_name = 'Full name is required.'
  else if (values.full_name.trim().length < 2) errors.full_name = 'Must be at least 2 characters.'
  if (!values.job_title.trim()) errors.job_title = 'Job title is required.'
  if (values.email.trim() && !isValidEmail(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}

function inputClass(hasError: boolean): string {
  return [
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white/70 placeholder-slate-400 transition-shadow',
    'focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400',
    hasError
      ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400'
      : 'border-slate-200',
  ].join(' ')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] leading-none">error</span>
          {error}
        </p>
      )}
    </div>
  )
}

interface RadioOptionProps {
  value: ReassignMode
  selected: boolean
  onSelect: (v: ReassignMode) => void
  icon: string
  title: string
  description: string
}

function RadioOption({ value, selected, onSelect, icon, title, description }: RadioOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={[
        'w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150',
        selected
          ? 'border-teal-400 bg-teal-50/60 ring-2 ring-teal-500/20'
          : 'border-slate-200 bg-white/60 hover:border-slate-300 hover:bg-slate-50/60',
      ].join(' ')}
    >
      {/* Radio dot */}
      <div
        className={[
          'mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
          selected ? 'border-teal-600' : 'border-slate-300',
        ].join(' ')}
      >
        {selected && (
          <div className="w-2 h-2 rounded-full bg-teal-600" />
        )}
      </div>

      {/* Icon + text */}
      <span
        className={[
          'material-symbols-outlined text-[22px] leading-none flex-shrink-0 mt-0.5',
          selected ? 'text-teal-600' : 'text-slate-400',
        ].join(' ')}
      >
        {icon}
      </span>

      <div>
        <p className={['text-sm font-semibold', selected ? 'text-teal-800' : 'text-slate-800'].join(' ')}>
          {title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AssignNfcCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  // --- data state ---
  const [currentCard, setCurrentCard] = useState<CurrentCard | null>(null)
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([])
  const [availableNfc, setAvailableNfc] = useState<InventoryNfcCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // --- form state ---
  const [mode, setMode] = useState<ReassignMode>('existing')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [selectedNfcId, setSelectedNfcId] = useState<string>('')
  const [staffSearch, setStaffSearch] = useState<string>('')
  const [newStaff, setNewStaff] = useState<NewStaffForm>(EMPTY_NEW_STAFF)
  const [newStaffErrors, setNewStaffErrors] = useState<NewStaffErrors>({})

  // --- submission state ---
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // --- success state ---
  const [successNfcUrl, setSuccessNfcUrl] = useState<string | null>(null)
  const [successCardId, setSuccessCardId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Load on mount
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()

    // Fetch the current staff card + its NFC info
    const { data: cardRaw, error: cardError } = await supabase
      .from('staff_cards')
      .select('id, full_name, job_title, is_active, nfc_card_id, nfc_cards(slug)')
      .eq('id', id)
      .single()

    if (cardError || !cardRaw) {
      setLoadError('Staff card not found or you do not have access.')
      setLoading(false)
      return
    }

    const card = cardRaw as {
      id: string
      full_name: string
      job_title: string
      is_active: boolean
      nfc_card_id: string | null
      nfc_cards: { slug: string } | { slug: string }[] | null
    }

    const nfcRow = Array.isArray(card.nfc_cards) ? card.nfc_cards[0] : card.nfc_cards
    const nfcSlug = (nfcRow as { slug: string } | null)?.slug ?? null

    setCurrentCard({
      id: card.id,
      full_name: card.full_name,
      job_title: card.job_title,
      is_active: card.is_active,
      nfc_card_id: card.nfc_card_id,
      nfc_slug: nfcSlug,
    })

    if (card.nfc_card_id === null) {
      // INITIAL ASSIGNMENT flow — load NFC inventory for this company.
      // Fetch all non-deactivated nfc_cards (RLS filters to the admin's company),
      // then exclude any that are already assigned to an active staff card.
      const [nfcResult, assignedResult] = await Promise.all([
        supabase
          .from('nfc_cards')
          .select('id, slug, order_status, chip_uid, notes')
          .neq('order_status', 'deactivated')
          .order('created_at', { ascending: false }),
        supabase
          .from('staff_cards')
          .select('nfc_card_id')
          .not('nfc_card_id', 'is', null),
      ])

      const assignedIds = new Set(
        ((assignedResult.data ?? []) as Array<{ nfc_card_id: string | null }>)
          .map(s => s.nfc_card_id)
          .filter((v): v is string => v !== null)
      )

      const inventory = ((nfcResult.data ?? []) as InventoryNfcCard[]).filter(
        c => !assignedIds.has(c.id)
      )
      setAvailableNfc(inventory)
    } else {
      // REASSIGNMENT flow — load staff cards without an NFC card (potential new holders)
      const { data: staff } = await supabase
        .from('staff_cards')
        .select('id, full_name, job_title, department')
        .eq('is_active', true)
        .is('nfc_card_id', null)
        .neq('id', id) // exclude the current card

      const staffList = (staff ?? []) as AvailableStaff[]
      setAvailableStaff(staffList.sort((a, b) => a.full_name.localeCompare(b.full_name)))
    }

    setLoading(false)
  }

  // Filtered staff list for the searchable dropdown
  const filteredStaff = availableStaff.filter(s => {
    const q = staffSearch.toLowerCase()
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.job_title.toLowerCase().includes(q) ||
      (s.department ?? '').toLowerCase().includes(q)
    )
  })

  function setNewStaffField(field: keyof NewStaffForm, value: string) {
    setNewStaff(prev => ({ ...prev, [field]: value }))
    if (newStaffErrors[field]) {
      setNewStaffErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Derive the summary text shown before confirming
  function buildSummary(): string {
    if (!currentCard) return ''
    if (mode === 'unassign') {
      return `The NFC card (/${currentCard.nfc_slug}) will be unlinked from ${currentCard.full_name} and returned to inventory. ${currentCard.full_name}'s card will be deactivated.`
    }
    if (mode === 'existing') {
      const target = availableStaff.find(s => s.id === selectedStaffId)
      if (!target) return 'Select a staff member above.'
      return `The NFC card (/${currentCard.nfc_slug}) will be transferred from ${currentCard.full_name} to ${target.full_name} (${target.job_title}). ${currentCard.full_name}'s card will be deactivated.`
    }
    // mode === 'new'
    if (!newStaff.full_name.trim()) return 'Fill in the new staff member\'s details above.'
    return `A new card will be created for ${newStaff.full_name.trim()} (${newStaff.job_title.trim() || '—'}) and the NFC card (/${currentCard.nfc_slug}) will be assigned to them. ${currentCard.full_name}'s card will be deactivated.`
  }

  function isReadyToConfirm(): boolean {
    if (mode === 'unassign') return true
    if (mode === 'existing') return !!selectedStaffId
    // mode === 'new'
    return !!(newStaff.full_name.trim() && newStaff.job_title.trim())
  }

  async function handleConfirm() {
    if (!currentCard || submitting) return

    // Validate new staff form if applicable
    if (mode === 'new') {
      const errs = validateNewStaff(newStaff)
      if (Object.keys(errs).length > 0) {
        setNewStaffErrors(errs)
        return
      }
    }

    setSubmitting(true)
    setSubmitError(null)

    let input: ReassignNfcCardInput

    if (mode === 'existing') {
      input = { mode: 'existing', targetStaffCardId: selectedStaffId }
    } else if (mode === 'new') {
      input = {
        mode: 'new',
        newStaff: {
          full_name: newStaff.full_name.trim(),
          job_title: newStaff.job_title.trim(),
          email: newStaff.email.trim(),
        },
      }
    } else {
      input = { mode: 'unassign' }
    }

    const result = await reassignNfcCard(currentCard.id, input)

    if (result.error) {
      setSubmitError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitting(false)

    if (mode === 'unassign') {
      // Unassign — no card URL to show, go straight back to cards list
      router.push('/dashboard/cards')
      return
    }

    // Show the NFC URL so Luke can copy it for chip programming
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    setSuccessNfcUrl(`${appUrl}/c/${currentCard.nfc_slug}?src=nfc`)
    setSuccessCardId(result.newStaffCardId ?? null)
  }

  async function handleInitialAssign() {
    if (!currentCard || !selectedNfcId || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    const result = await assignNfcCard(currentCard.id, selectedNfcId)

    if (result.error) {
      setSubmitError(result.error)
      setSubmitting(false)
      return
    }

    setSubmitting(false)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    setSuccessNfcUrl(`${appUrl}/c/${result.slug}?src=nfc`)
    setSuccessCardId(currentCard.id)
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse mb-8" />
        <div className="glass-panel rounded-2xl border border-slate-200/50 p-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (loadError || !currentCard) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
          <span className="material-symbols-outlined text-[20px] leading-5 flex-shrink-0">error</span>
          {loadError ?? 'Failed to load card.'}
        </div>
        <Link
          href="/dashboard/cards"
          className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
          Back to Team Cards
        </Link>
      </div>
    )
  }

  // Success state — show NFC URL after a successful assignment
  if (successNfcUrl) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        {/* Success header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] leading-none text-teal-600">
              check_circle
            </span>
          </div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Card Assigned!</h1>
          <p className="text-sm text-slate-500 mt-1">
            The NFC card has been successfully assigned.
          </p>
        </div>

        {/* NFC URL panel */}
        <div className="glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
              NFC Chip URL
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Copy this URL and program it into the NFC chip. When someone taps the card, they&apos;ll be sent here.
            </p>
          </div>

          {/* URL display + copy */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <code className="flex-1 text-sm font-mono text-slate-800 break-all">
              {successNfcUrl}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(successNfcUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Tip */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-teal-50 border border-teal-100">
            <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0 text-teal-600 mt-0.5">
              info
            </span>
            <p className="text-xs text-teal-800">
              Use NFC Tools (Android) or NFC for iPhone to write this URL to the chip. Set the record type to <strong>URI</strong>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard/cards')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
            Back to Team Cards
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(successCardId ? `/dashboard/cards/${successCardId}` : '/dashboard/cards')
            }
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            View Card
            <span className="material-symbols-outlined text-[18px] leading-none">arrow_forward</span>
          </button>
        </div>
      </div>
    )
  }

  // ── INITIAL ASSIGNMENT (no NFC card assigned yet) ──────────────────────────
  if (!currentCard.nfc_card_id) {
    const selectedNfc = availableNfc.find(c => c.id === selectedNfcId)

    return (
      <div className="p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/dashboard/cards/${id}`}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Back to card"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-jakarta text-2xl font-bold text-slate-900">Assign NFC Card</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Pick a card from inventory to assign to{' '}
              <span className="font-semibold text-slate-700">{currentCard.full_name}</span>
            </p>
          </div>
        </div>

        {/* Inventory picker */}
        <div className="glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-3">
          <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
            Available NFC cards — {availableNfc.length} unassigned
          </p>

          {availableNfc.length === 0 ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
              <span className="material-symbols-outlined text-[20px] leading-5 flex-shrink-0">
                inventory_2
              </span>
              <div>
                <p className="font-semibold">No NFC cards in inventory</p>
                <p className="mt-0.5 text-amber-600">
                  Ask the super admin to generate a batch of NFC cards for your company first.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {availableNfc.map(nfc => (
                <button
                  key={nfc.id}
                  type="button"
                  onClick={() => setSelectedNfcId(nfc.id)}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                    selectedNfcId === nfc.id
                      ? 'border-teal-400 bg-teal-50/60 ring-2 ring-teal-500/20'
                      : 'border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-slate-50/60',
                  ].join(' ')}
                >
                  {/* Check / icon */}
                  <div
                    className={[
                      'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      selectedNfcId === nfc.id
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {selectedNfcId === nfc.id ? (
                      <span className="material-symbols-outlined text-[16px] leading-none">check</span>
                    ) : (
                      <span className="material-symbols-outlined text-[16px] leading-none">nfc</span>
                    )}
                  </div>

                  {/* Slug + status */}
                  <div className="min-w-0 flex-1">
                    <p className={[
                      'text-sm font-mono font-semibold',
                      selectedNfcId === nfc.id ? 'text-teal-800' : 'text-slate-800',
                    ].join(' ')}>
                      /c/{nfc.slug}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{nfc.order_status}</span>
                      {nfc.chip_uid && (
                        <span className="font-mono text-slate-400">· UID {nfc.chip_uid}</span>
                      )}
                      {nfc.notes && (
                        <span className="text-slate-400 truncate">· {nfc.notes}</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation summary */}
        <div className="mt-6 glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] leading-5 flex-shrink-0 text-slate-400 mt-0.5">
              summarize
            </span>
            <p className="text-sm text-slate-600">
              {selectedNfc
                ? `NFC card /c/${selectedNfc.slug} will be assigned to ${currentCard.full_name}. The URL /c/${selectedNfc.slug} will immediately show their card.`
                : 'Select an NFC card above to continue.'}
            </p>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0">error</span>
              {submitError}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Link
            href={`/dashboard/cards/${id}`}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={!selectedNfcId || submitting}
            onClick={handleInitialAssign}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none animate-spin">
                  progress_activity
                </span>
                Assigning…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none">add_link</span>
                Assign Card
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href={`/dashboard/cards/${id}`}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Back to card"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Reassign NFC Card</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Currently assigned to{' '}
            <span className="font-semibold text-slate-700">{currentCard.full_name}</span>
            {currentCard.nfc_slug && (
              <> &mdash; URL: <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded-md">/c/{currentCard.nfc_slug}</code></>
            )}
          </p>
        </div>
      </div>

      {/* Options panel */}
      <div className="glass-panel rounded-2xl border border-slate-200/50 p-8 space-y-3">
        <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">
          Choose what to do with the NFC card
        </p>

        <RadioOption
          value="existing"
          selected={mode === 'existing'}
          onSelect={setMode}
          icon="switch_account"
          title="Assign to an existing staff member"
          description="Select someone already in your team who doesn't have a card yet."
        />

        <RadioOption
          value="new"
          selected={mode === 'new'}
          onSelect={setMode}
          icon="person_add"
          title="Create a new staff member"
          description="Set up a new person and assign this card to them immediately."
        />

        <RadioOption
          value="unassign"
          selected={mode === 'unassign'}
          onSelect={setMode}
          icon="inventory_2"
          title="Unassign — return to inventory"
          description={`Remove the card from ${currentCard.full_name} without assigning it to anyone yet.`}
        />
      </div>

      {/* Mode-specific detail */}
      {mode === 'existing' && (
        <div className="mt-4 glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-700">
            Select staff member
            {availableStaff.length === 0 && (
              <span className="ml-2 text-slate-400 font-normal text-xs">
                — no staff without an NFC card found
              </span>
            )}
          </p>

          {availableStaff.length > 4 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 leading-none pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                placeholder="Search by name, title, or department…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white/70 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-shadow"
              />
            </div>
          )}

          {availableStaff.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
              <span className="material-symbols-outlined text-[18px] leading-none">info</span>
              All active staff members already have NFC cards assigned.
              Switch to &ldquo;Create a new staff member&rdquo; above.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No results for &ldquo;{staffSearch}&rdquo;</p>
              ) : (
                filteredStaff.map(staff => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={[
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150',
                      selectedStaffId === staff.id
                        ? 'border-teal-400 bg-teal-50/60 ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-slate-50/60',
                    ].join(' ')}
                  >
                    {/* Checkmark / avatar placeholder */}
                    <div
                      className={[
                        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                        selectedStaffId === staff.id
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      {selectedStaffId === staff.id ? (
                        <span className="material-symbols-outlined text-[16px] leading-none">check</span>
                      ) : (
                        staff.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{staff.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {staff.job_title}
                        {staff.department && ` · ${staff.department}`}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="mt-4 glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-5">
          <p className="text-sm font-semibold text-slate-700">New staff member details</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" required error={newStaffErrors.full_name}>
              <input
                type="text"
                value={newStaff.full_name}
                onChange={e => setNewStaffField('full_name', e.target.value)}
                placeholder="e.g. Priya Naidoo"
                autoComplete="name"
                className={inputClass(!!newStaffErrors.full_name)}
              />
            </Field>

            <Field label="Job Title" required error={newStaffErrors.job_title}>
              <input
                type="text"
                value={newStaff.job_title}
                onChange={e => setNewStaffField('job_title', e.target.value)}
                placeholder="e.g. Sales Manager"
                className={inputClass(!!newStaffErrors.job_title)}
              />
            </Field>
          </div>

          <Field
            label="Work Email"
            error={newStaffErrors.email}
          >
            <input
              type="email"
              value={newStaff.email}
              onChange={e => setNewStaffField('email', e.target.value)}
              placeholder="priya@company.co.za (optional)"
              autoComplete="email"
              className={inputClass(!!newStaffErrors.email)}
            />
          </Field>

          <p className="text-xs text-slate-400">
            You can add a photo, contact details, and social links after saving.
          </p>
        </div>
      )}

      {/* Confirmation summary + warning */}
      <div className="mt-6 glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-4">
        {/* Summary */}
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] leading-5 flex-shrink-0 text-slate-400 mt-0.5">
            summarize
          </span>
          <p className="text-sm text-slate-600">
            {buildSummary()}
          </p>
        </div>

        {/* Warning */}
        {isReadyToConfirm() && mode !== 'unassign' && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0 text-amber-600 mt-0.5">
              warning
            </span>
            <p className="text-sm text-amber-800 font-medium">
              The URL <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">/c/{currentCard.nfc_slug}</code> and its QR code will{' '}
              <strong>immediately</strong> show the new person&apos;s details after confirming.
            </p>
          </div>
        )}

        {/* Server error */}
        {submitError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0">error</span>
            {submitError}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <Link
          href={`/dashboard/cards/${id}`}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </Link>

        <button
          type="button"
          disabled={!isReadyToConfirm() || submitting}
          onClick={handleConfirm}
          className={[
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors shadow-sm',
            mode === 'unassign'
              ? 'bg-slate-600 hover:bg-slate-700 disabled:opacity-60'
              : 'bg-teal-600 hover:bg-teal-700 disabled:opacity-60',
            (!isReadyToConfirm() || submitting) ? 'cursor-not-allowed' : '',
          ].join(' ')}
        >
          {submitting ? (
            <>
              <span className="material-symbols-outlined text-[18px] leading-none animate-spin">
                progress_activity
              </span>
              Confirming…
            </>
          ) : mode === 'unassign' ? (
            <>
              <span className="material-symbols-outlined text-[18px] leading-none">inventory_2</span>
              Unassign Card
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px] leading-none">swap_horiz</span>
              Confirm Reassignment
            </>
          )}
        </button>
      </div>
    </div>
  )
}
