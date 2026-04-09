// middleware.ts
//
// Runs on every matched request (Edge runtime).
// Two responsibilities:
//   1. Refresh the Supabase session cookie (required by @supabase/ssr)
//   2. Enforce route-level auth and role guards
//
// Route protection rules:
//   /dashboard/* and /admin/*  → must be authenticated
//   /login                     → if already authenticated, redirect to /dashboard
//   /admin/*                   → must have role = 'super_admin'
//   /c/*                       → always public, never intercepted
//   /api/*                     → not matched (API routes handle their own auth)
//
// Role routing happens INSIDE pages (dashboard/page.tsx checks role and redirects).
// Middleware only checks: is there a session? Is the session valid for this route tier?
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
  }

  // Pass the refreshed session cookies through
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match:  /dashboard, /dashboard/*, /admin, /admin/*, /login
     * Skip:   /c/* (public card pages — never intercept, must stay fast)
     *         /api/* (API routes handle their own auth)
     *         /_next/* (Next.js internals)
     *         /favicon.ico, static files
     */
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
  ],
}
