// app/api/lead-capture/route.ts
//
// POST — public endpoint, called by LeadCaptureSheet on ISR card pages.
// No user session: any card-page visitor can submit. Uses supabaseAdmin
// (service role) for all DB writes — the only safe pattern here.
//
// POPIA compliance: does NOT store IP address or device fingerprint.
// See CLAUDE.md Rule 5, JOURNEYS.md Journey 7.
//
// Returns 400 with { errors: {...} } for field-level validation failures.
// Returns 500 with { error: '...' } for server errors (user-facing message).
// Returns 200 with { ok: true } on success.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'

interface LeadBody {
  staff_card_id:      string
  nfc_card_id:        string | null
  visitor_name:       string
  visitor_email:      string | null
  visitor_phone:      string | null
  visitor_company:    string | null
  message:            string | null
  popia_consent:      boolean
  popia_consent_text: string
}

type FieldErrors = Partial<Record<string, string>>

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
    }

    const b = body as Partial<LeadBody>

    // --- Field validation ---
    const fieldErrors: FieldErrors = {}

    if (!b.visitor_name?.trim()) {
      fieldErrors.visitor_name = 'Your name is required.'
    }

    if (!b.visitor_email?.trim() && !b.visitor_phone?.trim()) {
      fieldErrors.visitor_email = 'Please provide at least an email address or phone number.'
    }

    if (!b.popia_consent) {
      fieldErrors.popia_consent = 'You must consent to data storage to continue.'
    }

    if (!b.staff_card_id || typeof b.staff_card_id !== 'string') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json({ errors: fieldErrors }, { status: 400 })
    }

    // --- Verify staff card exists and opt-in form is enabled ---
    const { data: staffCard, error: cardError } = await supabaseAdmin
      .from('staff_cards')
      .select('company_id, show_optin_form, full_name')
      .eq('id', b.staff_card_id)
      .eq('is_active', true)
      .single()

    if (cardError || !staffCard) {
      return NextResponse.json({ error: 'Staff card not found.' }, { status: 400 })
    }

    if (!staffCard.show_optin_form) {
      return NextResponse.json(
        { error: 'The contact form is not enabled for this card.' },
        { status: 400 }
      )
    }

    // --- Normalise phone to E.164 format ---
    const phone = b.visitor_phone?.trim()
      ? normalisePhoneNumber(b.visitor_phone.trim())
      : null

    // --- Duplicate check: same email + company prevents duplicate contacts ---
    if (b.visitor_email?.trim()) {
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('company_id', staffCard.company_id)
        .eq('email', b.visitor_email.trim().toLowerCase())
        .maybeSingle()

      if (existing) {
        // Upsert: update the existing contact with the most recent card attribution
        await supabaseAdmin
          .from('contacts')
          .update({
            captured_via_card_id: b.staff_card_id,
            updated_at:           new Date().toISOString(),
          })
          .eq('id', existing.id)

        return NextResponse.json({ ok: true })
      }
    }

    // --- Insert new contact ---
    const now = new Date().toISOString()
    const { error: insertError } = await supabaseAdmin
      .from('contacts')
      .insert({
        company_id:           staffCard.company_id,
        captured_via_card_id: b.staff_card_id,
        full_name:            b.visitor_name!.trim(),
        email:                b.visitor_email?.trim().toLowerCase() || null,
        phone,
        company_name:         b.visitor_company?.trim() || null,
        notes:                b.message?.trim() || null,
        popia_consent:        true,
        popia_consent_at:     now,
        popia_consent_text:   b.popia_consent_text?.trim() ||
                              'I consent to storing my contact details in compliance with POPIA',
        status:               'new',
        updated_at:           now,
      })

    if (insertError) {
      console.error('[lead-capture] insert error:', insertError.message)
      return NextResponse.json(
        { error: 'Could not save your details. Please try again.' },
        { status: 500 }
      )
    }

    // --- Fire Make.com webhook (fire-and-forget, never blocks response) ---
    const webhookUrl = process.env.MAKE_WEBHOOK_CONTACT_CAPTURED
    if (webhookUrl) {
      fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:         'contact.captured',
          staff_name:    staffCard.full_name,
          visitor_name:  b.visitor_name,
          visitor_email: b.visitor_email ?? null,
          visitor_phone: phone,
          company_name:  b.visitor_company ?? null,
        }),
      }).catch((err: unknown) =>
        console.error('[lead-capture] make.com webhook failed:', err)
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('[lead-capture]', error)
    return NextResponse.json(
      { error: 'Could not save your details. Please try again.' },
      { status: 500 }
    )
  }
}
