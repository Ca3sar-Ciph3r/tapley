'use server'

// lib/actions/payfast-billing.ts
//
// Server actions for PayFast billing operations within the dashboard.
//
// createAdditionalCardsParams()
//   Called from /dashboard/billing/add-cards.
//   Verifies the user is a company admin, calculates pricing for the additional
//   card slots, and returns a signed PayFast form ready for auto-submission.
//   The pricing uses the tier that matches the NEW total card count, so companies
//   crossing a tier boundary automatically get the lower per-card rate.

import { createClient }     from '@/lib/supabase/server'
import { supabaseAdmin }    from '@/lib/supabase/admin'
import { getTierForCardCount } from '@/lib/utils/pricing'
import { buildPayFastPaymentForm, nextMonthBillingDate } from '@/lib/payfast/buildPaymentForm'
import type { PayFastFormData } from '@/lib/payfast/buildPaymentForm'

// ---------------------------------------------------------------------------
// createAdditionalCardsParams
// ---------------------------------------------------------------------------

export type CreateAdditionalCardsInput = {
  companyId:       string
  additionalCards: number   // how many new slots the admin wants to buy
}

export type CreateAdditionalCardsResult = {
  formData?:         PayFastFormData
  setupFeeZar?:      number
  newMonthlyZar?:    number
  newTotalCards?:    number
  error?: string
}

export async function createAdditionalCardsParams(
  input: CreateAdditionalCardsInput,
): Promise<CreateAdditionalCardsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Verify the user is an admin for this company
  const { data: adminRow } = await supabaseAdmin
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', input.companyId)
    .single()

  if (!adminRow) return { error: 'Access denied.' }

  if (input.additionalCards < 1) {
    return { error: 'Please select at least 1 additional card slot.' }
  }

  // Fetch company details needed for pricing and the PayFast form
  const adminAny = supabaseAdmin as unknown as {
    from(t: string): {
      select(cols: string): {
        eq(col: string, val: string): {
          single(): Promise<{
            data: {
              max_staff_cards: number
              subscription_plan: string
              payfast_subscription_token: string | null
              primary_contact_email: string | null
              primary_contact_name: string | null
            } | null
            error: unknown
          }>
        }
      }
    }
  }

  const { data: company, error: companyError } = await adminAny
    .from('companies')
    .select('max_staff_cards, subscription_plan, payfast_subscription_token, primary_contact_email, primary_contact_name')
    .eq('id', input.companyId)
    .single()

  if (companyError || !company) return { error: 'Company not found.' }
  if (!company.payfast_subscription_token) {
    return { error: 'No active PayFast subscription found. Please contact support.' }
  }

  const isQrDigital = company.subscription_plan === 'qr_digital'
  const currentMax  = company.max_staff_cards
  const newTotal    = currentMax + input.additionalCards

  // Determine tier based on new total (may be lower per-card rate if crossing tier boundary)
  let tier
  try {
    tier = getTierForCardCount(newTotal, isQrDigital)
  } catch {
    return { error: `Cannot add cards: ${newTotal} cards exceeds the maximum for your plan type.` }
  }

  const setupFeeZar   = input.additionalCards * tier.setupFeeZar
  const newMonthlyZar = newTotal * tier.monthlyRateZar

  if (setupFeeZar <= 0) {
    return { error: 'No setup fee applies for this plan type.' }
  }

  const appUrl        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const adminName     = company.primary_contact_name ?? ''
  const [firstName, ...rest] = adminName.split(' ')
  const lastName      = rest.join(' ') || ''
  const adminEmail    = company.primary_contact_email ?? ''

  // custom_str layout (additional_cards):
  //   str3 = additionalCards, str4 = newTotal, str5 = newMonthlyZar
  const formData = buildPayFastPaymentForm({
    companyId:      input.companyId,
    paymentType:    'additional_cards',
    adminFirstName: firstName,
    adminLastName:  lastName,
    adminEmail,
    setupFeeZar,
    itemName:       `Tapley Connect — ${input.additionalCards} additional card slot${input.additionalCards > 1 ? 's' : ''}`,
    customStr3:     String(input.additionalCards),
    customStr4:     String(newTotal),
    customStr5:     String(newMonthlyZar),
    returnUrl:      `${appUrl}/dashboard/billing?added=${input.additionalCards}`,
    cancelUrl:      `${appUrl}/dashboard/billing/add-cards`,
    notifyUrl:      `${appUrl}/api/webhooks/payfast`,
    // No subscription field — this is a one-time charge; the subscription is
    // updated via the PayFast API in the ITN handler after payment completes.
  })

  return { formData, setupFeeZar, newMonthlyZar, newTotalCards: newTotal }
}

// ---------------------------------------------------------------------------
// getCompanyBillingInfo
//
// Fetches the data the add-cards page needs to show the pricing calculator.
// ---------------------------------------------------------------------------

export type CompanyBillingInfo = {
  maxStaffCards:     number
  subscriptionPlan:  string
  monthlyRateZar:    number
  hasSubscription:   boolean
}

export async function getCompanyBillingInfo(
  companyId: string,
): Promise<{ info?: CompanyBillingInfo; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRow } = await supabaseAdmin
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single()

  if (!adminRow) return { error: 'Access denied.' }

  const adminAny = supabaseAdmin as unknown as {
    from(t: string): {
      select(cols: string): {
        eq(col: string, val: string): {
          single(): Promise<{
            data: {
              max_staff_cards: number
              subscription_plan: string
              monthly_rate_override: number | null
              payfast_subscription_token: string | null
            } | null
            error: unknown
          }>
        }
      }
    }
  }

  const { data: company } = await adminAny
    .from('companies')
    .select('max_staff_cards, subscription_plan, monthly_rate_override, payfast_subscription_token')
    .eq('id', companyId)
    .single()

  if (!company) return { error: 'Company not found.' }

  const isQrDigital = company.subscription_plan === 'qr_digital'
  let monthlyRateZar = 0
  try {
    const tier = getTierForCardCount(company.max_staff_cards, isQrDigital)
    monthlyRateZar = tier.monthlyRateZar
  } catch { /* ignore */ }

  return {
    info: {
      maxStaffCards:    company.max_staff_cards,
      subscriptionPlan: company.subscription_plan,
      monthlyRateZar:   company.monthly_rate_override ?? monthlyRateZar,
      hasSubscription:  !!company.payfast_subscription_token,
    },
  }
}
