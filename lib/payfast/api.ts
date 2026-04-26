// lib/payfast/api.ts
//
// PayFast Subscription Management API client — server-only.
// Used to update recurring amounts when a company adds card slots.
//
// Authentication:
//   Every request needs four headers: merchant-id, version, timestamp, signature.
//   Signature = MD5 of all headers + body params sorted alphabetically,
//   with passphrase appended before hashing (PHP urlencode semantics, same as forms).
//
// Docs: https://developers.payfast.co.za/api#subscriptions
//
// Endpoints used:
//   PATCH /subscriptions/{token}/update  — update recurring_amount

import { createHash } from 'crypto'
import {
  PAYFAST_MERCHANT_ID,
  PAYFAST_PASSPHRASE,
  PAYFAST_SANDBOX,
} from './config'

const PAYFAST_API_BASE = 'https://api.payfast.co.za'

// ---------------------------------------------------------------------------
// Signature generation for API calls
//
// PayFast API signature = MD5 of:
//   {all_params_sorted_alpha}&passphrase={passphrase}
// where all_params includes both header params (merchant-id, timestamp, version)
// and body params (e.g. recurring_amount).
// ---------------------------------------------------------------------------

function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function buildApiSignature(
  headerParams: Record<string, string>,
  bodyParams: Record<string, string>,
): string {
  const all: Record<string, string> = { ...headerParams, ...bodyParams }

  const str = Object.entries(all)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`)
    .join('&')
    + `&passphrase=${phpUrlencode(PAYFAST_PASSPHRASE)}`

  return createHash('md5').update(str).digest('hex')
}

// ---------------------------------------------------------------------------
// updateSubscriptionAmount
//
// Updates the recurring_amount on an existing PayFast subscription.
// Called from the additional-cards ITN handler after max_staff_cards is bumped.
//
// amountZar — the new monthly total in rands (e.g. 1780.00)
// token      — the payfast_subscription_token stored on the companies row
// ---------------------------------------------------------------------------

export async function updateSubscriptionAmount(
  token: string,
  amountZar: number,
): Promise<{ error?: string }> {
  if (!token) return { error: 'No subscription token — cannot update.' }
  if (!PAYFAST_MERCHANT_ID || !PAYFAST_PASSPHRASE) {
    return { error: 'PayFast credentials not configured.' }
  }

  const timestamp = new Date().toISOString().slice(0, 19)
  const version   = 'v1'

  // Amount in cents (PayFast API uses integer cents)
  const amountCents = String(Math.round(amountZar * 100))

  const headerParams: Record<string, string> = {
    'merchant-id': PAYFAST_MERCHANT_ID,
    timestamp,
    version,
  }
  const bodyParams: Record<string, string> = {
    recurring_amount: amountCents,
  }

  const signature = buildApiSignature(headerParams, bodyParams)

  const url = `${PAYFAST_API_BASE}/subscriptions/${token}/update${PAYFAST_SANDBOX ? '?testing=true' : ''}`

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'merchant-id': PAYFAST_MERCHANT_ID,
        version,
        timestamp,
        signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(bodyParams).toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: `PayFast API error ${res.status}: ${text}` }
    }

    return {}
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'PayFast API request failed.' }
  }
}
