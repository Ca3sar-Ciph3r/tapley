'use client'

// app/(onboard)/onboard/success/page.tsx
//
// Shown after PayFast redirects back (return_url) following payment.
// Polls /api/billing/status?company_id=[id] every 3 seconds.
//
// company_id is passed via query string: /onboard/success?company_id=[uuid]
// It is set in createPayFastSetupFeeParams() → returnUrl.
//
// States:
//   polling   — spinner, "Activating your account…"
//   active    — payment confirmed, show "Go to Dashboard" button
//   timeout   — 60 s elapsed without active, show "we'll email you" message
//   no_id     — company_id missing from URL (fallback — shouldn't happen)
//
// useSearchParams() requires a Suspense wrapper — SuccessContent is the inner
// component; OnboardSuccessPage is the outer boundary export.

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams }                        from 'next/navigation'
import Link                                       from 'next/link'

type PollState = 'polling' | 'active' | 'timeout' | 'no_id'

const POLL_INTERVAL_MS = 3_000
const TIMEOUT_MS       = 60_000

// ---------------------------------------------------------------------------
// Inner component — uses useSearchParams
// ---------------------------------------------------------------------------

function SuccessContent() {
  const params    = useSearchParams()
  const companyId = params.get('company_id')

  const [state, setState] = useState<PollState>(companyId ? 'polling' : 'no_id')
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!companyId) return

    let cancelled = false

    async function poll() {
      if (cancelled) return
      try {
        const res  = await fetch(`/api/billing/status?company_id=${companyId}`)
        const json = await res.json() as { status?: string }
        if (json.status === 'active') {
          setState('active')
          return
        }
      } catch {
        // network error — keep polling
      }
      if (!cancelled) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    timeoutRef.current = setTimeout(() => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      setState(prev => prev === 'polling' ? 'timeout' : prev)
    }, TIMEOUT_MS)

    poll()

    return () => {
      cancelled = true
      if (timerRef.current)   clearTimeout(timerRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [companyId])

  // ── no company_id in URL ─────────────────────────────────────────────────
  if (state === 'no_id') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-6">
          <CheckmarkSVG />
        </div>
        <h1 className="text-3xl font-bold font-jakarta text-slate-900 mb-3">Payment received!</h1>
        <p className="text-slate-500 text-sm max-w-sm mb-8">
          Your account is being activated. Check your inbox for a welcome email.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    )
  }

  // ── polling ──────────────────────────────────────────────────────────────
  if (state === 'polling') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-6">
          <CheckmarkSVG />
        </div>
        <h1 className="text-3xl font-bold font-jakarta text-slate-900 mb-3">Payment received.</h1>
        <p className="text-slate-600 text-base max-w-sm mb-2">Setting up your account…</p>
        <div className="flex items-center gap-2 text-slate-400 text-sm mt-2">
          <SpinnerSVG />
          <span>This usually takes less than a minute</span>
        </div>
      </div>
    )
  }

  // ── timeout ──────────────────────────────────────────────────────────────
  if (state === 'timeout') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold font-jakarta text-slate-900 mb-3">Taking longer than expected</h1>
        <p className="text-slate-500 text-base max-w-md mb-6">
          Your payment was received. We'll send a confirmation email once your account is active — usually within 5 minutes.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          Try Dashboard anyway
        </Link>
        <p className="text-xs text-slate-400 mt-4">
          Questions?{' '}
          <a href="mailto:hello@tapleyconnect.co.za" className="underline text-slate-500">
            hello@tapleyconnect.co.za
          </a>
        </p>
      </div>
    )
  }

  // ── active ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-6">
        <CheckmarkSVG />
      </div>

      <h1 className="text-3xl font-bold font-jakarta text-slate-900 mb-3">Your account is ready!</h1>

      <p className="text-slate-500 text-base max-w-md mb-2">
        Welcome to Tapley Connect. Your dashboard is live and your team cards are ready to configure.
      </p>
      <p className="text-slate-400 text-sm max-w-sm mb-8">
        Check your inbox for a welcome email with everything you need to get started.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full text-left mb-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">What happens next</p>
        <div className="space-y-3">
          {[
            { icon: 'mark_email_read', text: 'Welcome email sent to your inbox' },
            { icon: 'group_add',       text: 'Add your team in the dashboard' },
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
        Questions?{' '}
        <a href="mailto:hello@tapleyconnect.co.za" className="underline text-slate-500">
          hello@tapleyconnect.co.za
        </a>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export — wraps SuccessContent in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function OnboardSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <SpinnerSVG />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function CheckmarkSVG() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SpinnerSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
