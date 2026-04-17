// app/api/cron/billing/route.ts
//
// Daily cron job — auto-generates monthly invoices.
//
// Triggered by Vercel Cron at 00:05 SAST (22:05 UTC previous day).
// See vercel.json for the schedule definition.
//
// Logic:
//   1. Find all active companies where next_billing_date = today (SAST)
//   2. For each:
//      a. Count active staff cards (billable quantity)
//      b. Apply minimum card commitment if higher
//      c. Calculate amount: rate_per_card_zar × billable_count
//      d. Insert a billing_record (type='monthly_fee', status='pending')
//      e. Advance next_billing_date by 1 month (or 12 months for annual)
//         preserving the same day-of-month (e.g. always the 28th)
//   3. Return a summary of what was generated
//
// Security:
//   Uses supabaseAdmin (service role) — no user auth context in cron jobs.
//   Request is authenticated via Authorization: Bearer <CRON_SECRET> header,
//   which Vercel sets automatically from the CRON_SECRET env var.
//
// Environment variables required:
//   CRON_SECRET           — set in Vercel, auto-injected by Vercel Cron
//   SUPABASE_SERVICE_ROLE_KEY — already set for supabaseAdmin

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Advance a billing date by one period, preserving the day-of-month.
 * e.g. 2026-04-28 + 1 month → 2026-05-28
 *      2026-01-31 + 1 month → 2026-02-28 (last day of Feb)
 */
function advanceBillingDate(currentIso: string, cycle: 'monthly' | 'annual'): string {
  const d = new Date(currentIso + 'T00:00:00Z')
  const day = d.getUTCDate()
  const months = cycle === 'annual' ? 12 : 1

  d.setUTCMonth(d.getUTCMonth() + months)

  // If the month rolled over (e.g. Jan 31 + 1 month overflowed into March),
  // snap back to the last day of the intended month.
  if (d.getUTCDate() !== day) {
    d.setUTCDate(0) // 0 = last day of previous month
  }

  return d.toISOString().slice(0, 10)
}

/**
 * Get today's date in SAST (UTC+2) as YYYY-MM-DD.
 * Cron fires at 22:05 UTC = 00:05 SAST next day.
 */
function todaySast(): string {
  const now = new Date()
  // Add 2 hours for SAST
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify cron secret — Vercel sets Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
  }

  const today = todaySast()

  // eslint-disable-next-line no-console
  console.log(`[cron/billing] Running for date: ${today}`)

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => unknown
  }

  // Fetch all companies due today with their billing config
  type CompanyDue = {
    id: string
    name: string
    rate_per_card_zar: number | null
    next_billing_date: string
    billing_cycle: string | null
    min_cards_committed: number | null
    subscription_status: string
  }

  const { data: dueCompanies, error: fetchError } = await (
    (adminAny.from('companies') as {
      select: (q: string) => {
        eq: (c: string, v: string) => {
          in: (c: string, vals: string[]) => Promise<{ data: CompanyDue[] | null; error: { message: string } | null }>
        }
      }
    }).select('id, name, rate_per_card_zar, next_billing_date, billing_cycle, min_cards_committed, subscription_status')
      .eq('next_billing_date', today)
      .in('subscription_status', ['active', 'trialing', 'past_due'])
  )

  if (fetchError) {
    // eslint-disable-next-line no-console
    console.error('[cron/billing] Failed to fetch due companies:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const companies = dueCompanies ?? []
  // eslint-disable-next-line no-console
  console.log(`[cron/billing] Found ${companies.length} companies due today`)

  if (companies.length === 0) {
    return NextResponse.json({ generated: 0, skipped: 0, errors: [], date: today })
  }

  // Count active staff cards per company in one query
  const companyIds = companies.map(c => c.id)

  const { data: staffCards, error: staffError } = await supabaseAdmin
    .from('staff_cards')
    .select('company_id')
    .eq('is_active', true)
    .in('company_id', companyIds)

  if (staffError) {
    // eslint-disable-next-line no-console
    console.error('[cron/billing] Failed to count staff cards:', staffError.message)
    return NextResponse.json({ error: staffError.message }, { status: 500 })
  }

  const activeCardCount = (staffCards ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.company_id] = (acc[c.company_id] ?? 0) + 1
    return acc
  }, {})

  // Process each company
  const results = {
    generated: 0,
    skipped: 0,
    errors: [] as string[],
    invoices: [] as { company: string; amount: number; nextDate: string }[],
  }

  for (const company of companies) {
    try {
      const rate = company.rate_per_card_zar ?? 0
      const activeCards = activeCardCount[company.id] ?? 0
      const minCards = company.min_cards_committed ?? 0
      const billableCards = Math.max(activeCards, minCards)

      // Skip companies with no rate configured
      if (rate <= 0) {
        // eslint-disable-next-line no-console
        console.warn(`[cron/billing] Skipping ${company.name} — no rate configured`)
        results.skipped++
        continue
      }

      const amount = rate * billableCards
      const cycle = (company.billing_cycle === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual'
      const nextBillingDate = advanceBillingDate(company.next_billing_date, cycle)

      const description = [
        `${billableCards} card${billableCards !== 1 ? 's' : ''}`,
        `@ R${rate}/card`,
        cycle === 'annual' ? '(annual)' : '',
        billableCards > activeCards ? `(min ${minCards} applied)` : '',
      ].filter(Boolean).join(' ')

      // Insert billing record
      const { error: insertError } = await (
        (adminAny.from('billing_records') as {
          insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
        }).insert({
          company_id: company.id,
          type: 'monthly_fee',
          amount_zar: amount,
          description,
          billing_date: today,
          status: 'pending',
        })
      )

      if (insertError) {
        results.errors.push(`${company.name}: ${insertError.message}`)
        continue
      }

      // Advance next_billing_date
      const { error: updateError } = await (
        (adminAny.from('companies') as {
          update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
        }).update({ next_billing_date: nextBillingDate })
          .eq('id', company.id)
      )

      if (updateError) {
        results.errors.push(`${company.name} date advance: ${updateError.message}`)
        // Invoice was created — don't count as failed
      }

      results.generated++
      results.invoices.push({ company: company.name, amount, nextDate: nextBillingDate })

      // eslint-disable-next-line no-console
      console.log(`[cron/billing] Generated R${amount} invoice for ${company.name} → next: ${nextBillingDate}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`${company.name}: ${msg}`)
      // eslint-disable-next-line no-console
      console.error(`[cron/billing] Error processing ${company.name}:`, msg)
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[cron/billing] Done — generated: ${results.generated}, skipped: ${results.skipped}, errors: ${results.errors.length}`)

  return NextResponse.json({ ...results, date: today }, { status: 200 })
}
