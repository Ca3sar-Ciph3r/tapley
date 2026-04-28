'use client'

import { useRouter } from 'next/navigation'
import { useWizardState } from '@/lib/hooks/use-wizard-state'
import { WizardShell } from '../_components/WizardShell'
import { WizardProgress } from '../_components/WizardProgress'
import { StepPlan } from '../_components/StepPlan'
import type { WizardPlan, WizardStep } from '../_types'

export default function PlanPage() {
  const router = useRouter()
  const { state, updateState } = useWizardState()

  function handleNext(plan: WizardPlan) {
    updateState({ plan })
    router.push('/onboard/company')
  }

  function handleStepClick(step: WizardStep) {
    router.push(`/onboard/${step}`)
  }

  return (
    <WizardShell>
      <WizardProgress currentStep="plan" onStepClick={handleStepClick} />
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
        <StepPlan initial={state.plan} onNext={handleNext} />
      </div>
    </WizardShell>
  )
}
