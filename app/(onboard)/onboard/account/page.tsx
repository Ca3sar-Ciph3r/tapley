'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState } from '@/lib/hooks/use-wizard-state'
import { WizardShell } from '../_components/WizardShell'
import { WizardProgress } from '../_components/WizardProgress'
import { StepAccount } from '../_components/StepAccount'
import type { WizardAccount, WizardStep } from '../_types'

export default function AccountPage() {
  const router = useRouter()
  const { state, updateState, isHydrated } = useWizardState()

  useEffect(() => {
    if (!isHydrated) return
    if (!state.plan)    { router.replace('/onboard/plan');    return }
    if (!state.company) { router.replace('/onboard/company'); return }
  }, [isHydrated, state.plan, state.company, router])

  if (!isHydrated || !state.plan || !state.company) return null

  function handleNext(account: WizardAccount, companyId: string) {
    updateState({ account, companyId })
    router.push('/onboard/branding')
  }

  function handleStepClick(step: WizardStep) {
    router.push(`/onboard/${step}`)
  }

  return (
    <WizardShell>
      <WizardProgress currentStep="account" onStepClick={handleStepClick} />
      <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-slate-200/60 p-8">
        <StepAccount
          initial={state.account}
          plan={state.plan}
          company={state.company}
          onNext={handleNext}
          onBack={() => router.back()}
        />
      </div>
    </WizardShell>
  )
}
