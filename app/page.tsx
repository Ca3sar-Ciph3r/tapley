'use client'

// app/page.tsx
//
// Root URL redirects to /login.
// Captures ?ref=<code> query param and stores it as a cookie so createCompany
// can credit the referring company when the admin signs up.
//
// useSearchParams() must be wrapped in <Suspense> — Next.js 15 requirement
// for any component that calls useSearchParams() at the page level.

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const REF_COOKIE = 'tapley_ref'
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function RefCaptureAndRedirect() {
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

  return null
}

export default function RootPage() {
  return (
    <Suspense>
      <RefCaptureAndRedirect />
    </Suspense>
  )
}
