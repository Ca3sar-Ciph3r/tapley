'use server'

// lib/actions/change-requests.ts
//
// The client's route to getting something changed, now that the dashboard is
// read-mostly.
//
// Removing write access without this would not remove friction — it would move
// it into Luke's inbox and leave the client feeling powerless. Here the client
// keeps control of intent and Tapley keeps control of execution, and the queue
// doubles as a record of what clients actually ask for, which is the data that
// says what to automate first.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getEffectiveCompanyId } from '@/lib/actions/admin'
import {
  CHANGE_REQUEST_TYPES,
  type ChangeRequest,
  type ChangeRequestType,
} from '@/lib/constants/change-requests'

// This file is 'use server' and may therefore only *export* async functions.
// The options and the row shape live in lib/constants/change-requests.ts so
// client components can import them without getting `undefined` at runtime.
const VALID_TYPES = new Set(CHANGE_REQUEST_TYPES.map(t => t.value))

const MAX_DETAILS = 2000

/**
 * Raise a request. Available to any signed-in member of a company — including
 * staff, who may spot a problem with their own card that they cannot fix.
 */
export async function createChangeRequest(input: {
  type: string
  details: string
  staffCardId?: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You are not signed in.' }

  // Uses main's existing resolver rather than introducing a second one:
  // impersonation cookie first, then the caller's own company_admins row.
  const companyId = await getEffectiveCompanyId()
  if (!companyId) return { error: 'No company found for this account.' }

  const details = input.details.trim()
  if (!details) return { error: 'Please describe what you need changed.' }
  if (details.length > MAX_DETAILS) {
    return { error: `Please keep it under ${MAX_DETAILS} characters.` }
  }

  const type = VALID_TYPES.has(input.type as ChangeRequestType) ? input.type : 'other'

  // Service role: staff have no insert policy on change_requests, and they are
  // exactly the people most likely to notice something wrong with their card.
  // company_id comes from the server-side resolver, never from the client.
  const { error } = await supabaseAdmin.from('change_requests').insert({
    company_id: companyId,
    requested_by: user.id,
    staff_card_id: input.staffCardId ?? null,
    type,
    details,
  })

  if (error) return { error: error.message }

  revalidatePath('/dashboard/requests')
  return {}
}

/** Requests for the company currently in scope. */
export async function listChangeRequests(): Promise<ChangeRequest[]> {
  const companyId = await getEffectiveCompanyId()
  if (!companyId) return []

  const { data } = await supabaseAdmin
    .from('change_requests')
    .select(
      'id, company_id, staff_card_id, type, details, status, resolution_note, resolved_at, created_at'
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100)

  return data ?? []
}

/** Every open request across all companies — Luke and Ethan's work queue. */
export async function listOpenRequestsForAllCompanies(): Promise<
  (ChangeRequest & { company_name: string })[]
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: superAdmin } = await supabase
    .from('company_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle()
  if (!superAdmin) return []

  const { data } = await supabaseAdmin
    .from('change_requests')
    .select(
      'id, company_id, staff_card_id, type, details, status, resolution_note, resolved_at, created_at, companies!inner(name)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  return (data ?? []).map(row => {
    const { companies, ...rest } = row as unknown as ChangeRequest & {
      companies: { name: string }
    }
    return { ...rest, company_name: companies?.name ?? 'Unknown' }
  })
}

/**
 * Close a request. Super admin only — a client must never be able to mark
 * their own request done, which is why change_requests has no client-facing
 * update policy.
 */
export async function resolveChangeRequest(
  requestId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You are not signed in.' }

  const { data: superAdmin } = await supabase
    .from('company_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle()
  if (!superAdmin) return { error: 'Access denied — super admin only.' }

  const { error } = await supabaseAdmin
    .from('change_requests')
    .update({
      status: 'done',
      resolution_note: note.trim() || null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/requests')
  revalidatePath('/admin')
  return {}
}
