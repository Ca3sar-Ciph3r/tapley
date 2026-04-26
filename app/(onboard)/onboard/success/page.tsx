// app/(onboard)/onboard/success/page.tsx
//
// Rendering:  Server component (static OK — no personalised data needed).
// Shown after PayFast redirects back on successful payment (return_url).
// The actual activation is handled asynchronously by /api/webhooks/payfast (ITN).

import Link from 'next/link'

export const metadata = {
  title: 'Welcome to Tapley Connect!',
}

export default function OnboardSuccessPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold font-jakarta text-slate-900 mb-3">
        You're all set!
      </h1>

      <p className="text-slate-500 text-base max-w-md mb-2">
        Payment received. We're activating your account now — this usually takes less than a minute.
      </p>

      <p className="text-slate-500 text-sm max-w-sm mb-8">
        Check your inbox for a welcome email with your dashboard link and next steps.
      </p>

      {/* What happens next */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-left mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">What happens next</p>
        <div className="space-y-3">
          {[
            { icon: 'mark_email_read', text: 'Welcome email sent to your inbox' },
            { icon: 'group_add',       text: 'Add your team members in the dashboard' },
            { icon: 'style',           text: 'NFC cards printed and shipped within 5 business days' },
            { icon: 'nfc',             text: 'Assign cards to team members when they arrive' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-teal-600 flex-shrink-0">{icon}</span>
              <p className="text-sm text-slate-700">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">dashboard</span>
        Go to my Dashboard
      </Link>

      <p className="text-xs text-slate-400 mt-6">
        Questions? Email us at{' '}
        <a href="mailto:hello@tapleyconnect.co.za" className="underline text-slate-500">
          hello@tapleyconnect.co.za
        </a>
      </p>
    </div>
  )
}
