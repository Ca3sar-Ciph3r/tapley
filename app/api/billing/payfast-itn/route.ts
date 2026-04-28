// app/api/billing/payfast-itn/route.ts
//
// PayFast Instant Transaction Notification (ITN) handler — canonical endpoint.
// notify_url for all new payments: https://tapleys.co.za/api/billing/payfast-itn
//
// CRITICAL: company.subscription_status is NEVER set to 'active' by application
// code anywhere else. Only this handler activates a company after confirmed payment.
// This prevents free-access exploits via API manipulation.
//
// Security (3-step via verifyITN):
//   1. MD5 signature verification
//   2. Source IP allowlist (skipped in sandbox)
//   3. PayFast /eng/query/validate round-trip
//
// custom_str field layout (set in lib/payfast/build-payment.ts):
//   custom_str1 = companyId
//   custom_str2 = subscription_plan (starter | growth | enterprise)
//   custom_str3 = (reserved — planName or extra context)
//   custom_str4 = max_staff_cards (string)
//   custom_str5 = monthly recurring ZAR (string)
//
// ALWAYS returns HTTP 200. PayFast retries on any other status.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }            from '@/lib/supabase/admin'
import { verifyITN }                from '@/lib/payfast/verify'
import { PLAN_MAX_CARDS }           from '@/lib/payfast/build-payment'
import {
  sendAdminNotificationEmail,
  sendClientActivationEmail,
} from '@/lib/email/onboarding'

export const runtime = 'nodejs'

// Supabase cast helper — bypasses TS2339 on columns not yet in generated types
type AdminAny = {
  from(t: string): {
    update(row: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>
    }
    select(cols: string): {
      eq(col: string, val: string): {
        single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()

  // Extract client IP for step 2 of verifyITN
  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp  = forwarded ? forwarded.split(',')[0].trim() : undefined

  const valid = await verifyITN(rawBody, clientIp)
  if (!valid) {
    // Log and return 200 — returning non-200 causes PayFast to retry indefinitely
    // eslint-disable-next-line no-console
    console.warn('[billing-itn] ITN verification failed — ip:', clientIp)
    return new NextResponse('OK', { status: 200 })
  }

  const params         = new URLSearchParams(rawBody)
  const paymentStatus  = params.get('payment_status')
  const companyId      = params.get('custom_str1')
  const plan           = params.get('custom_str2') ?? 'starter'
  const pfToken        = params.get('token') ?? ''
  const adminEmail     = params.get('email_address') ?? ''
  const amountGross    = parseFloat(params.get('amount_gross') ?? '0')
  const pfPaymentId    = params.get('pf_payment_id') ?? ''
  const monthlyFeeZar  = parseFloat(params.get('custom_str5') ?? '0')

  if (!companyId) {
    // eslint-disable-next-line no-console
    console.error('[billing-itn] missing custom_str1 (companyId)')
    return new NextResponse('OK', { status: 200 })
  }

  const db  = supabaseAdmin as unknown as AdminAny
  const now = new Date().toISOString()

  // ── COMPLETE ────────────────────────────────────────────────────────────────
  if (paymentStatus === 'COMPLETE') {
    const maxCards = PLAN_MAX_CARDS[plan] ?? 10

    const { error: activateError } = await db.from('companies').update({
      subscription_status:        'active',
      subscription_plan:          plan,
      max_staff_cards:            maxCards,
      setup_fee_paid:             true,
      setup_fee_paid_at:          now,
      setup_fee_payfast_token:    pfPaymentId,
      payfast_subscription_token: pfToken || null,
      subscription_start:         now,
      subscription_renewed_at:    now,
      onboarded_at:               now,
      updated_at:                 now,
    }).eq('id', companyId)

    if (activateError) {
      // eslint-disable-next-line no-console
      console.error('[billing-itn] activation failed:', activateError.message)
      return new NextResponse('OK', { status: 200 })
    }

    // Fetch company name for emails
    const { data: company } = await db.from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const companyName = (company?.['name'] as string | undefined) ?? 'your company'
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleys.co.za'

    // Fire notifications — failure must not block the 200 response
    const [adminResult, clientResult] = await Promise.allSettled([
      sendAdminNotificationEmail({
        companyName,
        adminName:   '',
        adminEmail,
        planName:    plan,
        cardCount:   maxCards,
        setupFeeZar: amountGross,
        companyId,
      }),
      sendClientActivationEmail({
        companyName,
        adminEmail,
        adminName:   '',
        planName:    plan,
        cardCount:   maxCards,
        dashboardUrl: `${appUrl}/dashboard`,
      }),
    ])

    if (adminResult.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('[billing-itn] admin email failed:', adminResult.reason)
    }
    if (clientResult.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.error('[billing-itn] client email failed:', clientResult.reason)
    }

    // Fire Make.com webhook — primary notification channel, email is fallback
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_NEW_CLIENT
    if (makeWebhookUrl) {
      fetch(makeWebhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:          'company.onboarded',
          company_name:   companyName,
          admin_email:    adminEmail,
          plan,
          monthly_value:  monthlyFeeZar,
          company_id:     companyId,
          admin_link:     `${appUrl}/admin/${companyId}`,
        }),
      }).catch(err => {
        // eslint-disable-next-line no-console
        console.error('[billing-itn] make webhook failed:', err)
      })
    }

    return new NextResponse('OK', { status: 200 })
  }

  // ── FAILED ──────────────────────────────────────────────────────────────────
  if (paymentStatus === 'FAILED') {
    await db.from('companies').update({
      subscription_status: 'payment_failed',
      updated_at:          now,
    }).eq('id', companyId)

    return new NextResponse('OK', { status: 200 })
  }

  // ── CANCELLED ────────────────────────────────────────────────────────────────
  if (paymentStatus === 'CANCELLED') {
    await db.from('companies').update({
      subscription_status: 'cancelled',
      updated_at:          now,
    }).eq('id', companyId)

    return new NextResponse('OK', { status: 200 })
  }

  // Any other payment_status (PENDING etc.) — no action, always 200
  return new NextResponse('OK', { status: 200 })
}
