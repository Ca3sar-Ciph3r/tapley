'use client'

// app/(onboard)/onboard/page.tsx
//
// Rendering:  Client component — multi-step wizard state.
// Auth:       Publicly accessible — no auth guard.
//
// Step flow:
//   1. Plan      — pick tier + card count
//   2. Company   — name, industry, website, tagline
//   3. Account   — signUp + createPendingCompany()
//   4. Branding  — logo, colours, card template
//   5. Payment   — PayFast setup fee redirect

import { useState } from 'react'
import { WizardProgress } from './_components/WizardProgress'
import { StepPlan }       from './_components/StepPlan'
import { StepCompany }    from './_components/StepCompany'
import { StepAccount }    from './_components/StepAccount'
import { StepBranding }   from './_components/StepBranding'
import { StepPayment }    from './_components/StepPayment'
import type { WizardState, WizardStep, WizardPlan, WizardCompany, WizardAccount, WizardBrand } from './_types'

const INITIAL_STATE: WizardState = {
  plan:      null,
  company:   null,
  account:   null,
  brand:     null,
  companyId: null,
}

export default function OnboardPage() {
  const [step,  setStep]  = useState<WizardStep>('plan')
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  function handlePlanNext(plan: WizardPlan) {
    setState(s => ({ ...s, plan }))
    setStep('company')
  }

  function handleCompanyNext(company: WizardCompany) {
    setState(s => ({ ...s, company }))
    setStep('account')
  }

  function handleAccountNext(account: WizardAccount, companyId: string) {
    setState(s => ({ ...s, account, companyId }))
    setStep('branding')
  }

  function handleBrandingNext(brand: WizardBrand) {
    setState(s => ({ ...s, brand }))
    setStep('payment')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">TC</span>
          </div>
          <span className="font-jakarta font-bold text-slate-900 text-sm">Tapley Connect</span>
        </div>
        <a
          href="mailto:hello@tapleyconnect.co.za"
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          Need help? Get in touch
        </a>
      </header>

      {/* Wizard content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-2xl">
          <WizardProgress currentStep={step} />

          <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
            {step === 'plan' && (
              <StepPlan
                initial={state.plan}
                onNext={handlePlanNext}
              />
            )}

            {step === 'company' && (
              <StepCompany
                initial={state.company}
                onNext={handleCompanyNext}
                onBack={() => setStep('plan')}
              />
            )}

            {step === 'account' && state.plan && state.company && (
              <StepAccount
                initial={state.account}
                plan={state.plan}
                company={state.company}
                onNext={handleAccountNext}
                onBack={() => setStep('company')}
              />
            )}

            {step === 'branding' && state.plan && state.company && state.account && state.companyId && (
              <StepBranding
                initial={state.brand}
                companyId={state.companyId}
                plan={state.plan}
                company={state.company}
                account={state.account}
                onNext={handleBrandingNext}
                onBack={() => setStep('account')}
              />
            )}

            {step === 'payment' && state.plan && state.company && state.account && state.brand && state.companyId && (
              <StepPayment
                plan={state.plan}
                company={state.company}
                account={state.account}
                brand={state.brand}
                companyId={state.companyId}
                onBack={() => setStep('branding')}
              />
            )}
          </div>

          {/* Trust footer */}
          <p className="text-center text-xs text-slate-400 mt-6">
            Your data is stored securely in South Africa and protected under POPIA.
            Payments processed by PayFast — we never store your card details.
          </p>
        </div>
      </main>
    </div>
  )
}
