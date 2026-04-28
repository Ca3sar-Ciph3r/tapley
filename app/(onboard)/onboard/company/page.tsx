'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState } from '@/lib/hooks/use-wizard-state'
import { WizardShell } from '../_components/WizardShell'
import { WizardProgress } from '../_components/WizardProgress'
import { StepCompany } from '../_components/StepCompany'
import type { WizardCompany, WizardStep } from '../_types'

export default function CompanyPage() {
  const router = useRouter()
  const { state, updateState, isHydrated } = useWizardState()

  useEffect(() => {
    if (!isHydrated) return
    if (!state.plan) router.replace('/onboard/plan')
  }, [isHydrated, state.plan, router])

  if (!isHydrated || !state.plan) return null

  function handleNext(company: WizardCompany) {
    updateState({ company })
    router.push('/onboard/account')
  }

  function handleStepClick(step: WizardStep) {
    router.push(`/onboard/${step}`)
  }

  return (
    <WizardShell>
      <WizardProgress currentStep="company" onStepClick={handleStepClick} />
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
        <StepCompany
          initial={state.company}
          onNext={handleNext}
          onBack={() => router.back()}
        />
      </div>
    </WizardShell>
  )
}
