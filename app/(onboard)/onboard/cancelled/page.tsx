// app/(onboard)/onboard/cancelled/page.tsx
//
// Rendering:  Server component (static).
// Shown when user cancels or abandons Stripe Checkout.
// Account + company already created — user can go back and retry payment.

import Link from 'next/link'

export const metadata = {
  title: 'Payment cancelled — Tapley Connect',
}

export default function OnboardCancelledPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Icon */}
      <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-[40px] text-amber-500">payment</span>
      </div>

      <h1 className="text-3xl font-bold font-jakarta text-slate-900 mb-3">
        Payment cancelled
      </h1>

      <p className="text-slate-500 text-base max-w-md mb-2">
        No charge was made. Your account and branding settings have been saved.
      </p>

      <p className="text-slate-500 text-sm max-w-sm mb-8">
        When you're ready, click below to complete your setup.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/onboard"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to setup
        </Link>

        <a
          href="mailto:hello@tapleyconnect.co.za"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          Contact us
        </a>
      </div>

      <p className="text-xs text-slate-400 mt-8">
        Prefer to pay by EFT or need a quote?{' '}
        <a href="mailto:hello@tapleyconnect.co.za" className="underline text-slate-500">
          Get in touch
        </a>{' '}
        and we'll sort you out.
      </p>
    </div>
  )
}
