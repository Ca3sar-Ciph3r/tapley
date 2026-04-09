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
    const body = await request.json()
    const { nfc_card_id, staff_card_id, session_id, source } = body

    // Validate required fields — silently ignore malformed requests
    if (!nfc_card_id || !session_id) {
      return ok()
    }

    // Parse User-Agent for device/OS/browser detection
    const userAgent = request.headers.get('user-agent') ?? ''
    const { device_type, os, browser } = parseUserAgent(userAgent)

    // City from Cloudflare header (Vercel passes this automatically on Pro/Enterprise)
    const city = request.headers.get('cf-ipcity') ?? null
    const referrerUrl = request.headers.get('referer') ?? null

    // Dedup check: same session + card within 30 minutes?
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: existing } = await supabaseAdmin
      .from('card_views')
      .select('id')
      .eq('session_id', session_id)
      .eq('nfc_card_id', nfc_card_id)
      .gte('viewed_at', thirtyMinutesAgo)
      .single()

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
        staff_card_id: staff_card_id ?? null,
        session_id,
        source: source ?? 'unknown',
        device_type,
        os,
        browser,
        city,
        referrer_url: referrerUrl,
        country: 'ZA', // Default for SA MVP; improve with IP geolocation post-MVP
      })

    if (insertError) {
      console.error('[view-event] insert error:', insertError)
      return ok() // Still return 200
    }

    // WA notification via Make.com (fire-and-forget — do not await)
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_VIEW_EVENT
    if (makeWebhookUrl && staff_card_id) {
      // Fetch staff card to check wa_notify_enabled before firing
      const { data: staffCard } = await supabaseAdmin
        .from('staff_cards')
        .select('wa_notify_enabled, full_name, whatsapp_number')
        .eq('id', staff_card_id)
        .single()

      if (staffCard?.wa_notify_enabled) {
        fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'card_view',
            staff_card_id,
            staff_name: staffCard.full_name,
            source: source ?? 'unknown',
            city,
            device_type,
            viewed_at: new Date().toISOString(),
          }),
        }).catch((err) => console.error('[view-event] make.com webhook failed:', err))
        // No await — fire and forget
      }
    }

    return ok()
  } catch (error) {
    console.error('[view-event]', error)
    return ok() // Always 200 — view tracking must never break the card page
  }
}
