// app/api/view-event/route.ts
//
// Method:  POST
// Auth:    None — public endpoint. Called from the card page after hydration.
// Purpose: Log a card view event. MUST always return 200.
//          A non-200 response could surface errors on the card page experience.
//
// Supabase: supabaseAdmin (service role) — no user session; inserts bypass RLS.
//
// Dedup:   If session_id + nfc_card_id has a view in the last 30 minutes,
//          UPDATE viewed_at instead of INSERTing a new row.
//
// WA notify: If insert succeeds and staff_card.wa_notify_enabled = true,
//             POST to MAKE_WEBHOOK_VIEW_EVENT (fire-and-forget, do not await).
//
// See JOURNEYS.md Journey 5 for full spec.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  DEDUP_WINDOW_MS,
  readGeo,
  nfcCardExists,
  verifyStaffCardBelongsToNfcCard,
} from '@/lib/analytics/card-events'
import { allowRequest, clientKey } from '@/lib/analytics/rate-limit'

/** Sources the client is allowed to claim. Anything else is recorded as unknown. */
const VALID_SOURCES = new Set(['nfc', 'qr', 'link', 'email', 'event', 'unknown'])

// Always return 200 — never let tracking errors surface to the card page
const ok = () => NextResponse.json({ ok: true })

// ---------------------------------------------------------------------------
// User-Agent parser — no external library, keeps bundle small
// ---------------------------------------------------------------------------

interface ParsedUserAgent {
  device_type: 'mobile' | 'tablet' | 'desktop'
  os: 'ios' | 'android' | 'windows' | 'macos' | 'other'
  browser: string
}

function parseUserAgent(ua: string): ParsedUserAgent {
  const lc = ua.toLowerCase()

  // Device type
  const isMobile = /mobile|iphone|ipod|android.*mobile/.test(lc)
  const isTablet = /tablet|ipad/.test(lc) || (/android/.test(lc) && !lc.includes('mobile'))
  const device_type: ParsedUserAgent['device_type'] = isTablet
    ? 'tablet'
    : isMobile
    ? 'mobile'
    : 'desktop'

  // OS
  let os: ParsedUserAgent['os'] = 'other'
  if (/iphone|ipad|ipod/.test(lc)) os = 'ios'
  else if (/android/.test(lc)) os = 'android'
  else if (/windows/.test(lc)) os = 'windows'
  else if (/mac os|macos/.test(lc)) os = 'macos'

  // Browser (check order matters — Edge contains 'chrome', Samsung contains 'safari')
  let browser = 'other'
  if (/samsungbrowser/.test(lc)) browser = 'samsung'
  else if (/edg\//.test(lc)) browser = 'edge'
  else if (/opr\/|opera/.test(lc)) browser = 'opera'
  else if (/chrome\//.test(lc)) browser = 'chrome'
  else if (/firefox\//.test(lc)) browser = 'firefox'
  else if (/safari\//.test(lc)) browser = 'safari'

  return { device_type, os, browser }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Public endpoint: cap volume per client so nobody can sit in a loop
    // inflating a competitor's numbers. Still returns 200 — a dropped event
    // must look identical to an accepted one from the outside.
    if (!allowRequest(clientKey(request.headers))) return ok()

    const body = await request.json()
    const { nfc_card_id, staff_card_id, session_id, source } = body

    // Validate required fields — silently ignore malformed requests
    if (typeof session_id !== 'string' || !session_id) {
      return ok()
    }

    // This endpoint is public and unauthenticated. Confirm the nfc_card is real
    // and that the claimed staff_card actually belongs to it — otherwise anyone
    // could POST arbitrary pairs and attribute views to a competitor's staff.
    if (!(await nfcCardExists(nfc_card_id))) {
      return ok()
    }
    const verifiedStaffCardId = await verifyStaffCardBelongsToNfcCard(
      nfc_card_id,
      staff_card_id
    )

    // Parse User-Agent for device/OS/browser detection
    const userAgent = request.headers.get('user-agent') ?? ''
    const { device_type, os, browser } = parseUserAgent(userAgent)

    // The previous code read `cf-ipcity`, a CLOUDFLARE header, on a Vercel
    // deployment — so city was always null in production (confirmed: 0 of 145
    // live rows carry one) and country was the hardcoded 'ZA' default.
    const { city, country } = readGeo(request.headers)
    const referrerUrl = request.headers.get('referer') ?? null

    // Dedup check: same session + card within 30 minutes?
    // Ordered + limit(1) + maybeSingle, NOT .single(): .single() raises on 2+
    // matches, which made `existing` null and inserted yet another duplicate.
    // Live data already carries 7 duplicate session/card pairs from this —
    // 145 rows for 137 real views, roughly 6% inflation.
    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
    const { data: existing } = await supabaseAdmin
      .from('card_views')
      .select('id')
      .eq('session_id', session_id)
      .eq('nfc_card_id', nfc_card_id)
      .gte('viewed_at', windowStart)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Dedup hit — refresh the timestamp only
      await supabaseAdmin
        .from('card_views')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', existing.id)
      return ok()
    }

    // New view — insert
    const { error: insertError } = await supabaseAdmin
      .from('card_views')
      .insert({
        nfc_card_id,
        staff_card_id: verifiedStaffCardId,
        session_id,
        source:
          typeof source === 'string' && VALID_SOURCES.has(source)
            ? source
            : 'unknown',
        device_type,
        os,
        browser,
        city,
        referrer_url: referrerUrl,
        country,
      })

    if (insertError) {
      console.error('[view-event] insert error:', insertError)
      return ok() // Still return 200
    }

    // WA notification via Make.com (fire-and-forget — do not await)
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_VIEW_EVENT
    if (makeWebhookUrl && verifiedStaffCardId) {
      // Fetch staff card to check wa_notify_enabled before firing
      const { data: staffCard } = await supabaseAdmin
        .from('staff_cards')
        .select('wa_notify_enabled, full_name, whatsapp_number')
        .eq('id', verifiedStaffCardId)
        .limit(1)
        .maybeSingle()

      if (staffCard?.wa_notify_enabled) {
        fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'card_view',
            staff_card_id: verifiedStaffCardId,
            staff_name: staffCard.full_name,
            source: source ?? 'unknown',
            city,
            device_type,
            viewed_at: new Date().toISOString(),
          }),
        }).catch((err) => console.error('[view-event] make.com webhook failed:', err))
        // No await — fire and forget

        // Log the notification attempt — we only know that we fired it, not
        // that Make.com delivered it.
        //
        // Guarded on whatsapp_number because wa_notifications_log.recipient_number
        // is NOT NULL. Passing null here failed the insert at runtime for every
        // staff member without a WhatsApp number, silently — the type error
        // that would have caught it was suppressed by ignoreBuildErrors.
        if (staffCard.whatsapp_number) {
          void supabaseAdmin
            .from('wa_notifications_log')
            .insert({
              company_id:       null, // nullable — avoids an extra query here
              staff_card_id:    verifiedStaffCardId,
              recipient_number: staffCard.whatsapp_number,
              message_template: 'card_view',
              channel:          'make_webhook',
              status:           'sent',
            })
            .then(
              () => {},
              (err: unknown) =>
                console.error('[view-event] wa_log insert failed:', err)
            )
          // No await — must not block the 200 response. Rejection is handled by
          // the second argument to then(): a PostgREST builder is a PromiseLike
          // and has no .catch().
        }
      }
    }

    return ok()
  } catch (error) {
    console.error('[view-event]', error)
    return ok() // Always 200 — view tracking must never break the card page
  }
}
