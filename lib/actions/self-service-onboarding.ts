'use server'

// lib/actions/self-service-onboarding.ts
//
// Server actions for the self-service onboarding wizard.
//
// createPendingCompany()         — Step 3 (Account). Creates company + company_admins
//                                  row using supabaseAdmin to bypass RLS. Called after
//                                  supabase.auth.signUp() returns a valid session.
//
// saveOnboardingBranding()       — Step 4 (Branding). Updates brand columns on the
//                                  pending company row.
//
// createOnboardingCheckoutSession() — Step 5 (Payment). Creates a Stripe Checkout
//                                  session for the one-time setup fee and returns the URL.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'
import type { BillingCycle } from '@/lib/utils/pricing'

// ---------------------------------------------------------------------------
// createPendingCompany
//
// Creates a companies row (subscription_status = 'pending_payment') and a
// company_admins row for the newly signed-up user.
//
// Security:
//   - Verifies session via server-side supabase.auth.getUser()
//   - Uses supabaseAdmin only after user identity is confirmed
//   - Never trusts companyId or userId from the request body
// ---------------------------------------------------------------------------

export type CreatePendingCompanyInput = {
  companyName: string
  industry:    string
  website:     string
  tagline:     string
  tierName:    string
  cardCount:   number
  isQrDigital: boolean
  billingCycle: BillingCycle
  monthlyTotalZar: number
}

export type CreatePendingCompanyResult = {
  companyId?: string
  error?: string
}

export async function createPendingCompany(
  input: CreatePendingCompanyInput,
): Promise<CreatePendingCompanyResult> {
  // 1. Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'You must be signed in to create a company.' }
  }

  // 2. Prevent duplicate company creation for this user
  const { data: existing } = await supabaseAdmin
    .from('company_admins')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.company_id) {
    return { companyId: existing.company_id }
  }

  // 3. Generate a unique slug for the company
  const baseSlug = input.companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

  let slug = baseSlug
  let attempt = 0
  while (attempt < 10) {
    const suffix = attempt === 0 ? '' : `-${attempt}`
    const candidate = `${baseSlug}${suffix}`
    const { data: conflict } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!conflict) { slug = candidate; break }
    attempt++
  }

  // 4. Insert the company row (pending_payment — not yet active)
  const adminAny = supabaseAdmin as unknown as {
    from(t: 'companies'): {
      insert(row: Record<string, unknown>): {
        select(cols: string): {
          single(): Promise<{ data: { id: string } | null; error: { message: string } | null }>
        }
      }
    }
  }

  const { data: company, error: insertError } = await adminAny
    .from('companies')
    .insert({
      name:                input.companyName.trim(),
      slug,
      subscription_plan:   input.tierName.toLowerCase().replace(/\s+/g, '_'),
      subscription_status: 'pending_payment',
      max_staff_cards:     input.cardCount,
      pricing_v2_enabled:  true,
      billing_cycle:       input.billingCycle,
      monthly_rate_override: input.monthlyTotalZar,
      industry:            input.industry || null,
      website:             input.website.trim() || null,
      tagline:             input.tagline.trim() || null,
      self_service:        true,
      setup_fee_paid:      false,
    })
    .select('id')
    .single()

  if (insertError || !company) {
    return { error: insertError?.message ?? 'Failed to create company.' }
  }

  // 5. Create the company_admins row linking this user as 'admin'
  const { error: adminError } = await supabaseAdmin
    .from('company_admins')
    .insert({
      company_id: company.id,
      user_id:    user.id,
      role:       'admin',
    })

  if (adminError) {
    // Clean up the orphaned company row
    await supabaseAdmin.from('companies').delete().eq('id', company.id)
    return { error: adminError.message }
  }

  return { companyId: company.id }
}

// ---------------------------------------------------------------------------
// saveOnboardingBranding
//
// Persists brand settings onto the company row created in step 3.
// Verifies user is admin for the given company before updating.
// ---------------------------------------------------------------------------

export type SaveOnboardingBrandingInput = {
  companyId:     string
  logoUrl:       string | null
  logoPath:      string | null
  primaryColor:  string
  secondaryColor: string
  isDark:        boolean
  cardTemplate:  'minimal' | 'bold' | 'split'
}

export async function saveOnboardingBranding(
  input: SaveOnboardingBrandingInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Confirm user is admin for this company
  const { data: adminRow } = await supabaseAdmin
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', input.companyId)
    .single()

  if (!adminRow) return { error: 'Access denied.' }

  const { error } = await supabaseAdmin
    .from('companies')
    .update({
      logo_url:               input.logoUrl,
      brand_primary_color:    input.primaryColor,
      brand_secondary_color:  input.secondaryColor,
      brand_dark_mode:        input.isDark,
      card_template:          input.cardTemplate,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', input.companyId)

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// createOnboardingCheckoutSession
//
// Creates a Stripe Checkout session for the one-time setup fee.
// Returns the Checkout URL to redirect the user.
// ---------------------------------------------------------------------------

export type CreateOnboardingCheckoutInput = {
  companyId:      string
  companyName:    string
  setupFeeZar:    number
  monthlyFeeZar:  number
  planName:       string
  adminName:      string
  adminEmail:     string
  cardCount:      number
}

export type CreateOnboardingCheckoutResult = {
  checkoutUrl?: string
  error?: string
}

export async function createOnboardingCheckoutSession(
  input: CreateOnboardingCheckoutInput,
): Promise<CreateOnboardingCheckoutResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Verify user is admin for this company
  const { data: adminRow } = await supabaseAdmin
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', input.companyId)
    .single()

  if (!adminRow) return { error: 'Access denied.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const stripe = getStripe()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: input.adminEmail,
      line_items: [
        {
          price_data: {
            currency: 'zar',
            product_data: {
              name: `Tapley Connect — ${input.planName} Plan Setup`,
              description: `One-time setup fee for ${input.cardCount} digital business cards. Monthly subscription invoiced separately.`,
            },
            unit_amount: Math.round(input.setupFeeZar * 100),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          tapley_company_id: input.companyId,
          tapley_type:       'onboarding_setup_fee',
        },
      },
      metadata: {
        tapley_company_id: input.companyId,
        tapley_type:       'onboarding_setup_fee',
        company_name:      input.companyName,
        plan_name:         input.planName,
        admin_name:        input.adminName,
        admin_email:       input.adminEmail,
        card_count:        String(input.cardCount),
        monthly_fee_zar:   String(input.monthlyFeeZar),
      },
      success_url: `${appUrl}/onboard/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/onboard/cancelled`,
    })

    if (!session.url) return { error: 'Stripe did not return a checkout URL.' }
    return { checkoutUrl: session.url }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to create checkout session.' }
  }
}
