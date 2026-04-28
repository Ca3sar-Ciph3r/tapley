// Shared wrapper for all onboard step pages.
// Renders the sticky header and trust footer around the wizard content.

export function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">TC</span>
          </div>
          <span className="font-jakarta font-bold text-slate-900 text-sm">Tapley Connect</span>
        </div>
        <a
          href="mailto:hello@tapleyconnect.co.za"
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          Need help? Get in touch
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-2xl">
          {children}
          <p className="text-center text-xs text-slate-400 mt-6">
            Your data is stored securely in South Africa and protected under POPIA.
            Payments processed by PayFast — we never store your card details.
          </p>
        </div>
      </main>
    </div>
  )
}
