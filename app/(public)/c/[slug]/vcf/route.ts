// app/(public)/c/[slug]/vcf/route.ts
//
// Method:   GET
// Auth:     None — public route
// Purpose:  Generate and stream a .vcf (vCard 3.0) contact file.
//           Browser prompts "Save to Contacts" on iOS and Android.
//
// Supabase: supabaseAdmin (service role) — public read, no user session.
//
// After serving: POST /api/view-event/vcf-download to mark vcf_downloaded = true
//               on the card_view record. This is done client-side by the card page
//               when the user taps "Save Contact" — not by this route.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateVCF } from '@/lib/utils/vcf'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    // Step 1: Look up nfc_card by slug
    const { data: nfcCard, error: nfcError } = await supabaseAdmin
      .from('nfc_cards')
      .select('id')
      .eq('slug', slug)
      .single()

    if (nfcError || !nfcCard) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Step 2: Find active staff_card
    const { data: staffCard, error: staffError } = await supabaseAdmin
      .from('staff_cards')
      .select('*, companies(name, website)')
      .eq('nfc_card_id', nfcCard.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staffCard) {
      return new NextResponse('Card not assigned', { status: 404 })
    }

    const company = Array.isArray(staffCard.companies)
      ? staffCard.companies[0]
      : staffCard.companies

    // Step 3: Generate vCard content
    const vcfContent = generateVCF(staffCard, company, slug)
    const filename = `${staffCard.full_name.replace(/\s+/g, '_')}.vcf`

    return new NextResponse(vcfContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        // No caching — always serve fresh contact details
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[vcf]', error)
    return new NextResponse('Server error', { status: 500 })
  }
}
