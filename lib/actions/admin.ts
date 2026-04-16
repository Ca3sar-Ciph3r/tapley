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
import { sendWelcomeEmail } from '@/lib/email/onboarding'

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
  const { data: adminRecord } = await (supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single() as unknown as Promise<{ data: { role: string } | null }>)

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
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// generateUniqueReferralCode
//
// Generates an 8-character alphanumeric referral code (no ambiguous chars).
// Retries up to 5 times if there's a collision (extremely unlikely).
// ---------------------------------------------------------------------------

async function generateUniqueReferralCode(): Promise<string> {
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => CHARS[Math.floor(Math.random() * CHARS.length)],
    ).join('')

    // Check uniqueness
    const { data: existing } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('companies' as any)
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!existing) return code
  }
  // Fallback: use timestamp suffix to guarantee uniqueness
  return `TC${Date.now().toString(36).toUpperCase().slice(-6)}`
}

export type CreateCompanyInput = {
  // Company details
  name: string
  website?: string
  tagline?: string
  // Pricing
  pricingTierId?: string
  ratePerCardZar?: number
  setupFeePerCardZar?: number
  minCardsCommitted?: number
  contractStartDate?: string
  contractEndDate?: string
  nextBillingDate?: string
  // Pricing v2
  pricingV2Enabled?: boolean
  isQrDigital?: boolean
  billingCycle?: 'monthly' | 'annual'
  maxStaffCards?: number
  // Brand
  brandPrimaryColor?: string
  brandSecondaryColor?: string
  brandDarkMode?: boolean
  cardTemplate?: 'minimal' | 'bold' | 'split'
  // Primary contact (Company Admin)
  primaryContactName?: string
  primaryContactEmail?: string
  adminEmail?: string
  primaryContactPhone?: string
  primaryContactWhatsapp?: string
  // NFC card order
  nfcCardsOrdered?: number
  nfcDeliveryAddress?: string
  // Internal notes (super admin only)
  internalNotes?: string
  // Referral (from tapley_ref cookie)
  referredByCode?: string
}

export async function createCompany(
  input: CreateCompanyInput
): Promise<{ companyId?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await (supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single() as unknown as Promise<{ data: { role: string } | null }>)

  if (adminRecord?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  const name = input.name.trim()
  if (!name) return { error: 'Company name is required.' }

  // max_staff_cards: use committed count if supplied, otherwise default 999
  // (no artificial cap — the pricing tier and billing commitment are the real controls)
  const maxCards = input.minCardsCommitted ?? 999

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

  // Generate a unique referral code (8-char alphanumeric, no ambiguous chars)
  const referralCode = await generateUniqueReferralCode()

  // Resolve referred_by_company_id from referral code cookie (if provided)
  let referredByCompanyId: string | null = null
  let referrerCompanyName: string | null = null
  if (input.referredByCode?.trim()) {
    // referral_code column added in migration 20260415060000 — cast until types regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: referrer } = await (supabaseAdmin
      .from('companies')
      .select('id, name')
      .eq('referral_code' as any, input.referredByCode.trim())
      .maybeSingle() as any)
    referredByCompanyId = (referrer as { id: string; name: string } | null)?.id ?? null
    referrerCompanyName = (referrer as { id: string; name: string } | null)?.name ?? null
  }

  // Insert the company record with all onboarding fields.
  // Columns added in migrations 20260415010000–20260415060000 (pricing_v2_enabled,
  // is_qr_digital, billing_cycle, dpa_accepted_at, dpa_version, referral_code,
  // referred_by_company_id) are not yet in the generated types.
  // Re-run `npx supabase gen types typescript` after applying migrations to fix.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = supabaseAdmin as any
  const { data: newCompany, error: insertError } = await adminAny
    .from('companies')
    .insert({
      name,
      slug,
      website: input.website?.trim() || null,
      tagline: input.tagline?.trim() || null,
      subscription_plan: 'starter',
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
      primary_contact_email: input.primaryContactEmail?.trim() || input.adminEmail?.trim() || null,
      primary_contact_phone: input.primaryContactPhone?.trim() || null,
      primary_contact_whatsapp: input.primaryContactWhatsapp?.trim() || null,
      nfc_cards_ordered: input.nfcCardsOrdered ?? 0,
      nfc_delivery_address: input.nfcDeliveryAddress?.trim() || null,
      internal_notes: input.internalNotes?.trim() || null,
      pricing_v2_enabled: input.pricingV2Enabled ?? false,
      is_qr_digital: input.isQrDigital ?? false,
      billing_cycle: input.billingCycle ?? 'monthly',
      dpa_accepted_at: new Date().toISOString(),
      dpa_version: '1.0',
      referral_code: referralCode,
      referred_by_company_id: referredByCompanyId,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (insertError || !newCompany) {
    return { error: insertError?.message ?? 'Failed to create company.' }
  }

  // Auto-create a card_orders record if NFC cards were ordered.
  // card_orders table added in migration 20260415050000 — use adminAny until types regenerated.
  if ((input.nfcCardsOrdered ?? 0) > 0) {
    const { error: orderError } = await adminAny
      .from('card_orders')
      .insert({
        company_id: newCompany.id,
        quantity: input.nfcCardsOrdered,
        status: 'pending',
      })

    if (orderError) {
      // Non-fatal: log but don't fail company creation
      // eslint-disable-next-line no-console
      console.error('[createCompany] card_orders insert failed:', orderError.message)
    }
  }

  // Insert referrals row if this company was referred.
  // referrals table added in migration 20260415060000 — use adminAny until types regenerated.
  if (referredByCompanyId && referrerCompanyName) {
    const { error: referralError } = await adminAny
      .from('referrals')
      .insert({
        referrer_company_id: referredByCompanyId,
        referred_company_id: newCompany.id,
        status: 'pending',
      })

    if (referralError) {
      // Non-fatal: log but don't fail company creation
      // eslint-disable-next-line no-console
      console.error('[createCompany] referrals insert failed:', referralError.message)
    } else {
      // Notify super admin that a referral has been recorded
      const notifyEmail = process.env.SUPER_ADMIN_NOTIFY_EMAIL
      if (notifyEmail) {
        try {
          const { getResend, FROM_ADDRESS } = await import('@/lib/email/resend')
          await getResend().emails.send({
            from: FROM_ADDRESS,
            to: notifyEmail,
            subject: `New referral: ${referrerCompanyName} referred ${name}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:8px;">
    New Referral Recorded
  </h1>
  <p style="color:#475569;margin-bottom:24px;">
    A new company was created via a referral link.
  </p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#64748b;width:40%;">Referring company</td>
      <td style="padding:10px 0;font-size:13px;font-weight:700;color:#0f172a;">${referrerCompanyName}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;">New company</td>
      <td style="padding:10px 0;font-size:13px;font-weight:700;color:#0f172a;">${name}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;">Referral code used</td>
      <td style="padding:10px 0;font-size:13px;font-family:monospace;color:#0d9488;">${input.referredByCode?.trim()}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;">Status</td>
      <td style="padding:10px 0;font-size:13px;color:#d97706;font-weight:600;">Pending — mark as credited once ${name} goes live</td>
    </tr>
  </table>
  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'}/admin"
     style="display:inline-block;padding:12px 24px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
    View in Admin Panel →
  </a>
  <hr style="margin:40px 0;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;">Tapley Connect · Super Admin Notification</p>
</body>
</html>`,
          })
        } catch {
          // Non-fatal — notification failure must not block company creation
        }
      }
    }
  }

  // Optionally invite the first admin
  let invitedUserEmail: string | null = null
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
        invitedUserEmail = input.adminEmail.trim()
      }
    } catch (err) {
      console.error('[createCompany] invite exception:', err)
    }
  }

  // Send Day 0 welcome email
  const recipientEmail = invitedUserEmail ?? input.primaryContactEmail?.trim() ?? null
  if (recipientEmail) {
    try {
      const { error: emailError } = await sendWelcomeEmail({
        companyName: name,
        adminEmail: recipientEmail,
        adminName: input.primaryContactName?.trim() ?? name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      })
      if (emailError) {
        console.error('[createCompany] welcome email failed:', emailError)
      }
    } catch (err) {
      console.error('[createCompany] welcome email exception:', err)
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

  const { data: adminRecord } = await (supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single() as unknown as Promise<{ data: { role: string } | null }>)

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

  // Note: super_admin access is NOT at risk here.
  // Migration 20260415000000_super_admin_nullable_company sets the super admin's
  // company_id to NULL, so their company_admins row has no FK to any client company
  // and is immune to this cascade.

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
// markOrderDelivered
//
// Sets a card_orders row to status = 'delivered' and records actual_delivery.
// Super admin only.
// card_orders table added in migration 20260415050000 — use adminAny until types regenerated.
// ---------------------------------------------------------------------------

export async function markOrderDelivered(
  orderId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  const adminAny = supabaseAdmin as any
  const { error } = await adminAny
    .from('card_orders')
    .update({
      status: 'delivered',
      actual_delivery: new Date().toISOString(),
    })
    .eq('id', orderId)

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// updateCardOrder
//
// Edits any editable field on a card_orders row.
// Super admin only.
// ---------------------------------------------------------------------------

export type CardOrderStatus = 'pending' | 'ordered' | 'printing' | 'shipped' | 'delivered'

export type UpdateCardOrderInput = {
  status?: CardOrderStatus
  quantity?: number
  order_date?: string | null
  estimated_delivery?: string | null
  tracking_number?: string | null
  total_cost?: number | null
  notes?: string | null
  actual_delivery?: string | null
}

export async function updateCardOrder(
  orderId: string,
  updates: UpdateCardOrderInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins').select('role').eq('user_id', user.id).single()
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied — super admin only.' }

  // If status is being set to 'delivered' and no actual_delivery provided, set it now.
  const patch: UpdateCardOrderInput = { ...updates }
  if (patch.status === 'delivered' && !patch.actual_delivery) {
    patch.actual_delivery = new Date().toISOString()
  }

  const adminAny = supabaseAdmin as any
  const { error } = await adminAny
    .from('card_orders')
    .update(patch)
    .eq('id', orderId)

  return { error: error?.message }
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

// ---------------------------------------------------------------------------
// creditReferral
//
// Marks a referral as 'credited', increments the referrer's free_months_balance,
// and inserts a referral_credit billing record. Super admin only.
// ---------------------------------------------------------------------------

export async function creditReferral(
  referralId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await (supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single() as unknown as Promise<{ data: { role: string } | null }>)
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied.' }

  const adminAny = supabaseAdmin as any

  // Fetch referral to get referrer
  const { data: referral, error: fetchError } = await adminAny
    .from('referrals')
    .select('id, referrer_company_id, referred_company_id, status, companies!referrals_referred_company_id_fkey(name)')
    .eq('id', referralId)
    .single()

  if (fetchError || !referral) return { error: 'Referral not found.' }
  if (referral.status === 'credited') return { error: 'Already credited.' }

  const referredName = Array.isArray(referral.companies)
    ? (referral.companies[0]?.name ?? 'Unknown')
    : (referral.companies?.name ?? 'Unknown')

  // Mark referral as credited
  const { error: updateError } = await adminAny
    .from('referrals')
    .update({ status: 'credited', credited_at: new Date().toISOString() })
    .eq('id', referralId)
  if (updateError) return { error: updateError.message }

  // Increment free_months_balance on the referrer company via RPC
  // (avoids read-modify-write race — SQL function does atomic update)
  await adminAny.rpc('increment_free_months', { company_id_arg: referral.referrer_company_id })

  // Insert a billing record for the credit
  await adminAny
    .from('billing_records')
    .insert({
      company_id: referral.referrer_company_id,
      type: 'referral_credit',
      amount_zar: 0,
      description: `1 month free — referred ${referredName}`,
      billing_date: new Date().toISOString().slice(0, 10),
      status: 'paid',
    })

  return {}
}

// ---------------------------------------------------------------------------
// addBillingRecord
//
// Super admin manually adds a charge or credit to a company's billing ledger.
// ---------------------------------------------------------------------------

export type BillingRecordType = 'monthly_fee' | 'setup_fee' | 'referral_credit' | 'manual_credit' | 'payment'
export type BillingRecordStatus = 'pending' | 'paid' | 'waived'

export type AddBillingRecordInput = {
  companyId: string
  type: BillingRecordType
  amountZar: number
  description?: string
  billingDate: string   // YYYY-MM-DD
  status: BillingRecordStatus
}

export async function addBillingRecord(
  input: AddBillingRecordInput,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await (supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single() as unknown as Promise<{ data: { role: string } | null }>)
  if (adminRecord?.role !== 'super_admin') return { error: 'Access denied.' }

  const adminAny = supabaseAdmin as any
  const { error } = await adminAny
    .from('billing_records')
    .insert({
      company_id: input.companyId,
      type: input.type,
      amount_zar: input.amountZar,
      description: input.description ?? null,
      billing_date: input.billingDate,
      status: input.status,
    })

  return { error: error?.message }
}
