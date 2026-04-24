// lib/supabase/admin.ts
//
// ADMIN CLIENT (SERVICE ROLE) — bypasses RLS entirely.
//
// !! WARNING !! This client has unrestricted database access.
// Using it in the wrong place is a critical security vulnerability.
//
// ONLY use in:
//   - /api/view-event  (public endpoint, no user context, must insert card_views)
//   - /c/[slug]        (public card page server component — no user session, must read staff_cards)
//   - /c/[slug]/vcf    (public VCF download route)
//   - Super Admin operations in /app/(admin)/
//   - One-off data migrations
//
// NEVER use in:
//   - Dashboard routes (/dashboard/*)
//   - Client components (would expose service role key to browser!)
//   - Any route where a logged-in user's RLS scope should apply
//   - Anywhere the SUPABASE_SERVICE_ROLE_KEY would be sent to the client
//
// The service role key is ONLY available server-side (no NEXT_PUBLIC_ prefix).
// Next.js will throw at build time if you try to use it in a client bundle.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

let _adminClient: ReturnType<typeof createAdminClient> | null = null

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_target, prop) {
    if (!_adminClient) _adminClient = createAdminClient()
    return (_adminClient as Record<string | symbol, unknown>)[prop]
  },
})
