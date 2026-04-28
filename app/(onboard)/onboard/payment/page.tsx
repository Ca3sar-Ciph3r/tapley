'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState } from '@/lib/hooks/use-wizard-state'
import { WizardShell } from '../_components/WizardShell'
import { WizardProgress } from '../_components/WizardProgress'
import { StepPayment } from '../_components/StepPayment'
import type { WizardStep } from '../_types'

export default function PaymentPage() {
  const router = useRouter()
  const { state, isHydrated } = useWizardState()

  useEffect(() => {
    if (!isHydrated) return
    if (!state.companyId || !state.plan || !state.company || !state.account || !state.brand) {
      router.replace('/onboard/plan')
    }
  }, [isHydrated, state, router])

  if (!isHydrated || !state.plan || !state.company || !state.account || !state.brand || !state.companyId) return null

  function handleStepClick(step: WizardStep) {
    router.push(`/onboard/${step}`)
  }

  return (
    <WizardShell>
      <WizardProgress currentStep="payment" onStepClick={handleStepClick} />
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
        <StepPayment
          plan={state.plan}
          company={state.company}
          account={state.account}
          brand={state.brand}
          companyId={state.companyId}
          onBack={() => router.back()}
        />
      </div>
    </WizardShell>
  )
}
