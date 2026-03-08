'use client'

import { useState } from 'react'

export default function RedeemClient({
  cardUuid,
  rewardDescription,
}: {
  cardUuid: string
  rewardDescription: string
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'redeemed' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleClaim() {
    if (state !== 'idle') return
    setState('loading')
    setError(null)

    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_uuid: cardUuid,
          confirmed_by: 'customer',
        }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please ask a staff member.')
        setState('error')
        return
      }

      setState('redeemed')
    } catch {
      setError('Could not connect. Please try again.')
      setState('error')
    }
  }

  if (state === 'redeemed') {
    return (
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-8 bg-gradient-to-t from-[#F7F7F5] pt-8">
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#22C55E] p-6 text-white text-center shadow-xl reward-glow">
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: '48px', fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <p className="text-2xl font-extrabold">Reward Redeemed ✓</p>
          <p className="text-sm text-white/80">{rewardDescription} — enjoy!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-5 pb-8 bg-gradient-to-t from-[#F7F7F5] pt-8">
      {error && (
        <p className="mb-3 text-center text-sm font-medium text-red-600">{error}</p>
      )}
      <button
        onClick={handleClaim}
        disabled={state === 'loading'}
        className="w-full rounded-full bg-[#22C55E] py-5 text-center text-sm font-extrabold uppercase tracking-wide text-white shadow-xl reward-glow transition-all active:scale-[0.98] disabled:opacity-60"
      >
        {state === 'loading' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Processing...
          </span>
        ) : (
          'CLAIM REWARD'
        )}
      </button>
    </div>
  )
}
