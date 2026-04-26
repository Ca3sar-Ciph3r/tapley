'use client'

// app/(dashboard)/dashboard/billing/add-cards/page.tsx
//
// Rendering:  Client component — needs live pricing calc + PayFast form submission.
// Auth:       Company Admin. Dashboard layout enforces this.
//
// Flow:
//   1. Page loads current card count + monthly rate via getCompanyBillingInfo()
//   2. Admin enters how many additional card slots they need
//   3. System shows live pricing breakdown:
//      - Setup fee (one-time): additionalCards × tier.setupFeeZar
//      - New monthly total:    newTotalCards × newTier.monthlyRateZar
//   4. Admin clicks Pay — createAdditionalCardsParams() builds signed PayFast form
//   5. PayFastForm auto-submits → admin pays on PayFast
//   6. ITN handler bumps max_staff_cards + updates subscription amount
//   7. PayFast redirects back to /dashboard/billing?added=N

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }        from '@/lib/supabase/client'
import { getImpersonationState } from '@/lib/actions/admin'
import {
  getCompanyBillingInfo,
  createAdditionalCardsParams,
} from '@/lib/actions/payfast-billing'
import { PayFastForm }   from '@/components/billing/PayFastForm'
import { formatZar, getTierForCardCount } from '@/lib/utils/pricing'
import type { PayFastFormData } from '@/lib/payfast/buildPaymentForm'

export default function AddCardsPage() {
  const router = useRouter()

  const [companyId,       setCompanyId]       = useState<string | null>(null)
  const [maxCards,        setMaxCards]         = useState(0)
  const [monthlyRate,     setMonthlyRate]      = useState(0)
  const [hasSubscription, setHasSubscription]  = useState(false)
  const [additional,      setAdditional]       = useState(1)
  const [loading,         setLoading]          = useState(true)
  const [paying,          setPaying]           = useState(false)
  const [formData,        setFormData]         = useState<PayFastFormData | null>(null)
  const [error,           setError]            = useState<string | null>(null)

  useEffect(() => {
    resolveCompanyId()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function resolveCompanyId() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: adminRow } = await (supabase as any)
      .from('company_admins')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    let id: string | null = adminRow?.company_id ?? null
    if (!id) {
      const impersonation = await getImpersonationState()
      id = impersonation?.companyId ?? null
    }

    if (!id) { setError('No company found.'); setLoading(false); return }
    setCompanyId(id)
    await loadBillingInfo(id)
  }

  async function loadBillingInfo(id: string) {
    setLoading(true)
    const { info, error: err } = await getCompanyBillingInfo(id)
    if (err || !info) { setError(err ?? 'Failed to load billing info.'); setLoading(false); return }
    setMaxCards(info.maxStaffCards)
    setMonthlyRate(info.monthlyRateZar)
    setHasSubscription(info.hasSubscription)
    setLoading(false)
  }

  // Live pricing calculation
  const isQrDigital = false  // QR Digital has no setup fee — guarded below
  const newTotal    = maxCards + additional

  let setupFeeZar   = 0
  let newMonthlyZar = 0
  let tierError     = ''

  try {
    const tier    = getTierForCardCount(newTotal, isQrDigital)
    setupFeeZar   = additional * tier.setupFeeZar
    newMonthlyZar = newTotal * tier.monthlyRateZar
  } catch {
    tierError = `Cannot add ${additional} cards — exceeds plan maximum.`
  }

  const monthlyIncrease = newMonthlyZar - (maxCards * monthlyRate)

  async function handlePay() {
    if (!companyId || tierError) return
    setPaying(true)
    setError(null)

    const result = await createAdditionalCardsParams({ companyId, additionalCards: additional })
    if (result.error || !result.formData) {
      setError(result.error ?? 'Failed to initiate payment. Please try again.')
      setPaying(false)
      return
    }
    setFormData(result.formData)
  }

  if (formData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="material-symbols-outlined text-[32px] text-teal-600 animate-spin">
          progress_activity
        </span>
        <p className="text-slate-500 text-sm">Redirecting to PayFast…</p>
        <PayFastForm formData={formData} />
      </div>
    )
  }

  return (
    <div className="px-10 py-10 max-w-xl">
      <div className="mb-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Billing
        </button>
        <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">Add card slots</h1>
        <p className="text-sm text-slate-500 mt-1">Pay a one-time setup fee per additional card. Your monthly subscription updates automatically.</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-16 text-slate-400">
          <span className="material-symbols-outlined text-[24px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!loading && error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && !hasSubscription && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
          No active PayFast subscription found. Please contact support to add card slots.
        </div>
      )}

      {!loading && !error && hasSubscription && (
        <>
          {/* Current plan */}
          <div className="glass-panel rounded-2xl p-5 mb-6 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Current plan</p>
              <p className="text-sm font-semibold text-slate-800">{maxCards} card slots</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Monthly</p>
              <p className="text-sm font-semibold text-slate-800">{formatZar(maxCards * monthlyRate)}</p>
            </div>
          </div>

          {/* Card count selector */}
          <div className="glass-panel rounded-2xl p-6 mb-6 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">How many additional slots?</p>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setAdditional(Math.max(1, additional - 1))}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                disabled={additional <= 1}
              >
                <span className="material-symbols-outlined text-[20px]">remove</span>
              </button>
              <span className="text-3xl font-bold font-jakarta text-slate-900 w-12 text-center">{additional}</span>
              <button
                onClick={() => setAdditional(additional + 1)}
                className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">add</span>
              </button>
              <span className="text-sm text-slate-500">card{additional !== 1 ? 's' : ''}</span>
            </div>

            {tierError && (
              <p className="text-xs text-red-600">{tierError}</p>
            )}
          </div>

          {/* Pricing breakdown */}
          {!tierError && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden mb-6">
              <div className="p-5 border-b border-slate-200 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pricing breakdown</p>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{additional} card slot{additional !== 1 ? 's' : ''} × setup fee</span>
                  <span className="font-semibold text-slate-800">{formatZar(setupFeeZar)}</span>
                </div>

                <div className="h-px bg-slate-200" />

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">New total: {newTotal} cards × monthly rate</span>
                  <span className="font-semibold text-slate-800">{formatZar(newMonthlyZar)}/mo</span>
                </div>

                <div className="flex items-center gap-2 py-2 px-3 bg-teal-50 rounded-xl">
                  <span className="material-symbols-outlined text-[16px] text-teal-600">info</span>
                  <p className="text-xs text-teal-700">
                    Monthly subscription increases by <strong>{formatZar(monthlyIncrease)}/mo</strong> from next billing date.
                  </p>
                </div>
              </div>

              <div className="p-5 flex justify-between items-center bg-white">
                <p className="font-bold text-slate-900">Due today</p>
                <p className="text-2xl font-bold text-slate-900">{formatZar(setupFeeZar)}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
            <span className="material-symbols-outlined text-[14px] text-teal-600">lock</span>
            Secured by PayFast · ZAR billing · POPIA compliant
          </div>

          <button
            onClick={handlePay}
            disabled={paying || !!tierError || setupFeeZar <= 0}
            className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Preparing payment…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock</span>
                Pay {formatZar(setupFeeZar)} to add {additional} card{additional !== 1 ? 's' : ''} →
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}
