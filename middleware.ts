// middleware.ts
//
// Runs on every matched request (Edge runtime).
// Two responsibilities:
//   1. Refresh the Supabase session cookie (required by @supabase/ssr)
//   2. Enforce route-level auth, role, and subscription guards
//
// Route protection rules:
//   /dashboard/* and /admin/*  → must be authenticated
//   /login                     → if already authenticated, redirect to /dashboard
//   /admin/*                   → must have role = 'super_admin' (no subscription gate)
//   /c/*                       → always public, never intercepted
//   /api/*                     → not matched (API routes handle their own auth)
//   /auth/callback             → always public — user is unauthenticated on arrival;
//                                this route exchanges the Supabase invite/magic-link
//                                code for a session, then redirects to /dashboard
//
// Subscription gating (applies to /dashboard/* only, not /admin/*):
//   pending_payment → /onboard/payment
//   payment_failed  → /billing/retry
//   cancelled       → /billing/reactivate
//   suspended       → /billing/suspended
//   trial + trial_ends_at < now() → /billing/trial-expired
//   active or trial (not expired) → allow through
//
// Billing gate pages (/billing/*) are always accessible to authenticated users
// so a gated user can see the retry/reactivate page without a redirect loop.
//
// IMPORTANT: Middleware must NOT use supabaseAdmin — it runs on Edge and the service
// role key must never be used here. Use createServerClient directly with cookies.

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not add any logic between createServerClient and getUser().
  // getUser() refreshes the session cookie if it has expired.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rule 1: Unauthenticated user on a protected route → /login
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/admin')

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Rule 2: Authenticated user on /login → /dashboard (which will role-redirect)
  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  // Rule 3: /admin/* requires super_admin role
  if (user && pathname.startsWith('/admin')) {
    const { data: adminRecord } = await supabase
      .from('company_admins')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminRecord?.role !== 'super_admin') {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }
    // Super admins bypass all subscription gates
    return supabaseResponse
  }

  // Rule 4: /dashboard/* subscription gating
  // /billing/* pages are exempt so gated users can see the retry/reactivate UI.
  if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/billing')) {
    // Resolve company_id — super admins have no company_id row, skip gate for them
    const { data: adminRecord } = await supabase
      .from('company_admins')
      .select('role, company_id')
      .eq('user_id', user.id)
      .single()

    if (adminRecord?.role === 'super_admin') {
      return supabaseResponse
    }

    if (adminRecord?.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('subscription_status, trial_ends_at')
        .eq('id', adminRecord.company_id)
        .single()

      if (company) {
        const status    = company.subscription_status as string
        const trialEnds = company.trial_ends_at as string | null

        const gateUrl = request.nextUrl.clone()

        if (status === 'pending_payment') {
          gateUrl.pathname = '/onboard/payment'
          return NextResponse.redirect(gateUrl)
        }
        if (status === 'payment_failed') {
          gateUrl.pathname = '/billing/retry'
          return NextResponse.redirect(gateUrl)
        }
        if (status === 'cancelled') {
          gateUrl.pathname = '/billing/reactivate'
          return NextResponse.redirect(gateUrl)
        }
        if (status === 'suspended') {
          gateUrl.pathname = '/billing/suspended'
          return NextResponse.redirect(gateUrl)
        }
        if (status === 'trial' && trialEnds && new Date(trialEnds) < new Date()) {
          gateUrl.pathname = '/billing/trial-expired'
          return NextResponse.redirect(gateUrl)
        }
      }
    }
  }

  // Pass the refreshed session cookies through
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match:  /dashboard, /dashboard/*, /admin, /admin/*, /login, /billing/*
     * Skip:   /c/*           public card pages — never intercept, must stay fast
     *         /api/*         API routes handle their own auth
     *         /auth/callback intentionally public — exchanges invite/magic-link
     *                        code for a session before the user is authenticated
     *         /_next/*       Next.js internals
     *         /favicon.ico, static files
     */
    '/dashboard/:path*',
    '/admin/:path*',
    '/billing/:path*',
    '/login',
  ],
}
