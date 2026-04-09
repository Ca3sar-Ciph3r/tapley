// lib/supabase/client.ts
//
// BROWSER CLIENT — use in client components only ('use client').
//
// Uses the public anon key. RLS is ACTIVE — queries are scoped to the
// authenticated user's permissions automatically.
//
// Never import this in:
//   - Server components
//   - API routes
//   - Server actions
//   - middleware.ts
//
// Usage:
//   const supabase = createClient()
//   const { data } = await supabase.from('staff_cards').select('*')

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
