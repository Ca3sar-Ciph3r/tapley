// lib/payfast/config.ts
//
// PayFast configuration — server-only.
// All values read from environment variables at runtime.
// NEVER import this in client components.

export const PAYFAST_MERCHANT_ID  = process.env.PAYFAST_MERCHANT_ID  ?? ''
export const PAYFAST_MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY ?? ''
export const PAYFAST_PASSPHRASE   = process.env.PAYFAST_PASSPHRASE   ?? ''

// Set PAYFAST_SANDBOX=true for testing; leave unset or false for production.
export const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX === 'true'

export const PAYFAST_URL = PAYFAST_SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process'

// Source IPs that PayFast ITN callbacks originate from.
// Used to reject forged ITN requests in production.
export const PAYFAST_VALID_IPS = [
  '197.97.145.144',
  '197.97.145.145',
  '197.97.145.146',
  '197.97.145.147',
  '41.74.179.194',
  '41.74.179.196',
]
