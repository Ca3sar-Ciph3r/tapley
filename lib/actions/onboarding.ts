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

  // Typed as boolean rather than unknown: onboarding_checklist is a jsonb
  // column, and Record<string, unknown> is wider than Json so it will not
  // assign. Every value in this checklist is a boolean.
  const existing = (current?.onboarding_checklist ?? {}) as Record<string, boolean>
  const updated: Record<string, boolean> = { ...existing, [stepKey]: complete }

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

// ---------------------------------------------------------------------------
// getOnboardingStatus
//
// Computes a company's real onboarding state from the database.
//
// The eight-checkbox version this replaces had drifted from reality on every
// one of the five live companies, in both directions: Nanovault read as fully
// onboarded and handed over while having no staff, no admin, an unassigned
// card and zero views; Jacks Bagels claimed an admin was invited (there were
// none) and denied its card was assigned (it was); two companies had an empty
// checklist despite being set up.
//
// This is the panel you consult to decide whether a client is ready to hand
// over. Wrong in the optimistic direction is how an empty shell gets signed
// off, so the six steps the database can answer are now derived and cannot be
// ticked by hand. The two with no database signal stay manual.
// ---------------------------------------------------------------------------
export type DerivedStepKey =
  | 'company_created'
  | 'admin_invited'
  | 'branding_set'
  | 'staff_imported'
  | 'nfc_cards_generated'
  | 'cards_assigned'

export type ManualStepKey = 'card_page_tested' | 'handover_done'

export interface DerivedStep {
  key: DerivedStepKey
  done: boolean
  /** What the database actually shows, e.g. "0 admins" or "3 of 4 assigned". */
  detail: string
}

export interface OnboardingStatus {
  derived: DerivedStep[]
  /** Evidence for the two steps a human has to judge. */
  evidence: {
    totalViews: number
    nfcSourcedViews: number
    activeStaff: number
  }
  error?: string
}

const DEFAULT_PRIMARY = '#16181D'
const DEFAULT_SECONDARY = '#F59608'

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export async function getOnboardingStatus(
  companyId: string
): Promise<OnboardingStatus> {
  const empty: OnboardingStatus = {
    derived: [],
    evidence: { totalViews: 0, nfcSourcedViews: 0, activeStaff: 0 },
  }

  // Super-admin only: this reads across a company the caller may not administer.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: 'Unauthorised' }

  const { data: superAdmin } = await supabase
    .from('company_admins')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle()
  if (!superAdmin) return { ...empty, error: 'Access denied — super admin only.' }

  const [companyRes, adminsRes, staffRes, nfcRes, viewsRes] = await Promise.all([
    supabaseAdmin
      .from('companies')
      .select('logo_url, brand_primary_color, brand_secondary_color, location')
      .eq('id', companyId)
      .maybeSingle(),
    supabaseAdmin
      .from('company_admins')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabaseAdmin
      .from('staff_cards')
      .select('id, nfc_card_id, photo_url')
      .eq('company_id', companyId)
      .eq('is_active', true),
    supabaseAdmin
      .from('nfc_cards')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId),
    supabaseAdmin
      .from('card_views')
      .select('source, nfc_cards!inner(company_id)')
      .eq('nfc_cards.company_id', companyId),
  ])

  const company = companyRes.data
  if (!company) return { ...empty, error: 'Company not found.' }

  const adminCount = adminsRes.count ?? 0
  const staff = staffRes.data ?? []
  const nfcCount = nfcRes.count ?? 0
  const views = viewsRes.data ?? []

  const assigned = staff.filter(s => s.nfc_card_id).length
  const hasLogo = Boolean(company.logo_url)
  const coloursCustomised =
    company.brand_primary_color !== DEFAULT_PRIMARY ||
    company.brand_secondary_color !== DEFAULT_SECONDARY

  const brandingBits: string[] = []
  if (!hasLogo) brandingBits.push('no logo')
  if (!coloursCustomised) brandingBits.push('default colours')
  if (!company.location) brandingBits.push('no location')

  const derived: DerivedStep[] = [
    {
      key: 'company_created',
      done: true,
      detail: 'Company record exists',
    },
    {
      key: 'admin_invited',
      done: adminCount > 0,
      detail:
        adminCount > 0
          ? `${plural(adminCount, 'admin')} linked`
          : 'No admin — nobody at this client can sign in',
    },
    {
      key: 'branding_set',
      done: hasLogo && coloursCustomised,
      detail: brandingBits.length === 0 ? 'Logo, colours and location set' : brandingBits.join(', '),
    },
    {
      key: 'staff_imported',
      done: staff.length > 0,
      detail:
        staff.length > 0 ? `${plural(staff.length, 'active staff card')}` : 'No staff cards',
    },
    {
      key: 'nfc_cards_generated',
      done: nfcCount > 0,
      detail: nfcCount > 0 ? `${plural(nfcCount, 'NFC card')} in the batch` : 'No NFC cards generated',
    },
    {
      key: 'cards_assigned',
      done: staff.length > 0 && assigned === staff.length,
      detail:
        staff.length === 0
          ? 'No staff to assign'
          : `${assigned} of ${staff.length} staff card${staff.length === 1 ? '' : 's'} assigned`,
    },
  ]

  return {
    derived,
    evidence: {
      totalViews: views.length,
      nfcSourcedViews: views.filter(
        v => (v as unknown as { source: string }).source === 'nfc'
      ).length,
      activeStaff: staff.length,
    },
  }
}
