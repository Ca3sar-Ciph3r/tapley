'use client'

// app/billing/suspended/page.tsx
//
// Shown when subscription_status = 'suspended' (payment overdue by >30 days).

export default function BillingSuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8 text-center space-y-5">
        <div className="flex justify-center">
          <span className="material-symbols-outlined text-[48px] text-orange-400">block</span>
        </div>
        <h1 className="text-2xl font-extrabold font-jakarta text-slate-900">Account suspended</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Your account has been suspended due to an outstanding balance. Your card pages remain
          live, but dashboard access is restricted until payment is resolved.
        </p>
        <a
          href="mailto:support@tapleys.co.za?subject=Account%20Suspended%20-%20Tapley%20Connect"
          className="block w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold text-center transition-colors shadow-sm"
        >
          Contact support to resolve
        </a>
        <p className="text-xs text-slate-400">
          Reference your company name in your email so we can assist you quickly.
        </p>
      </div>
    </div>
  )
}
