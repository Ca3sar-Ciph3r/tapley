'use server'

// lib/actions/admin.ts
//
// Server actions for Super Admin operations.
// All actions require the caller to be authenticated with role = 'super_admin'.
// Defence-in-depth: middleware already guards /admin/* routes.
//
// Supabase client strategy:
//   - Auth checks: server client (reads session from cookies, RLS active)
//   - Data mutations: supabaseAdmin (service role) — super admin operations
//     cross company boundaries, so RLS scoping is not appropriate here.
//
// Impersonation state:
//   Stored as an httpOnly cookie 'tapley_impersonating' containing
//   JSON { companyId: string, companyName: string }.
//   This is NOT a real auth switch — auth.uid() stays the same.
//   All impersonation sessions are logged to impersonation_log.
//
// MVP note: When impersonating and navigating to /dashboard, the super admin
// sees data via the super_admin_all RLS policy (i.e. all companies' data).
// For MVP (single client: Karam Africa), this is effectively the correct view.
// Post-MVP: Dashboard queries should inject company_id from the impersonation
// cookie to scope the view to the target company only.

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const IMPERSONATION_COOKIE = 'tapley_impersonating'

type ImpersonationCookiePayload = {
  companyId: string
  companyName: string
  logId: string
}

// ---------------------------------------------------------------------------
// getImpersonationState
//
// Reads the current impersonation cookie.
// Returns null if not impersonating.
// Used by layouts to render the amber banner.
// ---------------------------------------------------------------------------

export async function getImpersonationState(): Promise<ImpersonationCookiePayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationCookiePayload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// startImpersonation
//
// Called from /admin/[companyId] when the super admin clicks "Impersonate".
// 1. Verifies the caller is super_admin
// 2. Inserts a row into impersonation_log
// 3. Sets the httpOnly impersonation cookie
// 4. Redirects to /dashboard
// ---------------------------------------------------------------------------

export async function startImpersonation(
  companyId: string,
  reason?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Verify super_admin role
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (adminRecord?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  // Fetch company name for the cookie payload and log
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Company not found.' }
  }

  // Log the impersonation session
  const { data: logEntry, error: logError } = await supabaseAdmin
    .from('impersonation_log')
    .insert({
      super_admin_user_id: user.id,
      target_company_id: companyId,
      reason: reason ?? null,
    })
    .select('id')
    .single()

  if (logError || !logEntry) {
    return { error: 'Failed to log impersonation session.' }
  }

  // Set the httpOnly impersonation cookie
  const payload: ImpersonationCookiePayload = {
    companyId: company.id,
    companyName: company.name,
    logId: logEntry.id,
  }

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Session cookie — expires when browser closes
  })

  redirect('/dashboard')
}

// ---------------------------------------------------------------------------
// stopImpersonation
//
// Called from the impersonation banner "Exit" button.
// 1. Reads the impersonation cookie to get logId and companyId
// 2. Updates impersonation_log.ended_at
// 3. Clears the cookie
// 4. Redirects back to /admin/[companyId]
// ---------------------------------------------------------------------------

export async function stopImpersonation(): Promise<void> {
  const state = await getImpersonationState()

  if (state) {
    // Update the log entry with ended_at
    await supabaseAdmin
      .from('impersonation_log')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', state.logId)
  }

  // Clear the cookie
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)

  // Redirect back to the company detail page (or admin home if no companyId)
  redirect(state ? `/admin/${state.companyId}` : '/admin')
}

// ---------------------------------------------------------------------------
// createCompany
//
// Creates a new company record.
// Optionally invites the first Company Admin via Supabase Auth.
//
// Input:
//   name               — company display name (required)
//   adminEmail         — first admin's email (optional — admin added later if blank)
//   subscriptionPlan   — 'starter' | 'growth' | 'enterprise' (defaults to 'starter')
//   maxStaffCards      — override max cards (defaults from plan: 10/35/999)
// ---------------------------------------------------------------------------

const PLAN_MAX_CARDS: Record<string, number> = {
  starter: 10,
  growth: 35,
  enterprise: 999,
}

export type CreateCompanyInput = {
  // Company details
  name: string
  website?: string
  tagline?: string
  // Subscription
  subscriptionPlan?: 'starter' | 'growth' | 'enterprise'
  // Pricing
  pricingTierId?: string
  ratePerCardZar?: number
  setupFeePerCardZar?: number
  minCardsCommitted?: number
  contractStartDate?: string
  contractEndDate?: string
  nextBillingDate?: string
  // Brand
  brandPrimaryColor?: string
  brandSecondaryColor?: string
  brandDarkMode?: boolean
  cardTemplate?: 'minimal' | 'bold' | 'split'
  // Primary contact (Company Admin)
  primaryContactName?: string
  adminEmail?: string
  primaryContactPhone?: string
  primaryContactWhatsapp?: string
  // NFC card order
  nfcCardsOrdered?: number
  nfcDeliveryAddress?: string
  // Internal notes (super admin only)
  internalNotes?: string
}

export async function createCompany(
  input: CreateCompanyInput
): Promise<{ companyId?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (adminRecord?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  const name = input.name.trim()
  if (!name) return { error: 'Company name is required.' }

  const plan = input.subscriptionPlan ?? 'starter'
  const maxCards = PLAN_MAX_CARDS[plan] ?? 10

  // Derive slug from company name: lowercase, replace non-alphanumeric with hyphens
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  // Ensure slug uniqueness — append a random suffix if taken
  let slug = baseSlug
  const { data: existingSlug } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existingSlug) {
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }

  // Insert the company record with all onboarding fields
  const { data: newCompany, error: insertError } = await supabaseAdmin
    .from('companies')
    .insert({
      name,
      slug,
      website: input.website?.trim() || null,
      tagline: input.tagline?.trim() || null,
      subscription_plan: plan,
      subscription_status: 'trialing',
      max_staff_cards: maxCards,
      pricing_tier_id: input.pricingTierId ?? null,
      rate_per_card_zar: input.ratePerCardZar ?? null,
      setup_fee_per_card_zar: input.setupFeePerCardZar ?? null,
      min_cards_committed: input.minCardsCommitted ?? 0,
      contract_start_date: input.contractStartDate ?? null,
      contract_end_date: input.contractEndDate ?? null,
      next_billing_date: input.nextBillingDate ?? null,
      brand_primary_color: input.brandPrimaryColor ?? '#16181D',
      brand_secondary_color: input.brandSecondaryColor ?? '#2DD4BF',
      brand_dark_mode: input.brandDarkMode ?? true,
      card_template: input.cardTemplate ?? 'minimal',
      primary_contact_name: input.primaryContactName?.trim() || null,
      primary_contact_phone: input.primaryContactPhone?.trim() || null,
      primary_contact_whatsapp: input.primaryContactWhatsapp?.trim() || null,
      nfc_cards_ordered: input.nfcCardsOrdered ?? 0,
      nfc_delivery_address: input.nfcDeliveryAddress?.trim() || null,
      internal_notes: input.internalNotes?.trim() || null,
    })
    .select('id')
    .single()

  if (insertError || !newCompany) {
    return { error: insertError?.message ?? 'Failed to create company.' }
  }

  // Optionally invite the first admin
  if (input.adminEmail?.trim()) {
    try {
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.adminEmail.trim(), {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        })

      if (inviteError) {
        console.error('[createCompany] invite failed:', inviteError.message)
      } else if (inviteData.user) {
        await supabaseAdmin.from('company_admins').insert({
          user_id: inviteData.user.id,
          company_id: newCompany.id,
          role: 'admin',
        })
      }
    } catch (err) {
      console.error('[createCompany] invite exception:', err)
    }
  }

  return { companyId: newCompany.id }
}

// ---------------------------------------------------------------------------
// generateNfcBatch
//
// Creates N new nfc_cards records for a company.
// Slugs are generated by the database function generate_unique_slug().
// Cards are created with order_status = 'pending' — not yet programmed.
//
// Returns the created slugs so Luke can export them for programming.
// ---------------------------------------------------------------------------

export async function generateNfcBatch(
  companyId: string,
  quantity: number,
  printBatchId?: string,
): Promise<{ slugs?: string[]; error?: string }> {
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

  if (quantity < 1 || quantity > 200) {
    return { error: 'Quantity must be between 1 and 200.' }
  }

  // Generate slugs one at a time using the DB function to guarantee uniqueness
  const slugs: string[] = []
  for (let i = 0; i < quantity; i++) {
    const { data, error } = await supabaseAdmin
      .rpc('generate_unique_slug')
    if (error || !data) return { error: `Failed to generate slug ${i + 1}: ${error?.message}` }
    slugs.push(data as string)
  }

  // Insert all cards in one batch
  const rows = slugs.map(slug => ({
    company_id: companyId,
    slug,
    order_status: 'pending',
    print_batch_id: printBatchId ?? null,
  }))

  const { error: insertError } = await supabaseAdmin
    .from('nfc_cards')
    .insert(rows)

  if (insertError) {
    return { error: insertError.message }
  }

  return { slugs }
}

// ---------------------------------------------------------------------------
// updateCompanyClientInfo
//
// Updates onboarding / contact fields on a companies record.
// Super admin only — not exposed to company admins.
// ---------------------------------------------------------------------------

export type UpdateClientInfoInput = {
  primaryContactName: string | null
  primaryContactEmail: string | null
  primaryContactPhone: string | null
  primaryContactWhatsapp: string | null
  website: string | null
  tagline: string | null
  internalNotes: string | null
}

export async function updateCompanyClientInfo(
  companyId: string,
  input: UpdateClientInfoInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  const { error } = await supabaseAdmin
    .from('companies')
    .update({
      primary_contact_name: input.primaryContactName?.trim() || null,
      primary_contact_email: input.primaryContactEmail?.trim() || null,
      primary_contact_phone: input.primaryContactPhone?.trim() || null,
      primary_contact_whatsapp: input.primaryContactWhatsapp?.trim() || null,
      website: input.website?.trim() || null,
      tagline: input.tagline?.trim() || null,
      internal_notes: input.internalNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId)

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// updateOnboardingChecklist
//
// Persists the onboarding checklist JSONB for a company.
// All 8 boolean keys are written on each save.
// ---------------------------------------------------------------------------

export type OnboardingChecklist = {
  company_created: boolean
  admin_invited: boolean
  branding_set: boolean
  staff_imported: boolean
  nfc_cards_generated: boolean
  cards_assigned: boolean
  card_page_tested: boolean
  handover_done: boolean
}

export async function updateOnboardingChecklist(
  companyId: string,
  checklist: OnboardingChecklist,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  const { error } = await supabaseAdmin
    .from('companies')
    .update({ onboarding_checklist: checklist, updated_at: new Date().toISOString() })
    .eq('id', companyId)

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// deleteCompany
//
// Hard-deletes a company and all associated data.
// Deletion order:
//   1. impersonation_log (no cascade — must delete manually)
//   2. nfc_cards (ON DELETE RESTRICT on companies — must delete before company)
//      → card_views cascade from nfc_cards automatically
//   3. companies (cascades: staff_cards, company_admins, contacts,
//                 wa_notifications_log)
//
// This is irreversible. The UI must show a confirmation prompt before calling.
// ---------------------------------------------------------------------------

export async function deleteCompany(
  companyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  // 1. Remove impersonation_log rows (FK has no cascade)
  const { error: impersonationError } = await supabaseAdmin
    .from('impersonation_log')
    .delete()
    .eq('target_company_id', companyId)
  if (impersonationError) return { error: `Failed to clear impersonation log: ${impersonationError.message}` }

  // 2. Remove nfc_cards (companies.nfc_cards FK is ON DELETE RESTRICT)
  //    card_views cascade automatically when nfc_cards are deleted
  const { error: nfcError } = await supabaseAdmin
    .from('nfc_cards')
    .delete()
    .eq('company_id', companyId)
  if (nfcError) return { error: `Failed to delete NFC cards: ${nfcError.message}` }

  // 2b. Protect super_admin records from the company cascade.
  //     Find any super_admins linked to this company and reassign them
  //     to another company before deletion so they don't lose access.
  const { data: superAdmins } = await supabaseAdmin
    .from('company_admins')
    .select('user_id')
    .eq('company_id', companyId)
    .eq('role', 'super_admin')

  if (superAdmins && superAdmins.length > 0) {
    const { data: otherCompany } = await supabaseAdmin
      .from('companies')
      .select('id')
      .neq('id', companyId)
      .limit(1)
      .single()

    if (otherCompany) {
      await supabaseAdmin
        .from('company_admins')
        .update({ company_id: otherCompany.id })
        .eq('company_id', companyId)
        .eq('role', 'super_admin')
    }
  }

  // 3. Delete the company — cascades staff_cards, company_admins, contacts
  const { error: companyError } = await supabaseAdmin
    .from('companies')
    .delete()
    .eq('id', companyId)
  if (companyError) return { error: `Failed to delete company: ${companyError.message}` }

  return {}
}

// ---------------------------------------------------------------------------
// inviteCompanyAdmin
//
// Invites a user to become a Company Admin via Supabase Auth email invite.
// Can be called at any time — not just at company creation.
//
// Flow:
//   1. Verify caller is super_admin
//   2. Call inviteUserByEmail (Supabase sends an invite email)
//   3. Upsert a company_admins row linking the user to the company
//      (INSERT ... ON CONFLICT DO NOTHING — re-invites don't duplicate the row)
// ---------------------------------------------------------------------------

export async function inviteCompanyAdmin(
  companyId: string,
  email: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) return { error: 'Email is required.' }

  // Send the invite email via Supabase Auth
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(trimmedEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

  if (inviteError) {
    return { error: inviteError.message }
  }

  if (!inviteData?.user) {
    return { error: 'Invite sent but user record not returned.' }
  }

  // Upsert the company_admins row — ignore if already present (re-invite scenario)
  const { error: upsertError } = await supabaseAdmin
    .from('company_admins')
    .upsert(
      { user_id: inviteData.user.id, company_id: companyId, role: 'admin' },
      { onConflict: 'user_id,company_id', ignoreDuplicates: true },
    )

  if (upsertError) {
    return { error: `Invite sent but failed to link admin: ${upsertError.message}` }
  }

  return {}
}

// ---------------------------------------------------------------------------
// updateNfcCardStatus
//
// Updates the order_status of a single NFC card.
// Valid transitions: pending → programmed → shipped → active → deactivated
// ---------------------------------------------------------------------------

export async function updateNfcCardStatus(
  nfcCardId: string,
  status: 'pending' | 'programmed' | 'shipped' | 'active' | 'deactivated',
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied.' }

  const update: Record<string, unknown> = { order_status: status }
  if (status === 'programmed') update.programmed_at = new Date().toISOString()
  if (status === 'active') update.activated_at = new Date().toISOString()
  if (status === 'deactivated') update.deactivated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('nfc_cards')
    .update(update)
    .eq('id', nfcCardId)

  return { error: error?.message }
}
