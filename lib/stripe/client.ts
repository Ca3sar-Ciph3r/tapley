// lib/stripe/client.ts
//
// Lazy Stripe singleton — server-only.
// Never import this in client components or expose to the browser.
//
// Usage:
//   import { getStripe } from '@/lib/stripe/client'
//   const stripe = getStripe()
//
// SA-specific setup:
//   - Currency: ZAR
//   - Collection method: send_invoice (EFT-friendly — Stripe sends a PDF invoice)
//   - Stripe ZAR support: https://stripe.com/docs/currencies
//
// Required env vars (set in .env.local and Vercel):
//   STRIPE_SECRET_KEY         — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET     — whsec_... (from Stripe dashboard webhook config)
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — pk_live_... (safe to expose)

import Stripe from 'stripe'

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2025-03-31.basil',
      typescript: true,
    })
  }
  return stripeInstance
}
