'use server'

// lib/actions/onboarding.ts
//
// Server actions for onboarding checklist (Company Admin dashboard banner)
// and data deletion scheduling (Super Admin Danger Zone).

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// updateOnboardingStep
//
// Merges a single step into the JSONB onboarding_checklist column.
// Called from the dismissible onboarding banner in the Company Admin dashboard.
//
// step:     1-indexed step number (1–5 match the checklist items)
// complete: true = step done, false = step not done
//
// Step mapping:
//   1 — company_profile (logo + brand colour)
//   2 — first_card_created
//   3 — first_card_viewed
//   4 — second_card_or_nfc_assigned
//   5 — dismissed
// ---------------------------------------------------------------------------

const STEP_KEYS: Record<number, string> = {
  1: 'company_profile',
  2: 'first_card_created',
  3: 'first_card_viewed',
  4: 'second_card_or_nfc_assigned',
  5: 'dismissed',
}

export async function updateOnboardingStep(
  companyId: string,
  step: number,
  complete: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role, company_id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) return { error: 'Unauthorised' }

  // Allow company admin for their own company, or super admin for any
  const isAdmin = adminRecord.role === 'admin' && adminRecord.company_id === companyId
  const isSuperAdmin = adminRecord.role === 'super_admin'

  if (!isAdmin && !isSuperAdmin) {
    return { error: 'Access denied.' }
  }

  const stepKey = STEP_KEYS[step]
  if (!stepKey) return { error: `Invalid step: ${step}` }

  // Merge the step into the JSONB column using Supabase's || operator via RPC
  // We do it by fetching the current value and merging
  const { data: current } = await supabaseAdmin
    .from('companies')
    .select('onboarding_checklist')
    .eq('id', companyId)
    .single()

  const existing = (current?.onboarding_checklist ?? {}) as Record<string, unknown>
  const updated = { ...existing, [stepKey]: complete }

  const { error } = await supabaseAdmin
    .from('companies')
    .update({ onboarding_checklist: updated, updated_at: new Date().toISOString() })
    .eq('id', companyId)

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// scheduleDataDeletion
//
// Sets companies.deletion_scheduled_at = now() + 30 days and inserts a
// data_deletion_log row. Super admin only.
// Actual deletion execution is out of scope — this is scheduling + logging.
// ---------------------------------------------------------------------------

export async function scheduleDataDeletion(
  companyId: string,
): Promise<{ scheduledAt?: Date; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (adminRecord?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  const scheduledAt = new Date()
  scheduledAt.setDate(scheduledAt.getDate() + 30)

  const { error: updateError } = await supabaseAdmin
    .from('companies')
    .update({
      deletion_scheduled_at: scheduledAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)

  if (updateError) return { error: updateError.message }

  const { error: logError } = await supabaseAdmin
    .from('data_deletion_log')
    .insert({
      company_id: companyId,
      scheduled_at: scheduledAt.toISOString(),
      triggered_by: user.id,
      notes: 'Scheduled via super admin Danger Zone.',
    })

  if (logError) return { error: logError.message }

  return { scheduledAt }
}
