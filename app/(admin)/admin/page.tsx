'use client'

// app/(admin)/admin/page.tsx
//
// Rendering:  Client component — live data, create company form, search.
// Auth:       Super Admin ONLY. AdminLayout (server) enforces this.
//
// Supabase:   Browser client — the super_admin_all RLS policy grants access
//             to all companies, staff_cards, and card_views for this user.
//             supabaseAdmin (service role) is NOT used here.
//
// Shows:
//   - Platform stats: total companies, total active staff cards, total views (all time)
//   - Company table: name | plan | status | staff count | 30d views | joined | actions
//   - Inline "Create Company" form (shown/hidden with toggle)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createCompany } from '@/lib/actions/admin'
import {
  PRICING_TIERS,
  calculateBilling,
  formatZar,
  getTierForCardCount,
  type BillingCycle,
} from '@/lib/utils/pricing'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyRow = {
  id: string
  name: string
  slug: string
  subscription_plan: string
  subscription_status: string
  max_staff_cards: number
  created_at: string
  staffCount: number
  views30d: number
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  value: string
}

function StatCard({ icon, iconBg, iconColor, label, value }: StatCardProps) {
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
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold font-jakarta text-slate-900">{value}</p>
    </div>
  )
}

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
    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 uppercase tracking-wide">
      {PLAN_LABELS[plan] ?? plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Create Company Form — full onboarding
// ---------------------------------------------------------------------------

interface CreateCompanyFormProps {
  onCreated: (companyId: string) => void
  onCancel: () => void
}

type CardTemplate = 'minimal' | 'bold' | 'split'

const CARD_TEMPLATES: { value: CardTemplate; label: string; description: string }[] = [
  { value: 'minimal', label: 'Minimal', description: 'Clean, text-forward layout' },
  { value: 'bold', label: 'Bold', description: 'Large photo, high-impact colours' },
  { value: 'split', label: 'Split', description: 'Two-tone split background' },
]

function FormSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <span className="material-symbols-outlined text-[18px] text-teal-600">{icon}</span>
        <h3 className="font-jakarta text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
        {hint && <span className="text-slate-400 font-normal normal-case ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white'

function CreateCompanyForm({ onCreated, onCancel }: CreateCompanyFormProps) {
  // Company details
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [tagline, setTagline] = useState('')
  // Brand
  const [primaryColor, setPrimaryColor] = useState('#16181D')
  const [secondaryColor, setSecondaryColor] = useState('#2DD4BF')
  const [darkMode, setDarkMode] = useState(true)
  const [cardTemplate, setCardTemplate] = useState<CardTemplate>('minimal')
  // Primary contact
  const [contactName, setContactName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  // Pricing
  const [isQrDigital, setIsQrDigital] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [cardCount, setCardCount] = useState('')
  const [contractStart, setContractStart] = useState(new Date().toISOString().split('T')[0])
  const [contractEnd, setContractEnd] = useState('')
  const [nextBilling, setNextBilling] = useState('')
  // NFC order
  const [nfcCount, setNfcCount] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  // Referral
  const [referredByCode, setReferredByCode] = useState('')
  // Internal notes
  const [notes, setNotes] = useState('')
  // State
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ── Client-side validation ──────────────────────────────────────────────
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Company name is required.'); return }

    const parsedCardCount = cardCount ? parseInt(cardCount, 10) : 0
    if (parsedCardCount < 1) { setError('Number of cards must be at least 1.'); return }
    if (isQrDigital && parsedCardCount > 15) {
      setError('QR Digital tier supports a maximum of 15 cards. Reduce the card count or switch to an NFC tier.')
      return
    }

    const trimmedEmail = adminEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Admin email address is not valid.')
      return
    }

    const trimmedWebsite = website.trim()
    if (trimmedWebsite && !/^https?:\/\/.+/.test(trimmedWebsite)) {
      setError('Website must start with http:// or https://')
      return
    }

    const trimmedPhone = contactPhone.trim()
    if (trimmedPhone && !/^\+\d{7,15}$/.test(trimmedPhone)) {
      setError('Phone number must be in E.164 format, e.g. +27821234567')
      return
    }

    const trimmedWa = contactWhatsapp.trim()
    if (trimmedWa && !/^\+\d{7,15}$/.test(trimmedWa)) {
      setError('WhatsApp number must be in E.164 format, e.g. +27821234567')
      return
    }

    if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      setError('Primary colour must be a valid hex code, e.g. #16181D')
      return
    }
    if (secondaryColor && !/^#[0-9a-fA-F]{6}$/.test(secondaryColor)) {
      setError('Secondary colour must be a valid hex code, e.g. #2DD4BF')
      return
    }
    // ───────────────────────────────────────────────────────────────────────

    setSubmitting(true)
    setError(null)

    const result = await createCompany({
      name: trimmedName,
      website: trimmedWebsite || undefined,
      tagline: tagline.trim() || undefined,
      brandPrimaryColor: primaryColor,
      brandSecondaryColor: secondaryColor,
      brandDarkMode: darkMode,
      cardTemplate,
      primaryContactName: contactName.trim() || undefined,
      adminEmail: trimmedEmail || undefined,
      primaryContactPhone: trimmedPhone || undefined,
      primaryContactWhatsapp: trimmedWa || undefined,
      pricingV2Enabled: true,
      isQrDigital,
      billingCycle,
      maxStaffCards: parsedCardCount || undefined,
      contractStartDate: contractStart || undefined,
      contractEndDate: contractEnd || undefined,
      nextBillingDate: nextBilling || undefined,
      nfcCardsOrdered: nfcCount ? parseInt(nfcCount, 10) : 0,
      nfcDeliveryAddress: deliveryAddress.trim() || undefined,
      referredByCode: referredByCode.trim() || undefined,
      internalNotes: notes.trim() || undefined,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    if (result.companyId) onCreated(result.companyId)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-jakarta text-xl font-bold text-slate-900">New Client Onboarding</h2>
          <p className="text-sm text-slate-500 mt-0.5">Complete all sections to set up the client and send their invite.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-[18px] leading-none flex-shrink-0">error</span>
          {error}
        </div>
      )}

      {/* ── Section 1: Company Details ── */}
      <FormSection title="Company Details" icon="business">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Company Name" required>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Karam Africa" className={inputCls} required />
          </Field>
          <Field label="Website URL">
            <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="https://karamafrica.co.za" className={inputCls} />
          </Field>
          <Field label="Tagline" hint="shown on card pages">
            <input type="text" value={tagline} onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Your trusted PPE partner" className={inputCls} />
          </Field>
        </div>
      </FormSection>

      {/* ── Section 2: Brand Identity ── */}
      <FormSection title="Brand Identity" icon="palette">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Primary Brand Colour">
            <div className="flex gap-2">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
              <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                placeholder="#16181D" className={`${inputCls} font-mono`} maxLength={7} />
            </div>
          </Field>
          <Field label="Secondary Brand Colour">
            <div className="flex gap-2">
              <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
              <input type="text" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                placeholder="#2DD4BF" className={`${inputCls} font-mono`} maxLength={7} />
            </div>
          </Field>
        </div>

        {/* Dark / Light mode */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Card Theme</span>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            {([true, false] as const).map(isDark => (
              <button key={String(isDark)} type="button"
                onClick={() => setDarkMode(isDark)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${darkMode === isDark ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {isDark ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>

        {/* Card template */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Card Template</span>
          <div className="grid grid-cols-3 gap-3">
            {CARD_TEMPLATES.map(t => (
              <button key={t.value} type="button" onClick={() => setCardTemplate(t.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${cardTemplate === t.value ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <p className={`text-sm font-bold ${cardTemplate === t.value ? 'text-teal-700' : 'text-slate-800'}`}>{t.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      </FormSection>

      {/* ── Section 3: Primary Contact ── */}
      <FormSection title="Primary Contact" icon="person">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Contact Name">
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
              placeholder="e.g. Jamie Lee" className={inputCls} />
          </Field>
          <Field label="Admin Email" hint="invite sent on create">
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
              placeholder="jamie@karamafrica.co.za" className={inputCls} />
          </Field>
          <Field label="Phone Number">
            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
              placeholder="0821234567" className={inputCls} />
          </Field>
          <Field label="WhatsApp Number" hint="if different from phone">
            <input type="tel" value={contactWhatsapp} onChange={e => setContactWhatsapp(e.target.value)}
              placeholder="0821234567" className={inputCls} />
          </Field>
        </div>
      </FormSection>

      {/* ── Section 4: Pricing & Billing ── */}
      <FormSection title="Pricing & Billing" icon="payments">

        {/* QR Digital toggle */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white">
          <input
            type="checkbox"
            id="qrDigital"
            checked={isQrDigital}
            onChange={e => setIsQrDigital(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          <label htmlFor="qrDigital" className="flex-1">
            <span className="text-sm font-semibold text-slate-800">QR Digital only</span>
            <span className="block text-xs text-slate-500 mt-0.5">No physical NFC cards — digital-only tier (max 15 cards, R49/mo flat rate)</span>
          </label>
        </div>

        {/* Billing cycle */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Billing Cycle</span>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
            {(['monthly', 'annual'] as const).map(cycle => (
              <button key={cycle} type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`px-5 py-2 text-sm font-semibold transition-colors ${billingCycle === cycle ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                {cycle === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}
              </button>
            ))}
          </div>
        </div>

        {/* Tier cards — show only tiers matching isQrDigital */}
        <div>
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Pricing Tier</span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PRICING_TIERS.filter(t => t.isQrDigital === isQrDigital).map(t => {
              const count = parseInt(cardCount || '0', 10)
              const autoTier = count > 0 ? getTierForCardCount(count, isQrDigital) : null
              const isAuto = autoTier?.name === t.name
              return (
                <div key={t.name}
                  className={`rounded-xl border-2 p-4 transition-all ${isAuto ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white'}`}>
                  <p className={`text-sm font-bold ${isAuto ? 'text-teal-700' : 'text-slate-800'}`}>{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t.minCards}{t.maxCards ? `–${t.maxCards}` : '+'} cards</p>
                  <p className="text-sm font-bold text-slate-900 mt-2">{formatZar(t.monthlyRateZar)}<span className="text-xs font-normal text-slate-500">/mo</span></p>
                  {t.setupFeeZar > 0 && <p className="text-xs text-slate-400">Setup: {formatZar(t.setupFeeZar)}</p>}
                  {isAuto && <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">Auto-selected</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Number of Cards"
            hint={isQrDigital ? 'max 15 for QR Digital' : 'sets tier automatically'}
          >
            <input
              type="number"
              value={cardCount}
              onChange={e => setCardCount(e.target.value)}
              placeholder="e.g. 12"
              min="1"
              max={isQrDigital ? 15 : undefined}
              className={`${inputCls} ${isQrDigital && parseInt(cardCount || '0', 10) > 15 ? 'border-red-400 ring-2 ring-red-200' : ''}`}
            />
            {isQrDigital && parseInt(cardCount || '0', 10) > 15 && (
              <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] leading-none">error</span>
                QR Digital supports max 15 cards
              </p>
            )}
          </Field>
          <Field label="Contract Start">
            <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Contract End">
            <input type="date" value={contractEnd} onChange={e => setContractEnd(e.target.value)} className={inputCls} />
          </Field>
          <Field label="First Billing Date">
            <input type="date" value={nextBilling} onChange={e => setNextBilling(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Live billing estimate */}
        {cardCount && parseInt(cardCount, 10) > 0 && (() => {
          const count = parseInt(cardCount, 10)
          try {
            const est = calculateBilling(count, isQrDigital, billingCycle)
            return (
              <div className="rounded-2xl bg-slate-900 text-white p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tier</p>
                  <p className="text-lg font-bold">{est.tier.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Monthly rate</p>
                  <p className="text-lg font-bold">{formatZar(est.tier.monthlyRateZar)}/mo</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Monthly total</p>
                  <p className="text-lg font-bold text-teal-400">{formatZar(est.monthlyTotalZar)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Setup fee</p>
                  <p className="text-lg font-bold text-amber-400">{formatZar(est.setupTotalZar)}</p>
                </div>
                {billingCycle === 'annual' && (
                  <div className="md:col-span-4 pt-2 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      Annual total:{' '}
                      <span className="text-white font-semibold">{formatZar(est.annualDiscountedTotalZar)}</span>
                      {' '}&nbsp;·&nbsp; 10 months charged (2 months free)
                    </p>
                  </div>
                )}
              </div>
            )
          } catch {
            return (
              <p className="text-xs text-red-500">
                {isQrDigital ? 'QR Digital supports up to 15 cards.' : 'Enter a valid card count.'}
              </p>
            )
          }
        })()}
      </FormSection>

      {/* ── Section 5: NFC Card Order (hidden for QR Digital) ── */}
      {!isQrDigital && (
        <FormSection title="NFC Card Order" icon="contactless">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cards Ordered">
              <input type="number" value={nfcCount} onChange={e => setNfcCount(e.target.value)}
                placeholder="e.g. 12" min="0" className={inputCls} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Delivery Address">
                <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Street address, City, Province, Postal code"
                  rows={2} className={`${inputCls} resize-none`} />
              </Field>
            </div>
          </div>
        </FormSection>
      )}

      {/* ── Section 6: Referral ── */}
      <FormSection title="Referral" icon="share">
        <Field label="Referred by Code" hint="leave blank if not referred">
          <input type="text" value={referredByCode} onChange={e => setReferredByCode(e.target.value.toUpperCase())}
            placeholder="e.g. KARAM2026" className={`${inputCls} font-mono uppercase`} maxLength={12} />
        </Field>
      </FormSection>

      {/* ── Section 7: Internal Notes ── */}
      <FormSection title="Internal Notes" icon="sticky_note_2">
        <Field label="Notes" hint="only visible to super admin">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Client onboarded via referral from X. Wants cards by end of April. Contract signed 2026-04-07."
            rows={3} className={`${inputCls} resize-none`} />
        </Field>
      </FormSection>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <button type="submit" disabled={submitting}
          className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {submitting && <span className="material-symbols-outlined text-[16px] leading-none animate-spin">progress_activity</span>}
          {submitting ? 'Creating…' : 'Create Company & Send Invite'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors">
          Cancel
        </button>
      </div>

    </form>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SuperAdminPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [totalCards, setTotalCards] = useState(0)
  const [totalViews, setTotalViews] = useState(0)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [companiesResult, cardsResult, viewsResult, views30dResult] = await Promise.all([
      supabase
        .from('companies')
        .select('id, name, slug, subscription_plan, subscription_status, max_staff_cards, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('staff_cards')
        .select('id, company_id')
        .eq('is_active', true),
      supabase
        .from('card_views')
        .select('id, staff_card_id', { count: 'exact', head: true }),
      supabase
        .from('card_views')
        .select('staff_card_id')
        .gte('viewed_at', thirtyDaysAgo),
    ])

    if (companiesResult.error) {
      setLoadError('Failed to load companies. Please refresh.')
      setLoading(false)
      return
    }

    const rawCompanies = companiesResult.data ?? []
    const rawCards = cardsResult.data ?? []
    const rawViews30d = views30dResult.data ?? []

    // Build lookup maps
    const cardCountByCompany = new Map<string, number>()
    for (const c of rawCards) {
      cardCountByCompany.set(c.company_id, (cardCountByCompany.get(c.company_id) ?? 0) + 1)
    }

    // Map views to company via staff_card lookup
    const staffCardToCompany = new Map<string, string>()
    for (const c of rawCards) {
      staffCardToCompany.set(c.id, c.company_id)
    }

    const viewCountByCompany = new Map<string, number>()
    for (const v of rawViews30d) {
      if (v.staff_card_id) {
        const companyId = staffCardToCompany.get(v.staff_card_id)
        if (companyId) {
          viewCountByCompany.set(companyId, (viewCountByCompany.get(companyId) ?? 0) + 1)
        }
      }
    }

    const rows: CompanyRow[] = rawCompanies.map(c => ({
      ...c,
      staffCount: cardCountByCompany.get(c.id) ?? 0,
      views30d: viewCountByCompany.get(c.id) ?? 0,
    }))

    setCompanies(rows)
    setTotalCards(rawCards.length)
    setTotalViews(viewsResult.count ?? 0)
    setLoading(false)
  }

  function handleCompanyCreated(companyId: string) {
    setShowCreate(false)
    loadData()
    // Navigate to company detail
    window.location.href = `/admin/${companyId}`
  }

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 min-h-screen text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">
          progress_activity
        </span>
        <span className="text-sm">Loading platform data…</span>
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">All Companies</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform overview — all clients</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">
            {showCreate ? 'close' : 'add'}
          </span>
          {showCreate ? 'Cancel' : 'New Company'}
        </button>
      </div>

      {/* Create Company Form */}
      {showCreate && (
        <CreateCompanyForm
          onCreated={handleCompanyCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon="business"
          iconBg="rgba(0,201,167,0.1)"
          iconColor="#00C9A7"
          label="Total Companies"
          value={companies.length.toLocaleString()}
        />
        <StatCard
          icon="badge"
          iconBg="rgba(99,102,241,0.1)"
          iconColor="#6366f1"
          label="Active Staff Cards"
          value={totalCards.toLocaleString()}
        />
        <StatCard
          icon="ads_click"
          iconBg="rgba(245,158,11,0.1)"
          iconColor="#f59e0b"
          label="Total Card Views"
          value={totalViews.toLocaleString()}
        />
      </div>

      {/* Search + Company Table */}
      <div className="glass-panel rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          <h2 className="font-jakarta text-base font-bold text-slate-900">
            Companies
            <span className="ml-2 text-sm font-normal text-slate-400">
              {filtered.length} of {companies.length}
            </span>
          </h2>
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] leading-none text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search companies…"
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white w-56"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            {search ? 'No companies match your search.' : 'No companies yet.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-8 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Staff
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Views (30d)
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Joined
                </th>
                <th className="px-8 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(company => (
                <CompanyTableRow key={company.id} company={company} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompanyTableRow
// ---------------------------------------------------------------------------

function CompanyTableRow({ company }: { company: CompanyRow }) {
  const joined = new Date(company.created_at).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
      {/* Company name + slug */}
      <td className="px-8 py-4">
        <p className="text-sm font-semibold text-slate-900">{company.name}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{company.slug}</p>
      </td>

      {/* Plan */}
      <td className="px-4 py-4">
        <PlanBadge plan={company.subscription_plan} />
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <StatusBadge status={company.subscription_status} />
      </td>

      {/* Staff count */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm font-semibold text-slate-900 tabular-nums">
          {company.staffCount}
        </span>
        <span className="text-[11px] text-slate-400">
          /{company.max_staff_cards}
        </span>
      </td>

      {/* 30d views */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm font-semibold text-slate-900 tabular-nums">
          {company.views30d.toLocaleString()}
        </span>
      </td>

      {/* Joined date */}
      <td className="px-4 py-4">
        <span className="text-sm text-slate-500 tabular-nums">{joined}</span>
      </td>

      {/* Actions */}
      <td className="px-8 py-4 text-right">
        <Link
          href={`/admin/${company.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
        >
          View
          <span className="material-symbols-outlined text-[14px] leading-none">
            arrow_forward
          </span>
        </Link>
      </td>
    </tr>
  )
}
