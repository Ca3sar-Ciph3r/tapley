// app/api/qr/[slug]/route.ts
//
// Method:  GET
// Auth:    Required — company admin or staff member (their own card).
// Purpose: Generate and return a QR code PNG for a given slug.
//          Used in the dashboard for downloading and email signatures.
//
// Response: Content-Type: image/png
//
// URL encoded into QR: always append ?src=qr param
//   https://tapleyconnect.co.za/c/[slug]?src=qr
//
// Error correction: Level H — allows for a logo overlay on the QR if needed post-MVP.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQRCodeBuffer } from '@/lib/utils/qr'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Auth check — must be logged in
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new NextResponse('Unauthorised', { status: 401 })
    }

    const pngBuffer = await generateQRCodeBuffer(slug)

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${slug}.png"`,
        // Cache for 1 hour — slug never changes, QR content is stable
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[qr]', error)
    return new NextResponse('Server error', { status: 500 })
  }
}
