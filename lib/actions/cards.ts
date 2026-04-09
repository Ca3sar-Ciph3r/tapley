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
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'

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

  // Resolve this admin's company_id (RLS on company_admins enforces visibility)
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord?.company_id) {
    return { error: 'No company found for this account.' }
  }

  const companyId = adminRecord.company_id

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

  // Verify the NFC card exists and belongs to the same company
  // RLS on nfc_cards (company_id = auth_company_id()) also enforces this
  const { data: nfcCard } = await supabase
    .from('nfc_cards')
    .select('id, slug, company_id, order_status')
    .eq('id', nfcCardId)
    .single()

  if (!nfcCard) return { error: 'NFC card not found or not in your company inventory.' }
  if (nfcCard.order_status === 'deactivated') {
    return { error: 'This NFC card has been deactivated and cannot be assigned.' }
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
  cta_label: string
  cta_url: string
  wa_notify_enabled: boolean
  show_optin_form: boolean
  photo_url: string | null
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

  // Strip empty social link values — store only non-empty keys
  const socialLinks: Record<string, string> = {}
  for (const [key, val] of Object.entries(input.social_links)) {
    if (val && val.trim()) {
      socialLinks[key] = val.trim()
    }
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
      cta_label: input.cta_label.trim() || null,
      cta_url: input.cta_url.trim() || null,
      wa_notify_enabled: input.wa_notify_enabled,
      show_optin_form: input.show_optin_form,
      photo_url: input.photo_url,
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
