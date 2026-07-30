'use client'

// app/(admin)/admin/[companyId]/_components/OnboardingChecklist.tsx
//
// Onboarding status for a company.
//
// Six of the eight steps are DERIVED from the database and cannot be ticked by
// hand. This used to be eight manual checkboxes, and every one of the five live
// companies had drifted from reality in both directions — Nanovault was marked
// fully onboarded and handed over while having no staff, no admin, an
// unassigned card and zero views. A checklist you consult to decide whether a
// client is ready to hand over is worse than useless when it lies.
//
// The two steps with no database signal — someone physically tapping a card on
// a phone, and the handover conversation — stay manual, but are shown next to
// the evidence needed to judge them.

import { useCallback, useEffect, useState } from 'react'
import { updateOnboardingChecklist, type OnboardingChecklist } from '@/lib/actions/admin'
import {
  getOnboardingStatus,
  type DerivedStepKey,
  type ManualStepKey,
  type OnboardingStatus,
} from '@/lib/actions/onboarding'

const DERIVED_LABELS: Record<DerivedStepKey, string> = {
  company_created: 'Company created',
  admin_invited: 'Admin invited',
  branding_set: 'Branding set',
  staff_imported: 'Staff imported',
  nfc_cards_generated: 'NFC cards generated',
  cards_assigned: 'Cards assigned',
}

const MANUAL_ITEMS: { key: ManualStepKey; label: string; description: string }[] = [
  {
    key: 'card_page_tested',
    label: 'Card page tested',
    description: 'Tapped and checked on a real iPhone and a budget Android',
  },
  {
    key: 'handover_done',
    label: 'Handover done',
    description: 'Admin trained, physical cards delivered, client signed off',
  },
]

type Props = {
  companyId: string
  checklist: Record<string, boolean> | null
}

export function OnboardingChecklist({ companyId, checklist: initialChecklist }: Props) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [manual, setManual] = useState<Record<ManualStepKey, boolean>>({
    card_page_tested: initialChecklist?.card_page_tested ?? false,
    handover_done: initialChecklist?.handover_done ?? false,
  })
  const [savingKey, setSavingKey] = useState<ManualStepKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await getOnboardingStatus(companyId)
    setStatus(result)
    if (result.error) setError(result.error)
  }, [companyId])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggle(key: ManualStepKey) {
    const next = { ...manual, [key]: !manual[key] }
    setManual(next)
    setSavingKey(key)
    setError(null)

    // Preserve any derived keys already stored so nothing is silently dropped.
    const payload = {
      ...(initialChecklist ?? {}),
      ...next,
    } as OnboardingChecklist

    const result = await updateOnboardingChecklist(companyId, payload)
    setSavingKey(null)
    if (result.error) {
      setManual(prev => ({ ...prev, [key]: !prev[key] }))
      setError(result.error)
    }
  }

  const derived = status?.derived ?? []
  const derivedDone = derived.filter(d => d.done).length
  const manualDone = Object.values(manual).filter(Boolean).length
  const completed = derivedDone + manualDone
  const total = derived.length + MANUAL_ITEMS.length
  const allDone = total > 0 && completed === total

  const evidence = status?.evidence

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-jakarta text-base font-bold text-slate-900">Onboarding Status</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {status ? `${completed} of ${total} steps complete` : 'Checking…'}
          </p>
        </div>
        {status && (
          allDone ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
              <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
              Complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
              <span className="material-symbols-outlined text-[14px] leading-none">pending</span>
              In Progress
            </span>
          )
        )}
      </div>

      <div className="mb-6 h-1.5 w-full rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
        />
      </div>

      {/* Derived — read from the database, not tickable */}
      <div className="space-y-1">
        {derived.map(step => (
          <div
            key={step.key}
            className={`flex items-center gap-4 rounded-xl px-4 py-3 ${
              step.done ? 'bg-emerald-50/60' : 'bg-slate-50/60'
            }`}
          >
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 ${
                step.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
              }`}
            >
              {step.done && (
                <span className="material-symbols-outlined text-[12px] leading-none text-white">
                  check
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold leading-tight ${
                  step.done ? 'text-emerald-800' : 'text-slate-800'
                }`}
              >
                {DERIVED_LABELS[step.key]}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {derived.length > 0 && (
        <p className="mt-3 px-4 text-[11px] leading-relaxed text-slate-400">
          The steps above are read from the database and update themselves. The
          two below have no database signal, so they stay manual.
        </p>
      )}

      {/* Manual — real-world events */}
      <div className="mt-3 space-y-1">
        {MANUAL_ITEMS.map(item => {
          const checked = manual[item.key]
          const isSaving = savingKey === item.key
          const isTestStep = item.key === 'card_page_tested'

          return (
            <label
              key={item.key}
              className={`flex cursor-pointer select-none items-center gap-4 rounded-xl px-4 py-3 transition-colors ${
                checked ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(item.key)}
                  disabled={isSaving}
                  className="sr-only"
                />
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors ${
                    checked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                  } ${isSaving ? 'opacity-50' : ''}`}
                >
                  {isSaving ? (
                    <span className="material-symbols-outlined animate-spin text-[12px] leading-none text-white">
                      progress_activity
                    </span>
                  ) : checked ? (
                    <span className="material-symbols-outlined text-[12px] leading-none text-white">
                      check
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold leading-tight ${
                    checked ? 'text-emerald-800' : 'text-slate-800'
                  }`}
                >
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {item.description}
                  {isTestStep && evidence && (
                    <>
                      {' · '}
                      <span className="text-slate-500">
                        {evidence.totalViews} view
                        {evidence.totalViews === 1 ? '' : 's'} so far,{' '}
                        {evidence.nfcSourcedViews} from an actual NFC tap
                      </span>
                    </>
                  )}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
