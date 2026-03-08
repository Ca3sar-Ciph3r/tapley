'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TapLoader from '@/components/customer/TapLoader'
import type { TapResult } from '@/types/database'

function TapContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const cardUuid = searchParams.get('card')

  useEffect(() => {
    if (!cardUuid) {
      router.replace('/')
      return
    }

    let cancelled = false

    async function runTapStateMachine() {
      try {
        const res = await fetch(`/api/tap?card=${encodeURIComponent(cardUuid!)}`)
        if (!res.ok) throw new Error('tap API error')

        const result: TapResult = await res.json()

        if (cancelled) return

        switch (result.state) {
          case 'not_found':
          case 'blacklisted':
            router.replace(`/status?card=${cardUuid}&state=${result.state}`)
            break

          case 'register':
            router.replace(`/register?card=${cardUuid}`)
            break

          case 'cooldown':
            router.replace(`/status?card=${cardUuid}&state=cooldown`)
            break

          case 'reward':
            router.replace(`/redeem?card=${cardUuid}`)
            break

          case 'pending':
            router.replace(`/status?card=${cardUuid}&state=pending&visit=${result.visit_id}`)
            break

          default:
            router.replace(`/status?card=${cardUuid}`)
        }
      } catch (err) {
        console.error('Tap error:', err)
        if (!cancelled) {
          router.replace(`/status?card=${cardUuid}&state=not_found`)
        }
      }
    }

    // Minimum display time of 800ms so the animation is visible
    const minDisplay = new Promise<void>((resolve) => setTimeout(resolve, 800))

    Promise.all([runTapStateMachine(), minDisplay]).then(() => {
      // Navigation already triggered inside runTapStateMachine
    })

    return () => {
      cancelled = true
    }
  }, [cardUuid, router])

  return <TapLoader />
}

export default function TapPage() {
  return (
    <Suspense fallback={<TapLoader />}>
      <TapContent />
    </Suspense>
  )
}
