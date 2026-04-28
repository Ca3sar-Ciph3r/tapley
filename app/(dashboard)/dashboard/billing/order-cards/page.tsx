'use client'

// app/(dashboard)/dashboard/billing/order-cards/page.tsx
//
// Rendering:  Client component — live pricing calc + form state.
// Auth:       Company Admin. Dashboard layout enforces this.
//
// Flow:
//   1. Page loads company subscription plan + contact details for pre-fill
//   2. Admin fills in quantity, delivery address, contact, notes
//   3. Admin clicks "Request cards" → requestAdditionalCards() server action
//   4. Order row inserted into card_orders; Luke receives email notification
//   5. Confirmation message shown — Luke contacts admin within 1 business day
//
// Pricing shown is informational only. No payment is taken here.
// Luke confirms details and arranges payment separately before shipping.

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getImpersonationState } from '@/lib/actions/admin'
import { requestAdditionalCards } from '@/lib/actions/cards'

// ---------------------------------------------------------------------------
// Pricing constants
// ---------------------------------------------------------------------------

const PRICE_BY_PLAN: Record<string, number> = {
  enterprise: 120,
}
const DEFAULT_PRICE_ZAR = 150

function priceForPlan(plan: string): number {
  return PRICE_BY_PLAN[plan.toLowerCase()] ?? DEFAULT_PRICE_ZAR
}

function formatZar(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OrderCardsPage() {
  const router = useRouter()

  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]       = useState(false)
  const [pageError, setPageError]   = useState<string | null>(null)
  const [formError, setFormError]   = useState<string | null>(null)

  // Company context
  const [plan, setPlan] = useState('starter')

  // Form state
  const [quantity,     setQuantity]     = useState(1)
  const [address,      setAddress]      = useState('')
  const [contactName,  setContactName]  = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes,        setNotes]        = useState('')

  const pricePerCard  = priceForPlan(plan)
  const runningTotal  = quantity * pricePerCard

  useEffect(() => {
    loadCompanyInfo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadCompanyInfo() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Resolve company ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any
    const { data: adminRows } = await supabaseAny
      .from('company_admins')
      .select('company_id')
      .eq('user_id', user.id)

    const rows = (adminRows ?? []) as { company_id: string | null }[]
    let companyId = rows.find(r => r.company_id !== null)?.company_id ?? null

    if (!companyId) {
      const impersonation = await getImpersonationState()
      companyId = impersonation?.companyId ?? null
    }

    if (!companyId) {
      setPageError('No company found for this account.')
      setLoading(false)
      return
    }

    const { data: company } = await supabaseAny
      .from('companies')
      .select('subscription_plan, primary_contact_name, primary_contact_phone, nfc_delivery_address')
      .eq('id', companyId)
      .single()

    if (company) {
      setPlan(company.subscription_plan ?? 'starter')
      setAddress(company.nfc_delivery_address ?? '')
      setContactName(company.primary_contact_name ?? '')
      setContactPhone(company.primary_contact_phone ?? '')
    }

    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    const { error } = await requestAdditionalCards({
      quantity,
      deliveryAddress: address,
      contactName,
      contactPhone,
      notes: notes.trim() || null,
    })

    if (error) {
      setFormError(error)
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  // ---------------------------------------------------------------------------
  // Success state
  // ---------------------------------------------------------------------------

  if (success) {
    return (
      <div className="px-10 py-10 max-w-xl">
        <div className="glass-panel rounded-2xl p-10 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px] text-teal-600 leading-none">check_circle</span>
          </div>
          <h2 className="font-jakarta text-xl font-extrabold text-slate-900">Order received!</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Luke will contact you within <strong>1 business day</strong> to confirm shipping details and arrange payment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => router.push('/dashboard/billing')}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
            >
              Back to Billing
            </button>
            <button
              onClick={() => {
                setSuccess(false)
                setQuantity(1)
                setNotes('')
                setFormError(null)
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors"
            >
              Place another order
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main form
  // ---------------------------------------------------------------------------

  const inputCls  = 'w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-colors'
  const labelCls  = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5'

  return (
    <div className="px-10 py-10 max-w-xl">
      {/* Back + header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Billing
        </button>
        <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
          Order NFC cards
        </h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          Request physical NFC cards for your team. Luke will contact you within 1 business day to confirm shipping and payment.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-16 text-slate-400">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!loading && pageError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{pageError}</div>
      )}

      {!loading && !pageError && (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Quantity + pricing */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className={labelCls}>How many additional NFC cards?</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">remove</span>
                </button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={quantity}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    if (!isNaN(v)) setQuantity(Math.min(100, Math.max(1, v)))
                  }}
                  className="w-20 text-center text-2xl font-bold font-jakarta text-slate-900 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(100, q + 1))}
                  disabled={quantity >= 100}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
                <span className="text-sm text-slate-500">card{quantity !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Running total */}
            <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-sm text-slate-600">
                {quantity} card{quantity !== 1 ? 's' : ''} × {formatZar(pricePerCard)}
              </span>
              <span className="text-base font-bold text-slate-900">{formatZar(runningTotal)}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Once-off setup fee · pricing may vary · Luke will confirm the final amount before invoicing.
            </p>
          </div>

          {/* Delivery address */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className={labelCls}>Delivery address</label>
              <textarea
                rows={3}
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Street address, city, postal code"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Contact name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contact phone</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  placeholder="+27 82 123 4567"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Special notes */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm">
            <label className={labelCls}>Special notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
            <textarea
              rows={2}
              maxLength={200}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions or comments…"
              className={`${inputCls} resize-none`}
            />
            <p className="text-[11px] text-slate-400 mt-1 text-right">{notes.length}/200</p>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{formError}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Sending request…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                Request {quantity} card{quantity !== 1 ? 's' : ''} →
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
