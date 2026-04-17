// app/api/lead-capture/route.ts
//
// Public endpoint — called by the LeadCaptureSheet on card pages (ISR).
// No user auth: any visitor to a card page can submit.
// Uses supabaseAdmin (service role) — the only safe pattern for public writes
// where there is no authenticated session.
//
// Inserts into `contacts` with source='card_tap' and the staff_card_id
// that generated the lead, so CRM attribution is always preserved.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface LeadPayload {
  staffCardId: string
  companyId: string
  name: string
  email?: string | null
  phone?: string | null
}

// Basic E.164 normalisation for South African numbers.
// Accepts: 0821234567, 27821234567, +27821234567 → +27821234567
// Non-SA or already-formatted numbers are returned as-is.
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    return `+27${digits.slice(1)}`
  }
  if (digits.startsWith('27') && digits.length === 11) {
    return `+${digits}`
  }
  return raw.trim()
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body as Partial<LeadPayload>

  if (!payload.staffCardId || typeof payload.staffCardId !== 'string') {
    return NextResponse.json({ error: 'staffCardId is required' }, { status: 400 })
  }
  if (!payload.companyId || typeof payload.companyId !== 'string') {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
  }
  if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const phone = payload.phone ? normalisePhone(String(payload.phone)) : null

  const { error } = await supabaseAdmin
    .from('contacts')
    .insert({
      company_id: payload.companyId,
      staff_card_id: payload.staffCardId,
      full_name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone,
      whatsapp_number: phone,
      source: 'card_tap',
    })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[lead-capture] Insert failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
