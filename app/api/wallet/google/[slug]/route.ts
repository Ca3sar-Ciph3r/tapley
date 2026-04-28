// app/api/wallet/google/[slug]/route.ts
//
// Method:  GET
// Auth:    None — public endpoint, accessed from the card page by the card recipient.
// Purpose: Build a signed Google Wallet JWT and redirect to the Google Wallet save URL.
//          The recipient's browser opens Google Wallet and prompts "Add to Wallet".
//
// Supabase: supabaseAdmin — reads public card data (same pattern as card page).
//
// Tracking: Inserts a card_views row with source='wallet' before the redirect.
//           Fire-and-forget — tracking failure must never block the redirect.
//
// Docs: https://developers.google.com/wallet/generic

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildGoogleWalletJWT } from '@/lib/wallet/google'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Guard: env vars must be configured before we try to build a JWT
    if (
      !process.env.GOOGLE_WALLET_ISSUER_ID ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json(
        { error: 'Google Wallet not configured' },
        { status: 503 }
      )
    }

    // Step 1: Look up nfc_card by slug (same as card page rule 1)
    const { data: nfcCard } = await supabaseAdmin
      .from('nfc_cards')
      .select('id, company_id, order_status')
      .eq('slug', slug)
      .single()

    if (!nfcCard) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    if (nfcCard.order_status === 'deactivated') {
      return NextResponse.json({ error: 'Card is deactivated' }, { status: 410 })
    }

    // Step 2: Find active staff card with company data
    const { data: staffCard } = await supabaseAdmin
      .from('staff_cards')
      .select(`
        id, full_name, job_title, email, phone, whatsapp_number,
        companies (
          name, logo_url, brand_primary_color
        )
      `)
      .eq('nfc_card_id', nfcCard.id)
      .eq('company_id', nfcCard.company_id)
      .eq('is_active', true)
      .single()

    if (!staffCard) {
      return NextResponse.json({ error: 'Card not assigned' }, { status: 404 })
    }

    const company = Array.isArray(staffCard.companies)
      ? staffCard.companies[0]
      : staffCard.companies

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Step 3: Build Google Wallet JWT
    const walletJwt = buildGoogleWalletJWT(
      {
        full_name: staffCard.full_name,
        job_title: staffCard.job_title,
        email: staffCard.email ?? null,
        phone: staffCard.phone ?? null,
        whatsapp_number: staffCard.whatsapp_number ?? null,
      },
      {
        name: company.name,
        logo_url: company.logo_url ?? null,
        brand_primary_color: company.brand_primary_color,
      },
      slug
    )

    // Step 4: Track wallet add (fire-and-forget — must not block the redirect)
    // A unique per-request session ID prevents the 30-minute dedup from collapsing
    // separate wallet adds from different people into one event.
    const sessionId = `wallet-${slug}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    supabaseAdmin
      .from('card_views')
      .insert({
        nfc_card_id: nfcCard.id,
        staff_card_id: staffCard.id,
        session_id: sessionId,
        source: 'wallet',
        device_type: 'mobile',
        os: 'android',
        browser: 'other',
        country: 'ZA',
      })
      .then(
        () => {},
        (err: unknown) =>
          console.error('[wallet/google] view event insert failed:', err)
      )

    // Step 5: Redirect to Google Wallet save URL
    return NextResponse.redirect(
      `https://pay.google.com/gp/v/save/${walletJwt}`
    )
  } catch (error) {
    console.error('[wallet/google]', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
