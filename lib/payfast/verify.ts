// lib/payfast/verify.ts
//
// Full 3-step PayFast ITN (Instant Transaction Notification) verification.
//
// Step 1 — Signature: rebuild MD5 signature from raw body (excluding 'signature' field).
//           Must match the 'signature' field PayFast sent.
//
// Step 2 — IP allowlist: reject if the request did not originate from a known
//           PayFast IP address. Skipped in sandbox mode.
//
// Step 3 — PayFast validation: POST the raw body to PayFast's /eng/query/validate
//           endpoint. PayFast responds with 'VALID' if the payment is genuine.
//
// Returns true only if ALL three steps pass.
// On any network failure in step 3 returns false (fail-safe).

import { PAYFAST_VALID_IPS, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX } from './config'
import { verifyPayFastSignature } from './signature'

const PAYFAST_VALIDATE_URL = PAYFAST_SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/query/validate'
  : 'https://www.payfast.co.za/eng/query/validate'

export async function verifyITN(
  rawBody: string,
  clientIp?: string,
): Promise<boolean> {
  // Step 1: Signature verification
  if (!verifyPayFastSignature(rawBody, PAYFAST_PASSPHRASE)) {
    return false
  }

  // Step 2: IP allowlist (production only)
  if (!PAYFAST_SANDBOX) {
    if (!clientIp || !PAYFAST_VALID_IPS.includes(clientIp)) {
      return false
    }
  }

  // Step 3: PayFast server-side validation
  try {
    const res = await fetch(PAYFAST_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    })
    const text = await res.text()
    return text.trim() === 'VALID'
  } catch {
    return false
  }
}
