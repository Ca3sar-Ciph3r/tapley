// lib/payfast/build-payment.ts
//
// High-level PayFast payment builders for the billing flow.
//
// buildSetupFeePayment() — generates the form data for the initial onboarding
// setup fee + recurring subscription. The notify_url always points to the
// canonical ITN handler at /api/billing/payfast-itn.
//
// Plan limits (PLAN_MAX_CARDS):
//   starter    →  10 cards
//   growth     →  50 cards
//   enterprise → 500 cards
//
// Monthly rates (PLAN_MONTHLY_ZAR):
//   These are the recurring amounts charged by PayFast after the setup fee.
//   Adjust here when pricing changes — do NOT hardcode in components.

import { buildPayFastPaymentForm, nextMonthBillingDate } from './buildPaymentForm'
import type { PayFastFormData } from './buildPaymentForm'

export const PLAN_MAX_CARDS: Record<string, number> = {
  starter:    10,
  growth:     50,
  enterprise: 500,
}

export const PLAN_MONTHLY_ZAR: Record<string, number> = {
  starter:    490,
  growth:     990,
  enterprise: 2490,
}

export const PLAN_SETUP_FEE_ZAR: Record<string, number> = {
  starter:    2500,
  growth:     4500,
  enterprise: 9500,
}

export type SetupFeeCompany = {
  id:               string
  subscription_plan: string
  billing_email:    string
  name:             string
}

export type SetupFeeAdmin = {
  firstName: string
  lastName:  string
  email:     string
}

export function buildSetupFeePayment(
  company: SetupFeeCompany,
  admin: SetupFeeAdmin,
): PayFastFormData {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleys.co.za'
  const plan     = company.subscription_plan ?? 'starter'
  const maxCards = PLAN_MAX_CARDS[plan] ?? 10
  const monthly  = PLAN_MONTHLY_ZAR[plan] ?? 490
  const setupFee = PLAN_SETUP_FEE_ZAR[plan] ?? 2500

  return buildPayFastPaymentForm({
    companyId:      company.id,
    paymentType:    'onboarding',
    adminFirstName: admin.firstName,
    adminLastName:  admin.lastName,
    adminEmail:     admin.email,
    setupFeeZar:    setupFee,
    itemName:       `Tapley Connect Setup Fee — ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
    customStr3:     plan,
    customStr4:     String(maxCards),
    customStr5:     String(monthly),
    returnUrl:      `${appUrl}/onboard/success`,
    cancelUrl:      `${appUrl}/onboard/cancelled`,
    notifyUrl:      `${appUrl}/api/billing/payfast-itn`,
    subscription: {
      recurringAmountZar: monthly,
      billingDate:        nextMonthBillingDate(),
      frequency:          3,
      cycles:             0,
    },
  })
}
