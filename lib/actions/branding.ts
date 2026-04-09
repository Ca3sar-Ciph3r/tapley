'use server'

// lib/actions/branding.ts
//
// Server actions for company branding mutations.
//
// updateCompanyBranding — updates the companies table with all branding fields,
//   then revalidates every non-deactivated NFC card slug for the company so
//   all public card pages pick up the new branding within seconds.
//
// Supabase client: server client (RLS active — admin_update_own policy on companies)
// Admin client: NOT used — dashboard actions must go through the server client.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardTemplate = 'minimal' | 'bold' | 'split'

export type UpdateCompanyBrandingInput = {
  name: string
  tagline: string
  website: string
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  card_template: CardTemplate
  cta_label: string
  cta_url: string
  logo_url: string | null
}

// ---------------------------------------------------------------------------
// updateCompanyBranding
//
// Validates and persists all branding fields for the current user's company.
// After saving, revalidates ALL non-deactivated NFC card slugs so every public
// card page immediately reflects the new branding (Rule 2: ISR + revalidatePath).
// ---------------------------------------------------------------------------

export async function updateCompanyBranding(
  input: UpdateCompanyBrandingInput
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // Resolve company_id — RLS on company_admins scopes to the current user
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord?.company_id) {
    return { error: 'No company found for this account.' }
  }

  const companyId = adminRecord.company_id

  // Validate hex colour values
  const hexPattern = /^#[0-9A-Fa-f]{6}$/
  if (!hexPattern.test(input.brand_primary_color)) {
    return { error: 'Primary colour must be a valid hex value (e.g. #16181D).' }
  }
  if (!hexPattern.test(input.brand_secondary_color)) {
    return { error: 'Secondary colour must be a valid hex value (e.g. #F59608).' }
  }

  // Validate card template
  const validTemplates: CardTemplate[] = ['minimal', 'bold', 'split']
  if (!validTemplates.includes(input.card_template)) {
    return { error: 'Invalid card template.' }
  }

  // Persist — RLS admin_update_own policy enforces company scope
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      name: input.name.trim() || undefined,
      tagline: input.tagline.trim() || null,
      website: input.website.trim() || null,
      brand_primary_color: input.brand_primary_color,
      brand_secondary_color: input.brand_secondary_color,
      brand_dark_mode: input.brand_dark_mode,
      card_template: input.card_template,
      cta_label: input.cta_label.trim() || 'Send me a WhatsApp',
      cta_url: input.cta_url.trim() || null,
      logo_url: input.logo_url,
    })
    .eq('id', companyId)

  if (updateError) return { error: updateError.message }

  // Revalidate every non-deactivated NFC card page for this company.
  // We query nfc_cards directly (not via staff_cards) to catch cards in inventory
  // that may be unassigned but still have a valid slug in circulation.
  const { data: nfcCards } = await supabase
    .from('nfc_cards')
    .select('slug')
    .eq('company_id', companyId)
    .neq('order_status', 'deactivated')

  if (nfcCards && nfcCards.length > 0) {
    await Promise.all(nfcCards.map(c => revalidatePath(`/c/${c.slug}`)))
  }

  return {}
}
