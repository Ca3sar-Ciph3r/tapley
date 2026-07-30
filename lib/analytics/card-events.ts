// lib/analytics/card-events.ts
//
// Shared write path for every card_views interaction.
//
// The problem this solves:
//   The card page fires POST /api/view-event from a useEffect, and the CTA
//   buttons fire POST /api/view-event/{wa-click,vcf-download,cta-click} on tap.
//   Those handlers used to run a bare UPDATE keyed on session_id + nfc_card_id.
//   If the visitor tapped WhatsApp before the view INSERT had landed — entirely
//   normal on 3G, where the button is the first thing they reach for — the
//   UPDATE matched zero rows and the conversion was silently lost. There was no
//   retry and no error, so the number simply never appeared in analytics.
//
//   recordInteraction() instead creates the row when it is missing, so an
//   interaction can never be dropped for arriving early.
//
// Supabase: supabaseAdmin (service role) — public endpoints, no user session.

import { supabaseAdmin } from '@/lib/supabase/admin'

/** Matches DATABASE.md: a repeat view inside this window updates, not inserts. */
export const DEDUP_WINDOW_MS = 30 * 60 * 1000

export type CardViewFlag = 'wa_clicked' | 'vcf_downloaded' | 'cta_clicked'

export interface RequestGeo {
  city: string | null
  country: string
}

/**
 * Read visitor geo from platform headers.
 *
 * The previous code read `cf-ipcity`, which is a Cloudflare header. This app is
 * deployed on Vercel, which sets `x-vercel-ip-*` — so city was always null in
 * production (confirmed: 0 of 145 live rows have a city) and country was the
 * hardcoded 'ZA' default. Cloudflare names are kept as a fallback in case the
 * custom domain is ever fronted by Cloudflare.
 */
export function readGeo(headers: Headers): RequestGeo {
  const city =
    headers.get('x-vercel-ip-city') ?? headers.get('cf-ipcity') ?? null

  const country =
    headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry') ?? 'ZA'

  return {
    // Vercel percent-encodes city names ("Port%20Elizabeth").
    city: city ? safeDecode(city) : null,
    country: country.toUpperCase(),
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Confirm a staff_card actually belongs to the nfc_card it was reported against.
 *
 * /api/view-event is public and unauthenticated, so without this check anyone
 * could POST arbitrary (nfc_card_id, staff_card_id) pairs and attribute views to
 * a competitor's staff member. Returns the id only when the pair is genuine.
 */
export async function verifyStaffCardBelongsToNfcCard(
  nfcCardId: string,
  staffCardId: unknown
): Promise<string | null> {
  if (typeof staffCardId !== 'string' || !staffCardId) return null

  const { data } = await supabaseAdmin
    .from('staff_cards')
    .select('id')
    .eq('id', staffCardId)
    .eq('nfc_card_id', nfcCardId)
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}

/** Confirm the nfc_card exists before writing anything keyed to it. */
export async function nfcCardExists(nfcCardId: unknown): Promise<boolean> {
  if (typeof nfcCardId !== 'string' || !nfcCardId) return false

  const { data } = await supabaseAdmin
    .from('nfc_cards')
    .select('id')
    .eq('id', nfcCardId)
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

/**
 * Find the most recent card_view for this session + card inside the dedup window.
 *
 * Ordered + limit(1) + maybeSingle rather than .single(): .single() raises when
 * two rows match, which made the caller treat a duplicate as "no row found" and
 * insert yet another. Live data carries 7 such duplicate pairs.
 */
async function findRecentView(
  nfcCardId: string,
  sessionId: string
): Promise<{ id: string } | null> {
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()

  const { data } = await supabaseAdmin
    .from('card_views')
    .select('id')
    .eq('session_id', sessionId)
    .eq('nfc_card_id', nfcCardId)
    .gte('viewed_at', windowStart)
    .order('viewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ?? null
}

export interface RecordInteractionInput {
  nfcCardId: string
  sessionId: string
  staffCardId: string | null
  flag: CardViewFlag
  geo: RequestGeo
}

/**
 * Mark an interaction flag on the visitor's current card view.
 *
 * Updates the most recent matching view, or inserts one if the interaction
 * arrived before the view event did. Never throws — analytics must not be able
 * to break a card page.
 */
export async function recordInteraction({
  nfcCardId,
  sessionId,
  staffCardId,
  flag,
  geo,
}: RecordInteractionInput): Promise<void> {
  try {
    const existing = await findRecentView(nfcCardId, sessionId)

    if (existing) {
      await supabaseAdmin
        .from('card_views')
        .update({ [flag]: true })
        .eq('id', existing.id)
      return
    }

    // The interaction beat the view insert. Record it rather than lose it.
    await supabaseAdmin.from('card_views').insert({
      nfc_card_id: nfcCardId,
      staff_card_id: staffCardId,
      session_id: sessionId,
      source: 'unknown',
      city: geo.city,
      country: geo.country,
      [flag]: true,
    })
  } catch (error) {
    console.error(`[card-events] failed to record ${flag}:`, error)
  }
}
