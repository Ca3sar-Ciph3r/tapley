'use server'

// lib/actions/cards.ts
//
// Server actions for staff card mutations.
// All mutations must:
//   1. Verify the user is authenticated (defence-in-depth — RLS also enforces this)
//   2. Perform the database operation
//   3. Revalidate the affected ISR card page if an NFC slug is involved
//
// Supabase client: server client (reads session from cookies, RLS active)
// Admin client: used ONLY for inviteUserByEmail (requires service role — no alternative)

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalisePhoneNumber, isValidPhoneNumber } from '@/lib/utils/whatsapp'
import { sanitiseExternalUrl, sanitiseUrlMap } from '@/lib/utils/safe-url'
import { getImpersonationState } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// deactivateStaffCard
//
// Sets is_active = false on a staff card.
// Busts the ISR cache for the card's public page if an NFC card was assigned.
// ---------------------------------------------------------------------------

export async function deactivateStaffCard(
  staffCardId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Fetch the NFC slug before deactivating — needed to bust ISR cache
  const { data: staffCard } = await supabase
    .from('staff_cards')
    .select('nfc_card_id, nfc_cards(slug)')
    .eq('id', staffCardId)
    .single()

  // Deactivate — RLS ensures the admin can only touch their company's cards
  const { error } = await supabase
    .from('staff_cards')
    .update({ is_active: false })
    .eq('id', staffCardId)

  if (error) return { error: error.message }

  // Bust ISR cache so the public card page immediately reflects the deactivation
  if (staffCard?.nfc_card_id) {
    const nfcCard = Array.isArray(staffCard.nfc_cards)
      ? staffCard.nfc_cards[0]
      : staffCard.nfc_cards
    const slug = (nfcCard as { slug: string } | null)?.slug
    if (slug) {
      revalidatePath(`/c/${slug}`)
    }
  }

  return {}
}

// ---------------------------------------------------------------------------
// createStaffCard
//
// Inserts a new staff_card for the admin's company.
// Optionally sends a Supabase Auth invite email if send_invite is true.
// Returns the new staff card's id so the caller can redirect to the edit page.
// ---------------------------------------------------------------------------

export type CreateStaffCardInput = {
  full_name: string
  job_title: string
  department: string
  email: string
  phone: string
  whatsapp_number: string
  send_invite: boolean
}

export async function createStaffCard(
  input: CreateStaffCardInput
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Resolve this admin's company_id.
  //
  // When the super admin is impersonating a company, the impersonation cookie
  // holds the target company_id. We must use that — NOT the super admin's own
  // company_admins row — otherwise staff cards are created under the wrong
  // company (Tapley Connect) and that company's branding appears on the card page.
  //
  // For normal company admins (no impersonation), fall back to company_admins lookup.
  const impersonation = await getImpersonationState()

  let companyId: string

  if (impersonation?.companyId) {
    // Super admin impersonating: verify the caller really is super_admin
    const { data: superAdminRecord } = await supabase
      .from('company_admins')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (superAdminRecord?.role !== 'super_admin') {
      return { error: 'Unauthorised' }
    }

    companyId = impersonation.companyId
  } else {
    // Normal company admin path
    const { data: adminRecord } = await supabase
      .from('company_admins')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    if (!adminRecord?.company_id) {
      return { error: 'No company found for this account.' }
    }

    companyId = adminRecord.company_id
  }

  // Enforce plan card limit — count active staff cards for this company
  const supabaseAny = supabase as any
  const { count: activeCount } = await supabaseAny
    .from('staff_cards')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true)

  const { data: companyRow } = await supabaseAny
    .from('companies')
    .select('max_staff_cards')
    .eq('id', companyId)
    .single()

  const maxCards = (companyRow?.max_staff_cards as number | undefined) ?? 10
  if (typeof activeCount === 'number' && activeCount >= maxCards) {
    return {
      error: `You have reached the ${maxCards}-card limit for your plan. Upgrade your plan to add more team members.`,
    }
  }

  // Normalise phone numbers to E.164 (+27...)
  const phone = input.phone.trim() ? normalisePhoneNumber(input.phone.trim()) : null
  // WhatsApp defaults to work phone if left blank
  const whatsappNumber = input.whatsapp_number.trim()
    ? normalisePhoneNumber(input.whatsapp_number.trim())
    : phone

  // Insert the staff card — RLS admin_write_company policy enforces company scope
  const { data: newCard, error: insertError } = await supabase
    .from('staff_cards')
    .insert({
      company_id: companyId,
      full_name: input.full_name.trim(),
      job_title: input.job_title.trim(),
      department: input.department.trim() || null,
      email: input.email.trim() || null,
      phone,
      whatsapp_number: whatsappNumber,
    })
    .select('id')
    .single()

  if (insertError || !newCard) {
    return { error: insertError?.message ?? 'Failed to create staff card.' }
  }

  // Optionally send Supabase Auth invite email.
  // inviteUserByEmail requires the admin client (service role) — no alternative.
  if (input.send_invite && input.email.trim()) {
    try {
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(input.email.trim(), {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-card`,
        })

      if (inviteError) {
        // Non-fatal: card is created, invite just failed. Log and continue.
        console.error('[createStaffCard] invite failed:', inviteError.message)
      } else if (inviteData.user) {
        // Link the new auth user to this staff card
        await supabase
          .from('staff_cards')
          .update({ user_id: inviteData.user.id })
          .eq('id', newCard.id)
      }
    } catch (err) {
      console.error('[createStaffCard] invite exception:', err)
    }
  }

  return { id: newCard.id }
}

// ---------------------------------------------------------------------------
// reassignNfcCard
//
// Handles all three NFC reassignment modes (Journey 2 in JOURNEYS.md):
//
//   'existing'  — move the NFC card to an already-existing staff_card that
//                 currently has no NFC assignment.
//   'new'       — create a brand-new staff_card and assign the NFC to it.
//   'unassign'  — remove the NFC from the current card and return it to
//                 inventory (no new assignment).
//
// In all three cases the current staff_card is deactivated:
//   nfc_card_id = null, is_active = false
//
// The ISR cache for /c/[slug] is busted immediately after the DB update.
// Returns the new staff_card id (or null for 'unassign') so the caller
// can redirect to the correct edit page.
// ---------------------------------------------------------------------------

export type ReassignMode = 'existing' | 'new' | 'unassign'

export type ReassignNfcCardInput =
  | { mode: 'existing'; targetStaffCardId: string }
  | { mode: 'new'; newStaff: { full_name: string; job_title: string; email: string } }
  | { mode: 'unassign' }

export async function reassignNfcCard(
  currentStaffCardId: string,
  input: ReassignNfcCardInput
): Promise<{ newStaffCardId?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // 1. Fetch the current staff card to get nfc_card_id + company_id
  const { data: current, error: fetchError } = await supabase
    .from('staff_cards')
    .select('nfc_card_id, company_id, nfc_cards(slug)')
    .eq('id', currentStaffCardId)
    .single()

  if (fetchError || !current) {
    return { error: 'Staff card not found.' }
  }

  if (!current.nfc_card_id) {
    return { error: 'This staff card has no NFC card assigned.' }
  }

  const nfcCardId = current.nfc_card_id
  const companyId = current.company_id

  // Resolve slug for ISR bust (may be a nested object or array from the join)
  const nfcCardRow = Array.isArray(current.nfc_cards)
    ? current.nfc_cards[0]
    : current.nfc_cards
  const slug = (nfcCardRow as { slug: string } | null)?.slug

  // 2. Deactivate the current staff card — remove NFC link, mark inactive
  const { error: deactivateError } = await supabase
    .from('staff_cards')
    .update({ nfc_card_id: null, is_active: false })
    .eq('id', currentStaffCardId)

  if (deactivateError) return { error: deactivateError.message }

  let newStaffCardId: string | undefined

  // 3. Assign the NFC card to the new owner (or leave unassigned)
  if (input.mode === 'existing') {
    const { error: assignError } = await supabase
      .from('staff_cards')
      .update({ nfc_card_id: nfcCardId })
      .eq('id', input.targetStaffCardId)
      // RLS ensures admin can only touch their own company's cards
      .eq('company_id', companyId)

    if (assignError) return { error: assignError.message }

    newStaffCardId = input.targetStaffCardId
  } else if (input.mode === 'new') {
    const { data: created, error: createError } = await supabase
      .from('staff_cards')
      .insert({
        company_id: companyId,
        nfc_card_id: nfcCardId,
        full_name: input.newStaff.full_name.trim(),
        job_title: input.newStaff.job_title.trim(),
        email: input.newStaff.email.trim() || null,
      })
      .select('id')
      .single()

    if (createError || !created) {
      return { error: createError?.message ?? 'Failed to create new staff card.' }
    }

    newStaffCardId = created.id
  }
  // mode === 'unassign': NFC card is now free in inventory — nothing more to do

  // 4. Bust the ISR cache so /c/[slug] immediately shows the new person (or placeholder)
  if (slug) {
    revalidatePath(`/c/${slug}`)
  }

  return { newStaffCardId }
}

// ---------------------------------------------------------------------------
// assignNfcCard
//
// Initial assignment of an NFC card from company inventory to a staff card
// that currently has NO NFC card assigned.
//
// This is distinct from reassignNfcCard which transfers an already-assigned
// NFC card — that flow deactivates the current holder. This flow simply
// sets nfc_card_id on the staff card for the first time.
//
// Guards:
//   - Staff card must have nfc_card_id = null
//   - NFC card must belong to the same company (RLS also enforces this)
//   - NFC card must not already be pointed to by another staff card
// ---------------------------------------------------------------------------

export async function assignNfcCard(
  staffCardId: string,
  nfcCardId: string
): Promise<{ slug?: string; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Verify the staff card exists, belongs to the admin's company, and is unassigned
  const { data: staffCard } = await supabase
    .from('staff_cards')
    .select('id, company_id, nfc_card_id')
    .eq('id', staffCardId)
    .single()

  if (!staffCard) return { error: 'Staff card not found.' }
  if (staffCard.nfc_card_id) {
    return { error: 'This staff card already has an NFC card assigned. Use Reassign instead.' }
  }

  // Verify the NFC card exists
  const { data: nfcCard } = await supabase
    .from('nfc_cards')
    .select('id, slug, company_id, order_status')
    .eq('id', nfcCardId)
    .single()

  if (!nfcCard) return { error: 'NFC card not found or not in your company inventory.' }
  if (nfcCard.order_status === 'deactivated') {
    return { error: 'This NFC card has been deactivated and cannot be assigned.' }
  }

  // Cross-company guard: NFC card must belong to the same company as the staff card.
  // super_admin_all RLS policy lets super admins see all NFC cards across all companies —
  // without this explicit check, a super admin impersonating a company could assign an NFC
  // card from a different company, causing cross-company data bleed (Stage 21 incident).
  if (nfcCard.company_id !== staffCard.company_id) {
    return { error: 'This NFC card belongs to a different company and cannot be assigned here.' }
  }

  // Verify the NFC card is not already held by another staff card
  const { data: existingHolder } = await supabase
    .from('staff_cards')
    .select('id, full_name')
    .eq('nfc_card_id', nfcCardId)
    .maybeSingle()

  if (existingHolder) {
    return { error: `NFC card is already assigned to ${existingHolder.full_name}. Use Reassign to move it.` }
  }

  // Assign the NFC card
  const { error: assignError } = await supabase
    .from('staff_cards')
    .update({ nfc_card_id: nfcCardId })
    .eq('id', staffCardId)

  if (assignError) return { error: assignError.message }

  // Bust the ISR cache so /c/[slug] immediately shows this staff member
  revalidatePath(`/c/${nfcCard.slug}`)

  return { slug: nfcCard.slug }
}

// ---------------------------------------------------------------------------
// updateStaffCard
//
// Updates all editable fields on an existing staff card.
// Busts the ISR cache for the card's public page if an NFC card is assigned.
//
// photo_url should already be uploaded to Supabase Storage by the client
// before calling this action — pass the resulting public URL here.
// ---------------------------------------------------------------------------

export type UpdateStaffCardInput = {
  full_name: string
  job_title: string
  department: string
  bio: string
  phone: string
  email: string
  whatsapp_number: string
  show_phone: boolean
  show_email: boolean
  social_links: {
    linkedin?: string
    instagram?: string
    twitter?: string
    facebook?: string
    website?: string
    calendly?: string
  }
  // cta_label / cta_url are intentionally optional here.
  // The admin edit UI no longer exposes these fields so they are omitted from
  // the submitted input. When absent the update preserves whatever value is
  // already stored in the database (company default applies on the card page).
  cta_label?: string
  cta_url?: string
  wa_notify_enabled: boolean
  show_optin_form: boolean
  // Optional: only include when the photo was explicitly changed.
  // undefined  → preserve the existing DB value (no photo action taken)
  // null       → user explicitly removed their photo
  // string     → user uploaded a new photo; value is the new public URL
  photo_url?: string | null
}

// ---------------------------------------------------------------------------
// requestAdditionalCards
//
// Company Admin places a physical NFC card order request.
// Inserts a card_orders row and notifies Luke via email.
//
// NOTE: max_staff_cards is NOT bumped here. Luke manually increases the limit
// once he has confirmed payment and is ready to ship. This is intentional —
// the system trusts Luke to handle fulfilment and payment confirmation.
// ---------------------------------------------------------------------------

export type RequestAdditionalCardsInput = {
  quantity: number
  deliveryAddress: string
  contactName: string
  contactPhone: string
  notes: string | null
}

export async function requestAdditionalCards(
  input: RequestAdditionalCardsInput
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  // Resolve company — regular admin or super admin impersonating a company
  const impersonation = await getImpersonationState()
  let companyId: string | null = null

  if (impersonation?.companyId) {
    const { data: adminRecord } = await supabase
      .from('company_admins').select('role').eq('user_id', user.id).single()
    if (!adminRecord || !['admin', 'super_admin'].includes(adminRecord.role)) {
      return { error: 'Unauthorised' }
    }
    companyId = impersonation.companyId
  } else {
    const { data: adminRecord } = await supabase
      .from('company_admins')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle()
    companyId = adminRecord?.company_id ?? null
  }

  if (!companyId) return { error: 'No company found for this account.' }

  // Validate
  const qty = Math.round(input.quantity)
  if (qty < 1 || qty > 100) return { error: 'Quantity must be between 1 and 100.' }
  if (!input.deliveryAddress.trim()) return { error: 'Delivery address is required.' }
  if (!input.contactName.trim()) return { error: 'Contact name is required.' }

  // Fetch company name for the notification email
  const adminAny = supabaseAdmin as any
  const { data: company } = await adminAny
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .single()
  const companyName: string = company?.name ?? 'Unknown Company'

  // INSERT — card_orders has no INSERT policy for company admins so use admin client.
  // The admin client bypasses RLS; company scope is ensured by the explicit company_id value.
  const { error: insertError } = await adminAny
    .from('card_orders')
    .insert({
      company_id: companyId,
      quantity: qty,
      delivery_address: input.deliveryAddress.trim(),
      contact_name: input.contactName.trim(),
      contact_phone: input.contactPhone.trim() || null,
      notes: input.notes?.trim() || null,
      status: 'pending',
    })

  if (insertError) return { error: insertError.message }

  // Notify Luke — fire and forget (failure must not block the order)
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (adminEmail) {
    try {
      const { getResend, FROM_ADDRESS } = await import('@/lib/email/resend')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
      const cardLabel = qty === 1 ? '1 card' : `${qty} cards`
      await getResend().emails.send({
        from: FROM_ADDRESS,
        to: adminEmail,
        subject: `New card order: ${companyName} — ${cardLabel}`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:8px;">New NFC Card Order</h1>
  <p style="color:#475569;margin-bottom:24px;">A company admin has submitted a card order request.</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#64748b;width:38%;">Company</td>
      <td style="padding:10px 0;font-size:13px;font-weight:700;color:#0f172a;">${companyName}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;">Quantity</td>
      <td style="padding:10px 0;font-size:13px;font-weight:700;color:#0f172a;">${cardLabel}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;vertical-align:top;">Delivery address</td>
      <td style="padding:10px 0;font-size:13px;color:#0f172a;white-space:pre-line;">${input.deliveryAddress.trim()}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;">Contact</td>
      <td style="padding:10px 0;font-size:13px;color:#0f172a;">${input.contactName.trim()}${input.contactPhone.trim() ? ` · ${input.contactPhone.trim()}` : ''}</td>
    </tr>
    <tr style="border-top:1px solid #f1f5f9;">
      <td style="padding:10px 0;font-size:13px;color:#64748b;vertical-align:top;">Notes</td>
      <td style="padding:10px 0;font-size:13px;color:#64748b;">${input.notes?.trim() || '—'}</td>
    </tr>
  </table>
  <a href="${appUrl}/admin/fulfillment"
     style="display:inline-block;padding:12px 24px;background:#0d9488;color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
    View in Fulfillment Panel →
  </a>
  <hr style="margin:40px 0;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;">Tapley Connect · Card Order Notification</p>
</body>
</html>`,
      })
    } catch {
      // Non-fatal — email failure must not block the order
    }
  }

  return {}
}

export async function updateStaffCard(
  staffCardId: string,
  input: UpdateStaffCardInput
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  if (!input.full_name.trim()) return { error: 'Full name is required.' }
  if (!input.job_title.trim()) return { error: 'Job title is required.' }

  // Fetch existing card to get the NFC slug for ISR bust — done before the update
  // so we have the slug even if nfc_card_id were somehow changed (it can't be here)
  const { data: existing } = await supabase
    .from('staff_cards')
    .select('nfc_card_id, nfc_cards(slug)')
    .eq('id', staffCardId)
    .single()

  // Normalise phone numbers to E.164 (+27...)
  const phone = input.phone.trim() ? normalisePhoneNumber(input.phone.trim()) : null
  // WhatsApp defaults to work phone if left blank
  const whatsappNumber = input.whatsapp_number.trim()
    ? normalisePhoneNumber(input.whatsapp_number.trim())
    : phone

  // Same guard rails as the staff self-edit path: an admin typing a malformed
  // number produces a dead primary CTA just as easily as a staff member does.
  if (phone && !isValidPhoneNumber(phone)) {
    return { error: 'That phone number does not look right. Use the full number, e.g. 082 123 4567.' }
  }
  if (whatsappNumber && !isValidPhoneNumber(whatsappNumber)) {
    return { error: 'That WhatsApp number does not look right. Use the full mobile number, e.g. 082 123 4567.' }
  }

  // Strip empty values, then sanitise: adds a missing https://, and drops
  // anything that is not http(s) — javascript: in a link would be stored XSS
  // on a public page.
  const rawLinks: Record<string, string> = {}
  for (const [key, val] of Object.entries(input.social_links)) {
    if (val && val.trim()) {
      rawLinks[key] = val.trim()
    }
  }
  const socialLinks = sanitiseUrlMap(rawLinks)

  // Build update payload. photo_url is optional: only include it when the
  // caller explicitly changed the photo (upload or remove). Omitting it
  // preserves whatever value is currently stored in the database so a plain
  // "save other fields" action can never accidentally clear a photo.
  const photoUpdate = 'photo_url' in input ? { photo_url: input.photo_url } : {}

  // cta_label / cta_url are only written when present in the input.
  // The admin edit UI no longer exposes these fields — omitting them here
  // preserves any existing per-card overrides already stored in the database.
  const ctaUpdate = {
    ...(typeof input.cta_label !== 'undefined' ? { cta_label: input.cta_label.trim() || null } : {}),
    // Sanitised: this ends up in an href on a public page.
    ...(typeof input.cta_url !== 'undefined'
      ? { cta_url: sanitiseExternalUrl(input.cta_url) }
      : {}),
  }

  const { error } = await supabase
    .from('staff_cards')
    .update({
      full_name: input.full_name.trim(),
      job_title: input.job_title.trim(),
      department: input.department.trim() || null,
      bio: input.bio.trim() || null,
      phone,
      email: input.email.trim() || null,
      whatsapp_number: whatsappNumber,
      show_phone: input.show_phone,
      show_email: input.show_email,
      social_links: socialLinks,
      ...ctaUpdate,
      wa_notify_enabled: input.wa_notify_enabled,
      show_optin_form: input.show_optin_form,
      ...photoUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', staffCardId)

  if (error) return { error: error.message }

  // Bust ISR cache so the public card page reflects changes immediately
  if (existing?.nfc_card_id) {
    const nfcCard = Array.isArray(existing.nfc_cards)
      ? existing.nfc_cards[0]
      : existing.nfc_cards
    const slug = (nfcCard as { slug: string } | null)?.slug
    if (slug) {
      revalidatePath(`/c/${slug}`)
    }
  }

  return {}
}
