// app/api/view-event/wa-click/route.ts
//
// Method:  POST
// Auth:    None — public endpoint.
// Purpose: Mark wa_clicked = true on the card_view record when a user taps WhatsApp.
//          Fired from the card page client component — fire-and-forget.
//
// Body:    { session_id: string, nfc_card_id: string }

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ok = () => NextResponse.json({ ok: true })

export async function POST(request: NextRequest) {
  try {
    const { session_id, nfc_card_id } = await request.json()

    if (!session_id || !nfc_card_id) {
      return ok()
    }

    await supabaseAdmin
      .from('card_views')
      .update({ wa_clicked: true })
      .eq('session_id', session_id)
      .eq('nfc_card_id', nfc_card_id)

    return ok()
  } catch (error) {
    console.error('[wa-click]', error)
    return ok()
  }
}
