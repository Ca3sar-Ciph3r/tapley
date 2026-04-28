'use client'

// app/billing/retry/page.tsx
//
// Shown when subscription_status = 'payment_failed'.
// Lets the admin retry payment by going back to the PayFast onboarding step.

import Link from 'next/link'

export default function BillingRetryPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center space-y-5">
        <div className="flex justify-center">
          <span className="material-symbols-outlined text-[48px] text-red-400">payment</span>
        </div>
        <h1 className="text-2xl font-extrabold font-jakarta text-slate-900">Payment failed</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          We could not process your most recent payment. Please update your payment method to
          restore access to your dashboard.
        </p>
        <Link
          href="/onboard/payment"
          className="block w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold text-center transition-colors shadow-sm"
        >
          Retry payment
        </Link>
        <p className="text-xs text-slate-400">
          Need help?{' '}
          <a href="mailto:support@tapleys.co.za" className="underline hover:text-slate-600">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
