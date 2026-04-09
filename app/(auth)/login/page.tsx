// app/(auth)/login/page.tsx
//
// Rendering:  Client component — form state and auth interaction
// Auth:       If already logged in, middleware redirects to /dashboard before this renders.
// After login: Browser calls Supabase directly, then router.push('/dashboard').
//              dashboard/page.tsx handles role routing:
//              super_admin → /admin
//              company_admin → /dashboard/cards
//              staff → /dashboard/my-card
//
// No "Sign up" link — accounts are created by invitation only.
// No "Forgot password" in MVP — Luke resets manually via Supabase dashboard.

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    setError('')

    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        if (
          authError.message.includes('Invalid login credentials') ||
          authError.message.includes('invalid_credentials')
        ) {
          setError('Incorrect email or password. Please try again.')
        } else if (
          authError.message.includes('Email not confirmed') ||
          authError.message.includes('email_not_confirmed')
        ) {
          setError('Please confirm your email address before signing in.')
        } else if (authError.message.includes('Too many requests')) {
          setError('Too many sign-in attempts. Please wait a moment and try again.')
        } else {
          setError('Something went wrong. Please try again.')
        }
        return
      }

      // Success — let dashboard/page.tsx handle the role-based redirect
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Dark brand panel (hidden on mobile) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#16181D] px-12 py-16">
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">
              Tapley Connect
            </span>
          </div>
        </div>

        {/* Headline + feature bullets */}
        <div className="space-y-10">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Every tap.{' '}
            <span className="text-teal-400">Every scan.</span>
            <br />
            Every lead — tracked.
          </h1>

          <ul className="space-y-4">
            {[
              'Branded digital cards for your entire team',
              'Every tap and scan tracked in real time',
              'Update staff details in seconds — no reprinting',
            ].map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-teal-500/20 flex items-center justify-center">
                  <svg
                    className="h-3 w-3 text-teal-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </span>
                <span className="text-slate-300 text-base">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-sm">
          © {new Date().getFullYear()} Digital Native Agency
        </p>
      </div>

      {/* ── Right: Login form ──────────────────────────────────────────────────── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-slate-50 px-6 py-16 sm:px-12">
        {/* Mobile-only logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="h-8 w-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">TC</span>
          </div>
          <span className="text-slate-800 font-semibold text-lg tracking-tight">
            Tapley Connect
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter your credentials to access your dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                placeholder="you@company.com"
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                placeholder="••••••••"
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
              >
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || !email || !password}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Access is by invitation only. Contact your administrator for help.
          </p>
        </div>
      </div>
    </div>
  )
}
