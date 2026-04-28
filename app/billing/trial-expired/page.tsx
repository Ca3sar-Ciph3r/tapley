'use client'

// app/billing/trial-expired/page.tsx
//
// Shown when subscription_status = 'trial' AND trial_ends_at < now().

import Link from 'next/link'

export default function BillingTrialExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center space-y-5">
        <div className="flex justify-center">
          <span className="material-symbols-outlined text-[48px] text-slate-400">timer_off</span>
        </div>
        <h1 className="text-2xl font-extrabold font-jakarta text-slate-900">Trial ended</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your free trial has expired. Upgrade to a paid plan to continue managing your
          digital business cards and viewing analytics.
        </p>
        <Link
          href="/onboard/payment"
          className="block w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold text-center transition-colors shadow-sm"
        >
          Choose a plan and pay
        </Link>
        <p className="text-xs text-slate-400">
          Questions?{' '}
          <a href="mailto:support@tapleys.co.za" className="underline hover:text-slate-600">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
