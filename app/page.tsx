'use client'

// app/page.tsx
//
// Root URL redirects to /login.
// Captures ?ref=<code> query param and stores it as a cookie so createCompany
// can credit the referring company when the admin signs up.
//
// Must be a client component to read searchParams before redirecting.

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const REF_COOKIE = 'tapley_ref'
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export default function RootPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      // Store for up to 30 days — createCompany reads this to credit the referrer
      document.cookie = `${REF_COOKIE}=${encodeURIComponent(ref)}; max-age=${REF_COOKIE_MAX_AGE}; path=/; SameSite=Lax`
    }
    router.replace('/login')
  }, [router, searchParams])

  // Render nothing — the redirect fires immediately on mount
  return null
}
