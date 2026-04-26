// app/api/webhooks/payfast/route.ts
//
// PayFast Instant Transaction Notification (ITN) handler.
//
// Security:
//   - Validates source IP against known PayFast server IPs (skipped in sandbox mode)
//   - Verifies MD5 signature using PAYFAST_PASSPHRASE
//   - Uses supabaseAdmin (service role) — server-to-server, no user auth
//   - Returns plain "OK" with HTTP 200; PayFast retries on any other response
//
// custom_str field layout (set in buildPaymentForm.ts):
//   custom_str1 = companyId
//   custom_str2 = payment type: 'onboarding' | 'additional_cards'
//   custom_str3 = planName (onboarding) | additionalCardCount string (add-cards)
//   custom_str4 = total card count (string)
//   custom_str5 = new monthly total in ZAR (string)
//
// Three scenarios handled:
//   1. onboarding + company is pending_payment → initial activation + save subscription token
//   2. onboarding + company is already active  → recurring monthly payment → log billing_record
//   3. additional_cards                        → bump max_staff_cards + update subscription amount
//
// Configuration:
//   PayFast dashboard → Merchant Account → Instant Transaction Notification
//   URL: https://tapleyconnect.co.za/api/webhooks/payfast

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }            from '@/lib/supabase/admin'
import { PAYFAST_SANDBOX, PAYFAST_VALID_IPS, PAYFAST_PASSPHRASE } from '@/lib/payfast/config'
import { verifyPayFastSignature }   from '@/lib/payfast/signature'
import { updateSubscriptionAmount } from '@/lib/payfast/api'
import {
  sendAdminNotificationEmail,
  sendClientActivationEmail,
} from '@/lib/email/onboarding'

export const runtime = 'nodejs'

// Supabase cast helper — new columns not yet in generated types
type AdminAny = {
  from(t: string): {
    update(row: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { message: string } | null }>
    }
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    select(cols: string): {
      eq(col: string, val: string): {
        single(): Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. IP validation — skip in sandbox mode
  if (!PAYFAST_SANDBOX) {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : null
    if (!ip || !PAYFAST_VALID_IPS.includes(ip)) {
      // eslint-disable-next-line no-console
      console.warn('[payfast-itn] rejected request from IP:', ip)
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // 2. Read raw body — required for signature verification
  const rawBody = await req.text()

  // 3. Verify MD5 signature
  if (!verifyPayFastSignature(rawBody, PAYFAST_PASSPHRASE)) {
    // eslint-disable-next-line no-console
    console.warn('[payfast-itn] signature verification failed')
    return new NextResponse('Invalid signature', { status: 400 })
  }

  // 4. Parse fields
  const params = new URLSearchParams(rawBody)
  const paymentStatus = params.get('payment_status')

  if (paymentStatus !== 'COMPLETE') {
    // eslint-disable-next-line no-console
    console.info('[payfast-itn] payment_status:', paymentStatus, '— no action taken')
    return new NextResponse('OK', { status: 200 })
  }

  // 5. Extract metadata
  const companyId   = params.get('custom_str1')
  const paymentType = params.get('custom_str2')  // 'onboarding' | 'additional_cards'
  const customStr3  = params.get('custom_str3') ?? ''
  const customStr4  = params.get('custom_str4') ?? '0'
  const customStr5  = params.get('custom_str5') ?? '0'
  const pfPaymentId = params.get('pf_payment_id') ?? ''
  const pfToken     = params.get('token') ?? ''            // subscription token (set by PayFast)
  const adminEmail  = params.get('email_address') ?? ''
  const amountGross = parseFloat(params.get('amount_gross') ?? '0')

  if (!companyId) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] missing custom_str1 (companyId)')
    return new NextResponse('OK', { status: 200 })
  }

  const db = supabaseAdmin as unknown as AdminAny
  const now = new Date().toISOString()

  // ---------------------------------------------------------------------------
  // Route to the correct handler
  // ---------------------------------------------------------------------------

  if (paymentType === 'additional_cards') {
    await handleAdditionalCards(db, {
      companyId,
      additionalCards: parseInt(customStr3, 10) || 0,
      newTotalCards:   parseInt(customStr4, 10) || 0,
      newMonthlyZar:   parseFloat(customStr5) || 0,
      amountGross,
      pfPaymentId,
      now,
    })
    return new NextResponse('OK', { status: 200 })
  }

  // Default: onboarding flow
  const planName  = customStr3
  const cardCount = parseInt(customStr4, 10) || 0

  // Fetch company to determine if this is the initial activation or a recurring charge
  const { data: company } = await db.from('companies')
    .select('name, subscription_status, payfast_subscription_token')
    .eq('id', companyId)
    .single()

  const isAlreadyActive = (company?.['subscription_status'] as string | undefined) === 'active'

  if (isAlreadyActive) {
    // Recurring monthly subscription payment — just log it
    await handleRecurringPayment(db, { companyId, amountGross, pfPaymentId, now })
    return new NextResponse('OK', { status: 200 })
  }

  // Initial activation
  await handleInitialActivation(db, {
    companyId,
    planName,
    cardCount,
    adminEmail,
    amountGross,
    pfPaymentId,
    pfToken,
    companyName: (company?.['name'] as string | undefined) ?? 'Unknown',
    now,
  })

  return new NextResponse('OK', { status: 200 })
}

// ---------------------------------------------------------------------------
// handleInitialActivation
//
// Runs on the first successful payment (pending_payment → active).
// Stores the subscription token, fires activation emails.
// ---------------------------------------------------------------------------

async function handleInitialActivation(
  db: AdminAny,
  args: {
    companyId:   string
    planName:    string
    cardCount:   number
    adminEmail:  string
    amountGross: number
    pfPaymentId: string
    pfToken:     string
    companyName: string
    now:         string
  },
): Promise<void> {
  const { companyId, planName, cardCount, adminEmail, amountGross, pfPaymentId, pfToken, companyName, now } = args

  const { error: activateError } = await db.from('companies').update({
    subscription_status:        'active',
    setup_fee_paid:             true,
    setup_fee_paid_at:          now,
    setup_fee_payfast_token:    pfPaymentId,
    payfast_subscription_token: pfToken || null,
    subscription_start:         now,
    onboarded_at:               now,
    updated_at:                 now,
  }).eq('id', companyId)

  if (activateError) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] activation failed:', activateError.message)
    return
  }

  const { error: billingError } = await db.from('billing_records').insert({
    company_id:   companyId,
    type:         'setup_fee',
    amount_zar:   amountGross,
    description:  `Self-service setup fee — PayFast ${pfPaymentId}`,
    billing_date: now.slice(0, 10),
    status:       'paid',
  })

  if (billingError) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] billing_record insert failed:', billingError.message)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  const [adminResult, clientResult] = await Promise.allSettled([
    sendAdminNotificationEmail({
      companyName,
      adminName:   '',  // not stored in custom_str — adminEmail is sufficient
      adminEmail,
      planName,
      cardCount,
      setupFeeZar: amountGross,
      companyId,
    }),
    sendClientActivationEmail({
      companyName,
      adminEmail,
      adminName:   '',
      planName,
      cardCount,
      dashboardUrl: `${appUrl}/dashboard`,
    }),
  ])

  if (adminResult.status === 'rejected') {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] admin email failed:', adminResult.reason)
  }
  if (clientResult.status === 'rejected') {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] client email failed:', clientResult.reason)
  }
}

// ---------------------------------------------------------------------------
// handleRecurringPayment
//
// Runs on each subsequent monthly subscription charge.
// Company is already active — just log the payment.
// ---------------------------------------------------------------------------

async function handleRecurringPayment(
  db: AdminAny,
  args: {
    companyId:   string
    amountGross: number
    pfPaymentId: string
    now:         string
  },
): Promise<void> {
  const { companyId, amountGross, pfPaymentId, now } = args

  const { error } = await db.from('billing_records').insert({
    company_id:   companyId,
    type:         'monthly_fee',
    amount_zar:   amountGross,
    description:  `Monthly subscription — PayFast ${pfPaymentId}`,
    billing_date: now.slice(0, 10),
    status:       'paid',
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] recurring billing_record failed:', error.message)
  }
}

// ---------------------------------------------------------------------------
// handleAdditionalCards
//
// Runs when a company pays to add more card slots.
// Updates max_staff_cards, updates the PayFast subscription amount.
// ---------------------------------------------------------------------------

async function handleAdditionalCards(
  db: AdminAny,
  args: {
    companyId:       string
    additionalCards: number
    newTotalCards:   number
    newMonthlyZar:   number
    amountGross:     number
    pfPaymentId:     string
    now:             string
  },
): Promise<void> {
  const { companyId, newTotalCards, newMonthlyZar, amountGross, pfPaymentId, now } = args

  // Fetch subscription token to update recurring amount
  const { data: company } = await db.from('companies')
    .select('payfast_subscription_token')
    .eq('id', companyId)
    .single()

  const subscriptionToken = (company?.['payfast_subscription_token'] as string | undefined) ?? ''

  // Update card count
  const { error: updateError } = await db.from('companies').update({
    max_staff_cards: newTotalCards,
    updated_at:      now,
  }).eq('id', companyId)

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] add-cards company update failed:', updateError.message)
    return
  }

  // Log the additional cards setup fee
  const { error: billingError } = await db.from('billing_records').insert({
    company_id:   companyId,
    type:         'setup_fee',
    amount_zar:   amountGross,
    description:  `Additional card slots setup fee — PayFast ${pfPaymentId}`,
    billing_date: now.slice(0, 10),
    status:       'paid',
  })

  if (billingError) {
    // eslint-disable-next-line no-console
    console.error('[payfast-itn] add-cards billing_record failed:', billingError.message)
  }

  // Update PayFast subscription to the new monthly total
  if (subscriptionToken && newMonthlyZar > 0) {
    const { error: subError } = await updateSubscriptionAmount(subscriptionToken, newMonthlyZar)
    if (subError) {
      // eslint-disable-next-line no-console
      console.error('[payfast-itn] subscription update failed:', subError)
    }
  }
}
