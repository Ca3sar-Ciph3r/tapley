'use client'

// Shared hook for the self-service onboarding wizard.
// Reads/writes WizardState to localStorage under key 'tapley_onboard_draft'.

import { useCallback, useEffect, useState } from 'react'
import type { WizardState } from '@/app/(onboard)/onboard/_types'

const STORAGE_KEY = 'tapley_onboard_draft'

const EMPTY: WizardState = {
  plan:      null,
  company:   null,
  account:   null,
  brand:     null,
  companyId: null,
}

export function useWizardState() {
  const [state,      setState]      = useState<WizardState>(EMPTY)
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate from localStorage once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setState(JSON.parse(raw) as WizardState)
    } catch {
      // ignore malformed JSON
    }
    setIsHydrated(true)
  }, [])

  const updateState = useCallback((partial: Partial<WizardState>) => {
    setState(prev => {
      const next = { ...prev, ...partial }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage quota errors
      }
      return next
    })
  }, [])

  const clearState = useCallback(() => {
    setState(EMPTY)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return { state, updateState, clearState, isHydrated }
}
