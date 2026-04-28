// app/api/cron/email-drip/route.ts
//
// Daily cron — sends Day 5 and Day 14 drip emails to onboarded companies.
//
// Triggered by Vercel Cron at 08:00 UTC (10:00 SAST) daily.
// See vercel.json for the schedule definition.
//
// Logic:
//   1. Fetch companies WHERE subscription_status = 'active' AND onboarded_at IS NOT NULL
//   2. For each company:
//      a. days_since_onboarded >= 5 AND drip_day5_sent = false  → send Day 5 nudge
//      b. days_since_onboarded >= 14 AND drip_day14_sent = false → send Day 14 analytics snapshot
//   3. Set drip flag to true after a successful send (prevents duplicates)
//   4. One company failure does not stop the others
//
// Security:
//   Uses supabaseAdmin (service role) — no user auth context in cron jobs.
//   Request authenticated via Authorization: Bearer <CRON_SECRET> header,
//   which Vercel sets automatically from the CRON_SECRET env var.
//
// Environment variables required:
//   CRON_SECRET                — set in Vercel, auto-injected by Vercel Cron
//   SUPABASE_SERVICE_ROLE_KEY  — already set for supabaseAdmin

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendDay5NudgeEmail, sendDay14AnalyticsEmail } from '@/lib/email/onboarding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyDripRow = {
  id: string
  name: string
  billing_email: string | null
  primary_contact_email: string | null
  primary_contact_name: string | null
  onboarded_at: string
  drip_day5_sent: boolean
  drip_day14_sent: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  // eslint-disable-next-line no-console
  console.log('[email-drip] Starting drip email run')

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => unknown
  }

  // Fetch all active, onboarded companies with their drip flags
  const { data: companies, error: fetchError } = await (
    (adminAny.from('companies') as {
      select: (q: string) => {
        eq: (col: string, val: string) => {
          not: (col: string, op: string, val: null) => Promise<{
            data: CompanyDripRow[] | null
            error: { message: string } | null
          }>
        }
      }
    })
      .select('id, name, billing_email, primary_contact_email, primary_contact_name, onboarded_at, drip_day5_sent, drip_day14_sent')
      .eq('subscription_status', 'active')
      .not('onboarded_at', 'is', null)
  )

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error('[email-drip] Failed to fetch companies:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = companies ?? []
  // eslint-disable-next-line no-console
  console.log(`[email-drip] ${rows.length} eligible companies found`)

  let processed = 0
  let skipped = 0
  const errors: string[] = []

  for (const company of rows) {
    try {
      const adminEmail = company.billing_email ?? company.primary_contact_email
      if (!adminEmail) {
        // eslint-disable-next-line no-console
        console.warn(`[email-drip] Skipping ${company.name} — no email address configured`)
        skipped++
        continue
      }

      const adminName = company.primary_contact_name ?? company.name
      const days = daysSince(company.onboarded_at)

      // ── Day 5 nudge ────────────────────────────────────────────────────────
      if (days >= 5 && !company.drip_day5_sent) {
        const { error } = await sendDay5NudgeEmail({
          companyName: company.name,
          adminEmail,
          adminName,
          analyticsUrl: `${appUrl}/dashboard/analytics`,
        })

        if (error) {
          errors.push(`${company.name} day5: ${error}`)
        } else {
          await (
            (adminAny.from('companies') as {
              update: (p: Record<string, unknown>) => {
                eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
              }
            })
              .update({ drip_day5_sent: true })
              .eq('id', company.id)
          )
          // eslint-disable-next-line no-console
          console.log('[email-drip] day5 sent to', company.name)
          processed++
        }
      }

      // ── Day 14 analytics snapshot ───────────────────────────────────────────
      if (days >= 14 && !company.drip_day14_sent) {
        // Fetch active staff cards for this company
        const { data: staffCards } = await supabaseAdmin
          .from('staff_cards')
          .select('id, full_name')
          .eq('company_id', company.id)
          .eq('is_active', true)

        const staffCardIds = (staffCards ?? []).map(c => c.id)
        const staffById = new Map((staffCards ?? []).map(c => [c.id, c.full_name]))

        // Use sentinel UUID when no staff cards exist so query doesn't error
        const queryIds = staffCardIds.length > 0
          ? staffCardIds
          : ['00000000-0000-0000-0000-000000000000']

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

        const { data: views } = await supabaseAdmin
          .from('card_views')
          .select('staff_card_id')
          .in('staff_card_id', queryIds)
          .gte('viewed_at', fourteenDaysAgo)

        const viewCount = (views ?? []).length

        // Find top card by view count
        const countMap = new Map<string, number>()
        for (const v of views ?? []) {
          if (v.staff_card_id) {
            countMap.set(v.staff_card_id, (countMap.get(v.staff_card_id) ?? 0) + 1)
          }
        }
        const topEntry = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])[0]
        const topCardName = topEntry ? (staffById.get(topEntry[0]) ?? null) : null

        const { error } = await sendDay14AnalyticsEmail({
          companyName: company.name,
          adminEmail,
          adminName,
          viewCount,
          topCardName,
          dashboardUrl: `${appUrl}/dashboard/analytics`,
        })

        if (error) {
          errors.push(`${company.name} day14: ${error}`)
        } else {
          await (
            (adminAny.from('companies') as {
              update: (p: Record<string, unknown>) => {
                eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
              }
            })
              .update({ drip_day14_sent: true })
              .eq('id', company.id)
          )
          // eslint-disable-next-line no-console
          console.log('[email-drip] day14 sent to', company.name)
          processed++
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${company.name}: ${msg}`)
      // eslint-disable-next-line no-console
      console.error(`[email-drip] Error processing ${company.name}:`, msg)
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[email-drip] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors.length}`)

  return NextResponse.json({ ok: true, processed, skipped, errors })
}
