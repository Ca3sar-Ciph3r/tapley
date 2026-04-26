// lib/payfast/buildPaymentForm.ts
//
// Builds PayFast hidden-field form data for payment + optional subscription creation.
// Server-only — imports crypto via signature.ts.
//
// custom_str field layout (same for all payment types):
//   custom_str1 = companyId          — used by ITN handler to resolve the company
//   custom_str2 = payment type       — 'onboarding' | 'additional_cards'
//   custom_str3 = planName or count  — planName for onboarding; additionalCardCount for add-cards
//   custom_str4 = cardCount or total — total card count for both flows
//   custom_str5 = newMonthlyZar      — new monthly total after this payment (for subscription update)
//
// Field order matters: signature is generated over fields in insertion order,
// and the browser submits hidden inputs in DOM order. Both must match.

import {
  PAYFAST_MERCHANT_ID,
  PAYFAST_MERCHANT_KEY,
  PAYFAST_PASSPHRASE,
  PAYFAST_URL,
} from './config'
import { generatePayFastSignature } from './signature'

export type PayFastFormField = { name: string; value: string }

export type PayFastFormData = {
  action: string
  fields: PayFastFormField[]
}

export type PayFastSubscriptionOptions = {
  recurringAmountZar: number  // monthly amount
  billingDate: string         // YYYY-MM-DD — date of first recurring charge
  frequency?: number          // default 3 (monthly)
  cycles?: number             // default 0 (infinite)
}

type BuildPaymentFormInput = {
  // Payment details
  companyId:      string
  paymentType:    'onboarding' | 'additional_cards'
  adminFirstName: string
  adminLastName:  string
  adminEmail:     string
  setupFeeZar:    number
  itemName:       string

  // custom_str3 — planName for onboarding, additionalCardCount (string) for add-cards
  customStr3: string
  // custom_str4 — total card count (string)
  customStr4: string
  // custom_str5 — new monthly total in ZAR (string)
  customStr5: string

  returnUrl:  string
  cancelUrl:  string
  notifyUrl:  string

  // Include these to create a PayFast subscription at the same time as the setup fee charge
  subscription?: PayFastSubscriptionOptions
}

export function buildPayFastPaymentForm(input: BuildPaymentFormInput): PayFastFormData {
  // m_payment_id must be unique per attempt and ≤20 chars.
  // We keep companyId in custom_str1 for ITN lookup — m_payment_id is just a reference.
  const mPaymentId = `tc${Date.now().toString(36)}`

  const amount = input.setupFeeZar.toFixed(2)

  const params: Record<string, string> = {
    merchant_id:   PAYFAST_MERCHANT_ID,
    merchant_key:  PAYFAST_MERCHANT_KEY,
    return_url:    input.returnUrl,
    cancel_url:    input.cancelUrl,
    notify_url:    input.notifyUrl,
    name_first:    input.adminFirstName,
    name_last:     input.adminLastName,
    email_address: input.adminEmail,
    m_payment_id:  mPaymentId,
    amount,
    item_name:     input.itemName,
    custom_str1:   input.companyId,
    custom_str2:   input.paymentType,
    custom_str3:   input.customStr3,
    custom_str4:   input.customStr4,
    custom_str5:   input.customStr5,
  }

  // Subscription fields — appended after custom strings so PayFast parses them in order
  if (input.subscription) {
    params['subscription_type']  = '1'
    params['billing_date']       = input.subscription.billingDate
    params['recurring_amount']   = input.subscription.recurringAmountZar.toFixed(2)
    params['frequency']          = String(input.subscription.frequency ?? 3)
    params['cycles']             = String(input.subscription.cycles ?? 0)
  }

  const signature = generatePayFastSignature(params, PAYFAST_PASSPHRASE)

  return {
    action: PAYFAST_URL,
    fields: [
      ...Object.entries(params).map(([name, value]) => ({ name, value })),
      { name: 'signature', value: signature },
    ],
  }
}

// ---------------------------------------------------------------------------
// Helper: billing date = 1 month from today (YYYY-MM-DD)
// Used by callers that create subscriptions during onboarding.
// ---------------------------------------------------------------------------

export function nextMonthBillingDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}
