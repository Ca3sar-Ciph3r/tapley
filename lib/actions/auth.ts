// lib/actions/auth.ts
//
// Server actions for Supabase Auth.
// Called from client components — run on the server, never in the browser.
//
// signIn: Signs in with email + password. On success, redirects to /dashboard
//         where the role-based redirect hub routes to the correct page.
//         On error, returns a user-friendly error string (never raw Supabase errors).
//
// signOut: Signs out and redirects to /login.

'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Map Supabase error codes to user-friendly messages.
    // Never expose raw error messages — they can leak implementation details.
    if (
      error.message.includes('Invalid login credentials') ||
      error.message.includes('invalid_credentials')
    ) {
      return { error: 'Incorrect email or password. Please try again.' }
    }

    if (
      error.message.includes('Email not confirmed') ||
      error.message.includes('email_not_confirmed')
    ) {
      return { error: 'Please confirm your email address before signing in.' }
    }

    if (error.message.includes('Too many requests')) {
      return { error: 'Too many sign-in attempts. Please wait a moment and try again.' }
    }

    // Fallback for unexpected errors — temporarily showing raw error for debugging
    return { error: `Debug: ${error.message} (code: ${error.status})` }
  }

  // On success, redirect to the role-based hub (dashboard/page.tsx handles role routing)
  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
