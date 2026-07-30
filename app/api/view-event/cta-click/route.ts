// app/api/view-event/cta-click/route.ts
//
// Method:  POST
// Auth:    None — public endpoint.
// Purpose: Mark cta_clicked = true when a visitor taps the custom CTA (the
//          Calendly / website / landing-page button configured per staff card
//          or per company).
//
// Body:    { session_id: string, nfc_card_id: string, staff_card_id?: string }
//
// Why this route is new: card_views.cta_clicked has existed since the initial
// schema, but nothing ever wrote to it — the custom CTA button carried no
// onClick handler at all. Every custom CTA tap since launch went unrecorded
// (0 of 145 live rows have cta_clicked set).
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
      flag: 'cta_clicked',
      geo: readGeo(request.headers),
    })

    return ok()
  } catch (error) {
    console.error('[cta-click]', error)
    return ok()
  }
}
