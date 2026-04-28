'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState } from '@/lib/hooks/use-wizard-state'
import { WizardShell } from '../_components/WizardShell'
import { WizardProgress } from '../_components/WizardProgress'
import { StepBranding } from '../_components/StepBranding'
import type { WizardBrand, WizardStep } from '../_types'

export default function BrandingPage() {
  const router = useRouter()
  const { state, updateState, isHydrated } = useWizardState()

  useEffect(() => {
    if (!isHydrated) return
    if (!state.plan)                        { router.replace('/onboard/plan');    return }
    if (!state.company)                     { router.replace('/onboard/company'); return }
    if (!state.account || !state.companyId) { router.replace('/onboard/account'); return }
  }, [isHydrated, state.plan, state.company, state.account, state.companyId, router])

  if (!isHydrated || !state.plan || !state.company || !state.account || !state.companyId) return null

  function handleNext(brand: WizardBrand) {
    updateState({ brand })
    router.push('/onboard/payment')
  }

  function handleStepClick(step: WizardStep) {
    router.push(`/onboard/${step}`)
  }

  return (
    <WizardShell>
      <WizardProgress currentStep="branding" onStepClick={handleStepClick} />
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
        <StepBranding
          initial={state.brand}
          companyId={state.companyId}
          plan={state.plan}
          company={state.company}
          account={state.account}
          onNext={handleNext}
          onBack={() => router.back()}
        />
      </div>
    </WizardShell>
  )
}
