// app/(auth)/reset-password/page.tsx
//
// Handles Supabase password recovery flow.
// Supabase sends the user here after they click the reset link in their email.
// The URL hash contains access_token + type=recovery.
// Supabase's onAuthStateChange fires a PASSWORD_RECOVERY event which we use
// to show the new password form. After update, redirect to /dashboard.

'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type PageState = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()

    // Supabase fires PASSWORD_RECOVERY when it detects type=recovery in the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('form')
      }
    })

    // Fallback: if already in a recovery session (page reload), show form
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && pageState === 'loading') {
        setPageState('form')
      } else if (!session && pageState === 'loading') {
        // Give onAuthStateChange a moment to fire before declaring invalid
        setTimeout(() => {
          setPageState(prev => prev === 'loading' ? 'invalid' : prev)
        }, 2000)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.')
        return
      }

      setPageState('success')
      setTimeout(() => router.push('/dashboard'), 2000)
    })
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Dark brand panel (hidden on mobile) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#16181D] px-12 py-16">
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
                  <svg className="h-3 w-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-slate-300 text-base">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-slate-600 text-sm">
          © {new Date().getFullYear()} Digital Native Agency
        </p>
      </div>

      {/* ── Right: Form panel ─────────────────────────────────────────────────── */}
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

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="text-center space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-slate-500">Verifying your reset link…</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {pageState === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Link expired</h2>
              <p className="text-sm text-slate-500">
                This password reset link has expired or already been used. Please request a new one.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto">
                <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Password updated</h2>
              <p className="text-sm text-slate-500">Redirecting you to your dashboard…</p>
            </div>
          )}

          {/* New password form */}
          {pageState === 'form' && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">Set new password</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isPending}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={isPending}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-60 text-sm"
                  />
                </div>

                {error && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || !password || !confirm}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                >
                  {isPending ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
