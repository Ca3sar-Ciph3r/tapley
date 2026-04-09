'use client'

// app/(admin)/admin/[companyId]/_components/OnboardingChecklist.tsx
//
// 8-item onboarding checklist Luke can tick manually.
// Each checkbox fires updateOnboardingChecklist immediately (optimistic update).
// Checklist state is stored as JSONB in companies.onboarding_checklist.

import { useState } from 'react'
import { updateOnboardingChecklist, type OnboardingChecklist } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type ChecklistKey = keyof OnboardingChecklist

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string; description: string }[] = [
  {
    key: 'company_created',
    label: 'Company created',
    description: 'Company record and slug set up in Tapley Connect',
  },
  {
    key: 'admin_invited',
    label: 'Admin invited',
    description: 'Company Admin has received invite email and set password',
  },
  {
    key: 'branding_set',
    label: 'Branding set',
    description: 'Logo uploaded, brand colours and card template configured',
  },
  {
    key: 'staff_imported',
    label: 'Staff imported',
    description: 'All staff cards created (CSV import or manually)',
  },
  {
    key: 'nfc_cards_generated',
    label: 'NFC cards generated',
    description: 'Physical NFC card slugs generated and sent for printing',
  },
  {
    key: 'cards_assigned',
    label: 'Cards assigned',
    description: 'Every staff card has an NFC card assigned',
  },
  {
    key: 'card_page_tested',
    label: 'Card page tested',
    description: 'At least one card page tapped and verified on mobile',
  },
  {
    key: 'handover_done',
    label: 'Handover done',
    description: 'Admin trained, physical cards delivered, client signed off',
  },
]

const DEFAULT_CHECKLIST: OnboardingChecklist = {
  company_created: false,
  admin_invited: false,
  branding_set: false,
  staff_imported: false,
  nfc_cards_generated: false,
  cards_assigned: false,
  card_page_tested: false,
  handover_done: false,
}

function parseChecklist(raw: Record<string, boolean> | null): OnboardingChecklist {
  if (!raw) return { ...DEFAULT_CHECKLIST }
  return {
    company_created: raw.company_created ?? false,
    admin_invited: raw.admin_invited ?? false,
    branding_set: raw.branding_set ?? false,
    staff_imported: raw.staff_imported ?? false,
    nfc_cards_generated: raw.nfc_cards_generated ?? false,
    cards_assigned: raw.cards_assigned ?? false,
    card_page_tested: raw.card_page_tested ?? false,
    handover_done: raw.handover_done ?? false,
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  companyId: string
  checklist: Record<string, boolean> | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OnboardingChecklist({ companyId, checklist: initialChecklist }: Props) {
  const [state, setState] = useState<OnboardingChecklist>(parseChecklist(initialChecklist))
  const [savingKey, setSavingKey] = useState<ChecklistKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const completedCount = Object.values(state).filter(Boolean).length
  const totalCount = CHECKLIST_ITEMS.length
  const allDone = completedCount === totalCount

  async function handleToggle(key: ChecklistKey) {
    const updated: OnboardingChecklist = { ...state, [key]: !state[key] }
    setState(updated)  // optimistic
    setSavingKey(key)
    setError(null)

    const result = await updateOnboardingChecklist(companyId, updated)

    setSavingKey(null)
    if (result.error) {
      // Roll back
      setState(prev => ({ ...prev, [key]: !prev[key] }))
      setError(result.error)
    }
  }

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-jakarta text-base font-bold text-slate-900">Onboarding Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {completedCount} of {totalCount} steps complete
          </p>
        </div>
        {allDone ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 uppercase tracking-wide">
            <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
            Complete
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 uppercase tracking-wide">
            <span className="material-symbols-outlined text-[14px] leading-none">pending</span>
            In Progress
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full mb-6">
        <div
          className="h-1.5 bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-1">
        {CHECKLIST_ITEMS.map(item => {
          const checked = state[item.key]
          const isSaving = savingKey === item.key

          return (
            <label
              key={item.key}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors select-none ${
                checked ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              {/* Checkbox */}
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(item.key)}
                  disabled={isSaving}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    checked
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-white border-slate-300'
                  } ${isSaving ? 'opacity-50' : ''}`}
                >
                  {isSaving ? (
                    <span className="material-symbols-outlined text-[12px] text-white animate-spin leading-none">
                      progress_activity
                    </span>
                  ) : checked ? (
                    <span className="material-symbols-outlined text-[12px] text-white leading-none">
                      check
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Label + description */}
              <div className="min-w-0">
                <p className={`text-sm font-semibold leading-tight ${checked ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
              </div>
            </label>
          )
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}
    </div>
  )
}
