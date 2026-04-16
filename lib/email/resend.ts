// lib/email/resend.ts
//
// Resend email client — lazy singleton.
// Used by lib/email/onboarding.ts and lib/actions/analytics.ts.
//
// RESEND_API_KEY must be set in environment variables.
// Never expose to the browser — server-side only.
//
// The client is initialised on first use (not at module load time) so that
// missing the env var does not crash Next.js during build-time page collection.

import { Resend } from 'resend'

export const FROM_ADDRESS = 'Tapley Connect <hello@tapleyconnect.co.za>'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY not configured')
    _resend = new Resend(apiKey)
  }
  return _resend
}
