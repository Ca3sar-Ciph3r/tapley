// lib/supabase/server.ts
//
// SERVER CLIENT — use in server components, API routes, and server actions.
//
// Uses the public anon key. RLS is ACTIVE. Reads the session from request
// cookies so the correct authenticated user's permissions are applied.
//
// This client must be created fresh per request (not shared across requests).
//
// Never import this in:
//   - Client components ('use client')
//   - Any file that runs in the browser
//
// Usage in a server component:
//   const supabase = await createClient()
//   const { data: { user } } = await supabase.auth.getUser()
//
// Usage in middleware.ts:
//   Use the inline pattern from @supabase/ssr docs (see middleware.ts) since
//   middleware runs on the Edge runtime and requires cookie mutation handling.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll called from a Server Component — cookies are read-only here.
            // This is expected; middleware handles the actual cookie mutation.
          }
        },
      },
    }
  )
}
