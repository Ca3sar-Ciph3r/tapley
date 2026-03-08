'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Business, Tier } from '@/types/database'

export default function RegisterForm({
  cardUuid,
  business,
  firstTier,
}: {
  cardUuid: string
  business: Business
  firstTier: Tier | null
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [phone, setPhone] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim()) {
      setError('Please enter your first name.')
      return
    }
    if (!phone.trim()) {
      setError('Please enter your WhatsApp number.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_uuid: cardUuid,
          first_name: firstName.trim(),
          whatsapp_number: phone.trim(),
          whatsapp_opt_in: optIn,
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      router.replace(json.data.redirect)
    } catch {
      setError('Could not connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F5] pb-8 overflow-y-auto no-scrollbar max-w-[390px] mx-auto">
      {/* Header */}
      <header className="flex items-center p-6 pb-2">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-[#E7E5E4]"
          aria-label="Go back"
        >
          <span className="material-symbols-outlined text-[#1A1A1A]" style={{ fontSize: '20px' }}>
            arrow_back
          </span>
        </button>
        <h2 className="flex-1 text-center text-base font-bold tracking-tight pr-10">
          Registration
        </h2>
      </header>

      <div className="px-5 py-4">
        {/* Hero card */}
        <div
          className="relative flex min-h-[240px] flex-col justify-end overflow-hidden rounded-3xl shadow-xl"
          style={{
            backgroundImage: business.hero_image_url
              ? `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.75)), url('${business.hero_image_url}')`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: business.hero_image_url ? undefined : 'var(--brand-color)',
          }}
        >
          {/* Business logo */}
          <div className="absolute top-6 left-6 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logo_url} alt={business.name} className="h-8 w-8 object-contain" />
            ) : (
              <span className="text-xl font-black" style={{ color: 'var(--brand-color)' }}>
                {business.name.charAt(0)}
              </span>
            )}
          </div>

          <div className="p-6">
            <h1 className="text-[28px] font-extrabold leading-[1.1] text-white">
              Join {business.name} Rewards
            </h1>
          </div>
        </div>

        <p className="mt-4 px-1 text-center text-base font-medium leading-relaxed text-[#78716c]">
          Tap your card every visit to earn points and exclusive perks.
        </p>
      </div>

      {/* First goal card */}
      {firstTier && (
        <div className="px-5 pb-5">
          <div
            className="flex flex-row items-center justify-between overflow-hidden rounded-3xl p-6 shadow-lg"
            style={{ backgroundColor: 'var(--brand-color)' }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">
                YOUR FIRST GOAL
              </p>
              <p className="text-[22px] font-bold leading-tight text-white">
                {firstTier.reward_description ?? 'Your first reward'}
              </p>
              <p className="mt-1 text-sm font-medium text-white/70">
                Reach {firstTier.name} — earn {firstTier.visit_threshold} visits
              </p>
            </div>
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <span
                className="material-symbols-outlined text-white"
                style={{ fontSize: '40px', fontVariationSettings: "'FILL' 1" }}
              >
                military_tech
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Form card */}
      <div className="px-5 pb-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-[#E7E5E4]">
          <h3 className="mb-6 text-lg font-bold tracking-tight text-[#1A1A1A]">
            Your details
          </h3>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#78716c] px-1">
                First Name
              </label>
              <input
                className="w-full rounded-2xl border-0 bg-[#F7F7F5] px-5 py-4 text-base font-semibold text-[#1A1A1A] focus:ring-2 focus:outline-none"
                style={{ '--tw-ring-color': 'var(--brand-color)' } as React.CSSProperties}
                placeholder="Your name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#78716c] px-1">
                WhatsApp Number
              </label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-2xl bg-[#F7F7F5] px-4 py-4 text-base font-semibold shrink-0">
                  <span className="text-lg">🇿🇦</span>
                  <span className="text-[#1A1A1A]">+27</span>
                </div>
                <input
                  className="w-full flex-1 rounded-2xl border-0 bg-[#F7F7F5] px-5 py-4 text-base font-semibold text-[#1A1A1A] focus:ring-2 focus:outline-none"
                  style={{ '--tw-ring-color': 'var(--brand-color)' } as React.CSSProperties}
                  placeholder="712 345 678"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="opt-in"
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="h-6 w-6 rounded-lg border-2 border-[#E7E5E4] focus:ring-2 focus:ring-offset-0"
                style={{ accentColor: 'var(--brand-color)' }}
              />
              <label htmlFor="opt-in" className="text-sm font-semibold text-[#78716c]">
                Send my rewards to WhatsApp
              </label>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-3xl py-5 text-center text-sm font-extrabold uppercase tracking-[0.1em] text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-color)' }}
            >
              {loading ? 'Joining...' : 'JOIN REWARDS'}
            </button>
          </form>
        </div>
      </div>

      {/* Privacy disclaimer */}
      <p className="px-8 text-center text-[11px] font-medium leading-relaxed text-[#78716c]/70">
        By joining you agree to our{' '}
        <a className="underline font-bold" href="#">Privacy Policy</a>{' '}
        and{' '}
        <a className="underline font-bold" href="#">Terms of Service</a>.
        We use your data to manage your loyalty account.
      </p>
    </div>
  )
}
