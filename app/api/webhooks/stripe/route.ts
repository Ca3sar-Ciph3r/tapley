// app/api/webhooks/stripe/route.ts
//
// Stripe webhook handler.
//
// Security:
//   - Verifies Stripe-Signature header using STRIPE_WEBHOOK_SECRET
//   - Uses supabaseAdmin (service role) — server-to-server, no user auth
//   - Returns 200 quickly to prevent Stripe retries on slow DB writes
//
// Events handled:
//   checkout.session.completed    → activate self-service company after setup fee paid
//   invoice.paid                  → insert billing_record (type='payment', status='paid')
//   invoice.payment_failed        → update subscription_status = 'past_due'
//   customer.subscription.updated → sync active card quantity if it changed externally
//
// Configuration:
//   1. In Stripe dashboard → Developers → Webhooks → Add endpoint
//      URL: https://tapleyconnect.co.za/api/webhooks/stripe
//      Events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated
//   2. Copy the "Signing secret" → add as STRIPE_WEBHOOK_SECRET in Vercel

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  sendAdminNotificationEmail,
  sendClientActivationEmail,
} from '@/lib/email/onboarding'

// Disable Next.js body parsing — Stripe needs the raw bytes for signature verification
export const runtime = 'nodejs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Read raw body for signature verification
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Dispatch to handler — swallow errors so Stripe doesn't retry on our DB issues
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      default:
        // Unhandled event types — acknowledge and ignore
        break
    }
  } catch (err: unknown) {
    // Log but still return 200 — prevents Stripe from retrying indefinitely
    // eslint-disable-next-line no-console
    console.error(`[stripe-webhook] handler error for ${event.type}:`, err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// handleCheckoutCompleted
//
// Activates a self-service company after the one-time setup fee is paid.
// Guards: only processes events with tapley_type = 'onboarding_setup_fee'.
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.tapley_type !== 'onboarding_setup_fee') return
  if (session.payment_status !== 'paid') return

  const companyId = session.metadata?.tapley_company_id
  if (!companyId) {
    // eslint-disable-next-line no-console
    console.warn('[stripe-webhook] checkout.session.completed — missing tapley_company_id in metadata')
    return
  }

  const adminAny = supabaseAdmin as unknown as {
    from(t: string): {
      update(row: Record<string, unknown>): {
        eq(col: string, val: string): Promise<{ error: { message: string } | null }>
      }
      insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>
    }
  }

  // 1. Activate the company
  const { error: activateError } = await adminAny.from('companies').update({
    subscription_status: 'active',
    setup_fee_paid:      true,
    onboarded_at:        new Date().toISOString(),
    stripe_customer_id:  typeof session.customer === 'string' ? session.customer : null,
    updated_at:          new Date().toISOString(),
  }).eq('id', companyId)

  if (activateError) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] failed to activate company:', activateError.message)
    return
  }

  // 2. Log the setup fee as a billing_record
  const amountZar = (session.amount_total ?? 0) / 100
  await adminAny.from('billing_records').insert({
    company_id:   companyId,
    type:         'setup_fee',
    amount_zar:   amountZar,
    description:  `Self-service setup fee — Stripe session ${session.id}`,
    billing_date: new Date().toISOString().slice(0, 10),
    status:       'paid',
  })

  // 3. Send email notifications (non-fatal — don't let email failure block activation)
  const companyName = session.metadata?.company_name ?? 'Unknown'
  const planName    = session.metadata?.plan_name    ?? 'Unknown'
  const adminName   = session.metadata?.admin_name   ?? ''
  const adminEmail  = session.metadata?.admin_email  ?? ''
  const cardCount   = parseInt(session.metadata?.card_count ?? '0', 10)
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  const [adminNotifyResult, clientEmailResult] = await Promise.allSettled([
    sendAdminNotificationEmail({
      companyName,
      adminName,
      adminEmail,
      planName,
      cardCount,
      setupFeeZar: amountZar,
      companyId,
    }),
    sendClientActivationEmail({
      companyName,
      adminEmail,
      adminName,
      planName,
      cardCount,
      dashboardUrl: `${appUrl}/dashboard`,
    }),
  ])

  if (adminNotifyResult.status === 'rejected') {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] admin notification email failed:', adminNotifyResult.reason)
  }
  if (clientEmailResult.status === 'rejected') {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] client activation email failed:', clientEmailResult.reason)
  }
}

// ---------------------------------------------------------------------------
// handleInvoicePaid
//
// Inserts a billing_record of type='payment' for the company.
// Resolves company_id from the subscription's metadata or the customer record.
// ---------------------------------------------------------------------------

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const companyId = await resolveCompanyId(invoice)
  if (!companyId) {
    // eslint-disable-next-line no-console
    console.warn('[stripe-webhook] invoice.paid — could not resolve company_id', {
      customerId: invoice.customer,
      subscriptionId: (invoice as unknown as { subscription?: string }).subscription,
    })
    return
  }

  const amountPaid = (invoice.amount_paid ?? 0) / 100  // Stripe amounts are in cents

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }
  }

  const { error } = await adminAny.from('billing_records').insert({
    company_id: companyId,
    type: 'payment',
    amount_zar: amountPaid,
    description: `Stripe invoice paid — ${invoice.id}`,
    billing_date: new Date((invoice.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
    status: 'paid',
  })

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] failed to insert billing_record:', error.message)
  }
}

// ---------------------------------------------------------------------------
// handleInvoicePaymentFailed
//
// Sets subscription_status = 'past_due' on the company record.
// ---------------------------------------------------------------------------

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const companyId = await resolveCompanyId(invoice)
  if (!companyId) return

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }

  const { error } = await adminAny.from('companies')
    .update({ subscription_status: 'past_due' })
    .eq('id', companyId)

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] failed to update subscription_status:', error.message)
  }
}

// ---------------------------------------------------------------------------
// handleSubscriptionUpdated
//
// Syncs max_staff_cards if the subscription quantity changed externally
// (e.g. edited directly in the Stripe dashboard).
// ---------------------------------------------------------------------------

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const companyId = subscription.metadata?.tapley_company_id
  if (!companyId) return

  const item = subscription.items.data[0]
  if (!item) return

  const newQuantity = item.quantity ?? 0

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }

  const { error } = await adminAny.from('companies')
    .update({
      max_staff_cards: newQuantity,
      subscription_status: subscription.status,
    })
    .eq('id', companyId)

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] failed to sync subscription quantity:', error.message)
  }
}

// ---------------------------------------------------------------------------
// resolveCompanyId
//
// Tries to find the tapley company_id from:
//   1. The subscription metadata  (set when we create the subscription)
//   2. The customer metadata      (set when we create the customer)
//   3. The companies table        (stripe_customer_id match)
// ---------------------------------------------------------------------------

async function resolveCompanyId(invoice: Stripe.Invoice): Promise<string | null> {
  // 1. Try subscription metadata
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription
  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId)
      if (sub.metadata?.tapley_company_id) return sub.metadata.tapley_company_id
    } catch { /* ignore */ }
  }

  // 2. Try customer metadata
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (customerId) {
    try {
      const customer = await getStripe().customers.retrieve(customerId)
      if (!customer.deleted && customer.metadata?.tapley_company_id) {
        return customer.metadata.tapley_company_id
      }
    } catch { /* ignore */ }

    // 3. Fall back to DB lookup by stripe_customer_id
    const adminAny = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (q: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: { id: string } | null; error: unknown }>
          }
        }
      }
    }

    const { data } = await adminAny.from('companies')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    return data?.id ?? null
  }

  return null
}
