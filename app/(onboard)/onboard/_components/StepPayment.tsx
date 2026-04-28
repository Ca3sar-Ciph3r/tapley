'use client'

// app/(onboard)/onboard/_components/StepPayment.tsx
//
// Step 5: Order summary + redirect to PayFast for the one-time setup fee.
//
// Flow:
//   1. User reviews order summary and clicks "Pay securely with PayFast"
//   2. createPayFastSetupFeeParams() server action builds signed form params
//   3. PayFastForm renders a hidden form and auto-submits → browser navigates to PayFast
//   4. On success PayFast redirects to /onboard/success; on cancel to /onboard/cancelled
//   5. PayFast sends ITN to /api/webhooks/payfast which activates the company

import { useState } from 'react'
import { formatZar } from '@/lib/utils/pricing'
import { createPayFastSetupFeeParams } from '@/lib/actions/self-service-onboarding'
import { PayFastForm } from '@/components/billing/PayFastForm'
import type { PayFastFormData } from '@/lib/payfast/buildPaymentForm'
import type { WizardAccount, WizardBrand, WizardCompany, WizardPlan } from '../_types'

interface StepPaymentProps {
  plan:      WizardPlan
  company:   WizardCompany
  account:   WizardAccount
  brand:     WizardBrand
  companyId: string
  onBack:    () => void
}

export function StepPayment({ plan, company, account, brand: _brand, companyId, onBack }: StepPaymentProps) {
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [formData, setFormData]       = useState<PayFastFormData | null>(null)

  async function handleCheckout() {
    setRedirecting(true)
    setError(null)

    const result = await createPayFastSetupFeeParams({
      companyId,
      planName:       plan.tierName,
      adminFirstName: account.firstName,
      adminLastName:  account.lastName,
      adminEmail:     account.email,
      cardCount:      plan.cardCount,
      setupFeeZar:    plan.setupTotalZar,
      monthlyFeeZar:  plan.monthlyTotalZar,
      billingCycle:   plan.billingCycle,
    })

    if (result.error || !result.formData) {
      setError(result.error ?? 'Failed to initiate payment. Please try again.')
      setRedirecting(false)
      return
    }

    // Set form data — PayFastForm auto-submits on mount, navigating to PayFast
    setFormData(result.formData)
  }

  const isAnnual = plan.billingCycle === 'annual'
  const annualTotalZar = plan.annualDiscountedTotalZar
  const savingsZar = plan.monthlyTotalZar * 2
  const annualMonthlyEquiv = Math.round(annualTotalZar / 12)
  // For annual: setup fee + first year is charged today as one payment
  const dueToday = isAnnual
    ? plan.setupTotalZar + annualTotalZar
    : plan.setupTotalZar

  // Once form data is set, show a brief redirect message while the form submits
  if (formData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <span className="material-symbols-outlined text-[32px] text-teal-600 animate-spin">
          progress_activity
        </span>
        <p className="text-slate-500 text-sm">Redirecting to PayFast…</p>
        <PayFastForm formData={formData} />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold font-jakarta text-slate-900 mb-1">Review & pay</h2>
      <p className="text-slate-500 text-sm mb-8">
        {isAnnual
          ? 'Your setup fee and first year are charged today. Annual billing renews 12 months from now.'
          : 'Pay your setup fee today. Monthly billing starts after your first month.'}
      </p>

      {/* Order summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden mb-6">
        <div className="p-5 border-b border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Order summary</p>

          <div className="space-y-2.5">
            {/* Plan header */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {plan.tierName} Plan — {plan.cardCount} cards
                </p>
                <p className="text-xs text-slate-500">{company.name}</p>
              </div>
            </div>

            {/* Subscription line */}
            <div className="flex justify-between items-baseline pt-1">
              <div>
                <p className="text-sm text-slate-700">
                  {isAnnual
                    ? `Annual subscription (${formatZar(annualMonthlyEquiv)}/mo equiv.)`
                    : 'Monthly subscription'}
                </p>
                {isAnnual && (
                  <p className="text-xs text-slate-400">10 months billed · 2 months free</p>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 ml-4">
                {isAnnual ? `${formatZar(annualTotalZar)}/yr` : `${formatZar(plan.monthlyTotalZar)}/mo`}
              </p>
            </div>

            {/* Setup fee line */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-700">Setup fee (once-off)</p>
              <p className="text-sm font-semibold text-slate-800">{formatZar(plan.setupTotalZar)}</p>
            </div>

            {/* Savings badge — annual only */}
            {isAnnual && (
              <div className="flex items-center gap-2 py-2 px-3 bg-teal-50 rounded-xl">
                <span className="material-symbols-outlined text-[16px] text-teal-600">savings</span>
                <p className="text-xs text-teal-700">
                  You save <strong>{formatZar(savingsZar)}</strong> vs monthly billing
                </p>
              </div>
            )}

            {/* Monthly reminder — monthly only */}
            {!isAnnual && (
              <div className="flex items-center gap-2 py-2 px-3 bg-teal-50 rounded-xl">
                <span className="material-symbols-outlined text-[16px] text-teal-600">info</span>
                <p className="text-xs text-teal-700">
                  Monthly billing of <strong>{formatZar(plan.monthlyTotalZar)}/mo</strong> starts next month.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Due today footer */}
        <div className="p-5 bg-white space-y-1">
          <div className="flex justify-between items-center">
            <p className="font-bold text-slate-900">
              {isAnnual ? 'First charge today' : 'Due today'}
            </p>
            <p className="text-2xl font-bold text-slate-900">{formatZar(dueToday)}</p>
          </div>
          {isAnnual && (
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">Then annually</p>
              <p className="text-xs font-semibold text-slate-600">{formatZar(annualTotalZar)}/year</p>
            </div>
          )}
        </div>
      </div>

      {/* Account summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Account</p>
          <p className="text-sm font-semibold text-slate-800">{account.firstName} {account.lastName}</p>
          <p className="text-xs text-slate-500">{account.email}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Plan</p>
          <p className="text-sm font-semibold text-slate-800">{plan.tierName}</p>
          <p className="text-xs text-slate-500">{plan.cardCount} cards · {plan.billingCycle}</p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[14px] text-teal-600">lock</span>
          Secured by PayFast
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[14px] text-teal-600">verified_user</span>
          POPIA compliant
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[14px] text-teal-600">credit_card</span>
          ZAR billing
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={redirecting}
          className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          ← Back
        </button>
        <button type="button" onClick={handleCheckout} disabled={redirecting}
          className="flex-1 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
          {redirecting ? (
            <>
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              Preparing payment…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Pay {formatZar(dueToday)} securely →
            </>
          )}
        </button>
      </div>
    </div>
  )
}
