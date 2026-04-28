// app/api/billing/cancel/route.ts
//
// Sets subscription_status = 'cancelled' for the authenticated company admin's company.
// Only company admins (not staff) can cancel. Super admins cannot cancel via this route.
// Uses server client (RLS active) — admin_write_company policy enforces company scoping.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: adminRecord } = await supabaseAny
    .from('company_admins')
    .select('role, company_id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord?.company_id || adminRecord.role === 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAny
    .from('companies')
    .update({ subscription_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', adminRecord.company_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
