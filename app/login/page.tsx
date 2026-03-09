'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`,
        },
      })

      if (authError) {
        setError('Failed to send link. Please try again.')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A1A]">
              <span className="text-base font-black text-white">T</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-[#1A1A1A]">tapley</span>
          </div>
          <p className="text-sm text-[#A7A3A8]">Business dashboard login</p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-sm border border-[#E7E5E4]">
          {sent ? (
            <div className="text-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 mx-auto mb-4">
                <span className="material-symbols-outlined text-green-600" style={{ fontSize: '28px' }}>mark_email_read</span>
              </div>
              <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">Check your inbox</h1>
              <p className="text-sm text-[#A7A3A8]">
                We sent a sign-in link to<br />
                <span className="font-semibold text-[#1A1A1A]">{email}</span>
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-6 text-sm font-semibold text-[#6D28F5] hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">Sign in</h1>
              <p className="text-sm text-[#A7A3A8] mb-6">We'll send you a magic link — no password needed.</p>

              <form onSubmit={handleSendLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#A7A3A8] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl bg-[#F7F7F5] px-5 py-4 text-base font-semibold text-[#1A1A1A] border-0 focus:ring-2 focus:ring-[#1A1A1A] focus:outline-none"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[999px] bg-[#1A1A1A] py-4 text-sm font-extrabold uppercase tracking-wide text-white transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
                >
                  {loading ? 'Sending...' : 'SEND MAGIC LINK'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#A7A3A8]">
          Problems logging in? Contact{' '}
          <a href="mailto:luke@tapley.co.za" className="underline font-semibold">
            luke@tapley.co.za
          </a>
        </p>
      </div>
    </div>
  )
}
