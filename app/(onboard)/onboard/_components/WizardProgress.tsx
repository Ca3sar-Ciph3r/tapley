// app/(onboard)/onboard/_components/WizardProgress.tsx

import { WIZARD_STEPS, STEP_LABELS, type WizardStep } from '../_types'

interface WizardProgressProps {
  currentStep: WizardStep
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const currentIndex = WIZARD_STEPS.indexOf(currentStep)

  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {WIZARD_STEPS.map((step, index) => {
        const isDone    = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
                  isDone
                    ? 'bg-teal-600 text-white'
                    : isCurrent
                    ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                    : 'bg-slate-100 text-slate-400',
                ].join(' ')}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={[
                  'mt-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap',
                  isCurrent ? 'text-teal-700' : isDone ? 'text-teal-500' : 'text-slate-400',
                ].join(' ')}
              >
                {STEP_LABELS[step]}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={[
                  'h-0.5 w-10 sm:w-16 mb-5 mx-1 transition-all duration-200',
                  isDone ? 'bg-teal-500' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
