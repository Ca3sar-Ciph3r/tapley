'use client'

// app/billing/reactivate/page.tsx
//
// Shown when subscription_status = 'cancelled'.

import Link from 'next/link'

export default function BillingReactivatePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center space-y-5">
        <div className="flex justify-center">
          <span className="material-symbols-outlined text-[48px] text-amber-400">cancel</span>
        </div>
        <h1 className="text-2xl font-extrabold font-jakarta text-slate-900">Subscription cancelled</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your Tapley Connect subscription has been cancelled. Reactivate to restore access to
          your digital card dashboard and analytics.
        </p>
        <a
          href="mailto:support@tapleys.co.za?subject=Reactivate%20Tapley%20Connect"
          className="block w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold text-center transition-colors shadow-sm"
        >
          Contact us to reactivate
        </a>
        <p className="text-xs text-slate-400">
          Or{' '}
          <Link href="/onboard" className="underline hover:text-slate-600">
            start a new subscription
          </Link>
        </p>
      </div>
    </div>
  )
}
