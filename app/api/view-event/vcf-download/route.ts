// app/api/view-event/vcf-download/route.ts
//
// Method:  POST
// Auth:    None — public endpoint.
// Purpose: Mark vcf_downloaded = true for the visitor's current card view.
//          Fired from the card page client component — fire-and-forget.
//
// Body:    { session_id: string, nfc_card_id: string, staff_card_id?: string }
//
// Always returns 200 — tracking must never surface an error on the card page.

import { NextRequest, NextResponse } from 'next/server'
import {
  readGeo,
  recordInteraction,
  nfcCardExists,
  verifyStaffCardBelongsToNfcCard,
} from '@/lib/analytics/card-events'
import { allowRequest, clientKey } from '@/lib/analytics/rate-limit'

const ok = () => NextResponse.json({ ok: true })

export async function POST(request: NextRequest) {
  try {
    // Public endpoint: cap volume per client so nobody can sit in a loop
    // inflating a competitor's numbers. Still returns 200 — a dropped event
    // must look identical to an accepted one from the outside.
    if (!allowRequest(clientKey(request.headers))) return ok()

    const { session_id, nfc_card_id, staff_card_id } = await request.json()

    if (typeof session_id !== 'string' || !session_id) return ok()
    if (!(await nfcCardExists(nfc_card_id))) return ok()

    await recordInteraction({
      nfcCardId: nfc_card_id,
      sessionId: session_id,
      staffCardId: await verifyStaffCardBelongsToNfcCard(nfc_card_id, staff_card_id),
      flag: 'vcf_downloaded',
      geo: readGeo(request.headers),
    })

    return ok()
  } catch (error) {
    console.error('[vcf-download]', error)
    return ok()
  }
}
