'use server'

// lib/actions/staff-self-edit.ts
//
// Server action for staff members editing their own card.
//
// IMPORTANT: Only the fields listed in ROLES.md "Staff Card Self-Edit Limits"
// are written. The following are intentionally excluded from the update payload:
//   full_name, job_title, department, phone, email, nfc_card_id, is_active,
//   show_optin_form, company_id
//
// Card identity is resolved by user_id = auth.uid() — NEVER by a passed ID.
// This prevents IDOR: a staff member cannot edit another person's card even if
// they fabricate a different staffCardId.
//
// RLS policy "staff_update_own" (uses user_id = auth.uid()) provides the
// database-level enforcement. The application layer mirrors this restriction.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UpdateOwnStaffCardInput = {
  bio: string
  whatsapp_number: string
  wa_notify_enabled: boolean
  social_links: {
    linkedin?: string
    instagram?: string
    twitter?: string
    facebook?: string
    website?: string
    calendly?: string
  }
  // Optional: only include when the photo was explicitly changed.
  // undefined  → preserve the existing DB value (no photo action taken)
  // null       → user explicitly removed their photo
  // string     → user uploaded a new photo; value is the new public URL
  photo_url?: string | null
}

// ---------------------------------------------------------------------------
// updateOwnStaffCard
// ---------------------------------------------------------------------------

export async function updateOwnStaffCard(
  input: UpdateOwnStaffCardInput
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Validate bio length (matches database check constraint)
  if (input.bio.trim().length > 200) {
    return { error: 'Bio must be 200 characters or fewer.' }
  }

  // Resolve the staff card by user_id — not by a passed ID.
  // RLS "staff_select_own" scopes this to the authenticated user only.
  const { data: card, error: fetchError } = await supabase
    .from('staff_cards')
    .select('id, nfc_card_id, nfc_cards ( slug )')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (fetchError || !card) {
    return { error: 'Staff card not found.' }
  }

  // Normalise WhatsApp number to E.164 format (+27...)
  const whatsappNumber = input.whatsapp_number.trim()
    ? normalisePhoneNumber(input.whatsapp_number.trim())
    : null

  // Strip empty social link values — store only non-empty keys
  const socialLinks: Record<string, string> = {}
  for (const [key, val] of Object.entries(input.social_links)) {
    if (val && val.trim()) socialLinks[key] = val.trim()
  }

  // Build update payload. photo_url is optional: only include it when the
  // caller explicitly changed the photo (upload or remove). Omitting it
  // preserves whatever value is currently stored in the database so a plain
  // "save other fields" action can never accidentally clear a photo.
  const photoUpdate = 'photo_url' in input ? { photo_url: input.photo_url } : {}

  // Perform the update.
  // .eq('user_id', user.id) is redundant given RLS, but provides defence-in-depth.
  // CRITICAL: Do NOT add full_name, job_title, department, phone, email,
  // show_phone, show_email, cta_label, cta_url, or any other admin-only field here.
  const { error: updateError } = await supabase
    .from('staff_cards')
    .update({
      bio: input.bio.trim() || null,
      whatsapp_number: whatsappNumber,
      wa_notify_enabled: input.wa_notify_enabled,
      social_links: socialLinks,
      ...photoUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (updateError) return { error: updateError.message }

  // Bust ISR cache so /c/[slug] immediately reflects the changes.
  if (card.nfc_card_id) {
    const nfcRaw = Array.isArray(card.nfc_cards) ? card.nfc_cards[0] : card.nfc_cards
    const slug = (nfcRaw as { slug: string } | null)?.slug
    if (slug) revalidatePath(`/c/${slug}`)
  }

  return {}
}
