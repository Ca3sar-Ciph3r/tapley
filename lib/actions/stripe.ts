'use server'

// lib/actions/stripe.ts
//
// Stripe billing server actions.
// All mutations require super_admin role.
// Uses supabaseAdmin (service role) for DB writes — Stripe events cross company boundaries.
//
// SA billing approach:
//   - Collection method: 'send_invoice' — Stripe emails the company a PDF invoice
//   - Company pays via EFT into Luke's SA bank account linked to Stripe
//   - Currency: ZAR (Stripe supports ZAR natively)
//   - Quantity = active staff card count for the company
//
// Stripe setup checklist (see INFRA.md):
//   1. Register at stripe.com with SA business details
//   2. Create Product "Tapley Connect Subscription"
//   3. Create a recurring per-unit Price in ZAR per tier
//   4. Set collection_method = 'send_invoice' on the subscription
//   5. Configure webhook endpoint → https://tapleyconnect.co.za/api/webhooks/stripe
//   6. Add env vars to Vercel: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_PRICE_ID_PER_CARD
//
// Webhook events handled in /api/webhooks/stripe/route.ts:
//   - invoice.paid                  → insert billing_record (type='payment', status='paid')
//   - invoice.payment_failed        → update subscription_status = 'past_due'
//   - customer.subscription.updated → sync max_staff_cards if quantity changed

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

// ---------------------------------------------------------------------------
// createStripeCustomer
//
// Creates a Stripe Customer for a company and persists stripe_customer_id.
// Safe to call multiple times — returns existing customer if already created.
// ---------------------------------------------------------------------------

export async function createStripeCustomer(
  companyId: string,
): Promise<{ customerId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  // Check if already has a customer
  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (q: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: { stripe_customer_id: string | null; name: string; primary_contact_email: string | null } | null; error: unknown }>
        }
      }
    }
  }

  const { data: company, error: fetchError } = await adminAny
    .from('companies')
    .select('stripe_customer_id, name, primary_contact_email')
    .eq('id', companyId)
    .single()

  if (fetchError || !company) return { error: 'Company not found.' }

  if (company.stripe_customer_id) {
    return { customerId: company.stripe_customer_id }
  }

  // Create Stripe customer
  const stripe = getStripe()
  let customer: { id: string }
  try {
    customer = await stripe.customers.create({
      name: company.name,
      email: company.primary_contact_email ?? undefined,
      metadata: {
        tapley_company_id: companyId,
      },
    })
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create Stripe customer.' }
  }

  // Persist customer ID
  const { error: updateError } = await (supabaseAdmin as unknown as {
    from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
  }).from('companies')
    .update({ stripe_customer_id: customer.id })
    .eq('id', companyId)

  if (updateError) return { error: `Customer created but failed to save: ${updateError.message}` }

  return { customerId: customer.id }
}

// ---------------------------------------------------------------------------
// activateSubscription
//
// Creates a Stripe Subscription for a company.
// Uses 'send_invoice' collection method (EFT-friendly).
// quantity = current active staff card count.
// ---------------------------------------------------------------------------

export async function activateSubscription(
  companyId: string,
  priceId?: string,
): Promise<{ subscriptionId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  const resolvedPriceId = priceId ?? process.env.STRIPE_PRICE_ID_PER_CARD
  if (!resolvedPriceId) return { error: 'No Stripe price ID configured. Set STRIPE_PRICE_ID_PER_CARD env var.' }

  // Ensure customer exists
  const { customerId, error: customerError } = await createStripeCustomer(companyId)
  if (customerError || !customerId) return { error: customerError ?? 'Failed to create customer.' }

  // Count active staff cards
  const { count: activeCount, error: countError } = await supabaseAdmin
    .from('staff_cards')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true)

  if (countError) return { error: `Failed to count staff cards: ${countError.message}` }

  const quantity = Math.max(activeCount ?? 1, 1)

  // Create subscription
  const stripe = getStripe()
  let subscription: { id: string }
  try {
    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: resolvedPriceId, quantity }],
      currency: 'zar',
      collection_method: 'send_invoice',
      days_until_due: 14,
      metadata: {
        tapley_company_id: companyId,
      },
    })
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create Stripe subscription.' }
  }

  // Persist subscription ID and price ID
  const { error: updateError } = await (supabaseAdmin as unknown as {
    from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }
  }).from('companies')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: resolvedPriceId,
      subscription_status: 'active',
    })
    .eq('id', companyId)

  if (updateError) {
    return { error: `Subscription created (${subscription.id}) but failed to save: ${updateError.message}` }
  }

  return { subscriptionId: subscription.id }
}

// ---------------------------------------------------------------------------
// updateSubscriptionQuantity
//
// Called after createStaffCard / deleteStaffCard to keep Stripe in sync.
// newQuantity = current active card count for this company.
// ---------------------------------------------------------------------------

export async function updateSubscriptionQuantity(
  companyId: string,
  newQuantity: number,
): Promise<{ error?: string }> {
  if (newQuantity < 1) newQuantity = 1

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (q: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: { stripe_subscription_id: string | null; stripe_price_id: string | null } | null; error: unknown }>
        }
      }
    }
  }

  const { data: company, error: fetchError } = await adminAny
    .from('companies')
    .select('stripe_subscription_id, stripe_price_id')
    .eq('id', companyId)
    .single()

  if (fetchError || !company) return {}  // No subscription yet — silently skip

  const { stripe_subscription_id, stripe_price_id } = company
  if (!stripe_subscription_id || !stripe_price_id) return {}

  const stripe = getStripe()
  try {
    // Retrieve the subscription to find the subscription item ID
    const sub = await stripe.subscriptions.retrieve(stripe_subscription_id)
    const item = sub.items.data.find(i => i.price.id === stripe_price_id)
    if (!item) return { error: 'Subscription item not found for this price.' }

    await stripe.subscriptions.update(stripe_subscription_id, {
      items: [{ id: item.id, quantity: newQuantity }],
      proration_behavior: 'none',
    })
  } catch (err: unknown) {
    // Non-fatal — log but don't break the card create/delete flow
    // eslint-disable-next-line no-console
    console.error('[updateSubscriptionQuantity]', err instanceof Error ? err.message : err)
    return { error: err instanceof Error ? err.message : 'Stripe update failed.' }
  }

  return {}
}

// ---------------------------------------------------------------------------
// getCustomerPortalUrl
//
// Returns a Stripe Customer Portal URL for a company.
// The portal lets the company view invoices and update billing details.
// ---------------------------------------------------------------------------

export async function getCustomerPortalUrl(
  companyId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const adminAny = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (q: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: { stripe_customer_id: string | null } | null; error: unknown }>
        }
      }
    }
  }

  const { data: company, error: fetchError } = await adminAny
    .from('companies')
    .select('stripe_customer_id')
    .eq('id', companyId)
    .single()

  if (fetchError || !company?.stripe_customer_id) {
    return { error: 'No Stripe customer found for this company.' }
  }

  const stripe = getStripe()
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: returnUrl,
    })
    return { url: session.url }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create portal session.' }
  }
}
