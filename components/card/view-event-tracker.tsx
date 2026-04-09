'use client'

// components/card/view-event-tracker.tsx
//
// Client component — renders null, fires a view event after hydration.
//
// RULES (from CLAUDE.md Rule 3 and JOURNEYS.md Journey 1):
//   - Fire-and-forget: NO await, NO loading state, NO error handling in UI
//   - Must never block or delay card page render
//   - Reads the ?src= param from the URL client-side (keeps page ISR-cacheable)
//   - sessionStorage is created here on first visit; CardActions reuses it later

import { useEffect } from 'react'
import { getOrCreateSessionId } from '@/lib/utils/session'

interface ViewEventTrackerProps {
  nfcCardId: string
  staffCardId: string
}

export function ViewEventTracker({ nfcCardId, staffCardId }: ViewEventTrackerProps) {
  useEffect(() => {
    const sessionId = getOrCreateSessionId()
    const src = new URLSearchParams(window.location.search).get('src') ?? 'unknown'

    fetch('/api/view-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nfc_card_id: nfcCardId,
        staff_card_id: staffCardId,
        session_id: sessionId,
        source: src,
      }),
    })
    // Fire and forget — no await, no .catch(), no state update
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
