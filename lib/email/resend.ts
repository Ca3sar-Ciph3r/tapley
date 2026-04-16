// lib/email/resend.ts
//
// Resend email client — single shared instance.
// Used by lib/email/onboarding.ts and lib/actions/analytics.ts.
//
// RESEND_API_KEY must be set in environment variables.
// Never expose to the browser — server-side only.

import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY not configured')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_ADDRESS = 'Tapley Connect <hello@tapleyconnect.co.za>'
