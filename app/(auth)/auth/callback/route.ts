// app/(auth)/auth/callback/route.ts
//
// GET handler for the Supabase Auth redirect after a user clicks an email link
// (invite, magic link, password reset). Supabase sends:
//   ?code=[exchange_code]&next=[redirect_path]
//
// Flow:
//   1. Sanitise `next` to prevent open redirect (must start with '/', not '//')
//   2. Exchange the one-time code for a session via exchangeCodeForSession()
//   3. On success: redirect to `next`, or /dashboard?first_login=true for new invites
//   4. On failure: redirect to /login?error=auth_callback_failed
//
// Supabase Auth → URL Configuration (set in the Supabase dashboard):
//   Site URL:      https://tapleyconnect.co.za
//   Redirect URLs: https://tapleyconnect.co.za/auth/callback
//                  http://localhost:3000/auth/callback  (local dev)
//
// This route is NOT in the middleware matcher — it is always public. The user
// is unauthenticated when they arrive here; authentication happens here.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function sanitiseNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard'
  }
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = sanitiseNext(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(
      new URL('/login?error=auth_callback_failed', origin)
    )
  }

  // First-login detection for invited users.
  // Company admins have a company_admins row (created by the super admin before
  // the invite is sent). Staff members only have a staff_cards row. If there is
  // no company_admins record for this user, they are likely accepting a staff
  // invite for the first time — send them to the dashboard with first_login=true
  // so the onboarding checklist is surfaced naturally.
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('id')
    .eq('user_id', data.session.user.id)
    .maybeSingle()

  if (!adminRecord) {
    return NextResponse.redirect(new URL('/dashboard?first_login=true', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}
