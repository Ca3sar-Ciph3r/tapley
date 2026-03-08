'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }

      const role = data.user?.user_metadata?.role

      if (role === 'operator') {
        router.push('/operator')
      } else if (role === 'owner') {
        const slug = data.user?.user_metadata?.business_slug
        router.push(`/dashboard/${slug ?? ''}`)
      } else {
        setError('Your account does not have access. Contact support.')
        await supabase.auth.signOut()
        setLoading(false)
      }
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

        {/* Form */}
        <div className="rounded-3xl bg-white p-8 shadow-sm border border-[#E7E5E4]">
          <h1 className="text-xl font-bold text-[#1A1A1A] mb-6">Sign in</h1>

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#A7A3A8] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-[#F7F7F5] px-5 py-4 text-base font-semibold text-[#1A1A1A] border-0 focus:ring-2 focus:ring-[#1A1A1A] focus:outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
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
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>
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
