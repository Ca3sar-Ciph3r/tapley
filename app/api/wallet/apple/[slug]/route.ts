// app/api/wallet/apple/[slug]/route.ts
//
// Method:  GET
// Status:  STUB — returns 503 until Apple Developer signing certificates are available.
//
// TODO: Requires Apple Developer Pass Type ID + signing certificate.
// See https://developer.apple.com/documentation/walletpasses
//
// Required before implementing:
//   1. Apple Developer account ($99/year) — developer.apple.com
//   2. Pass Type ID registered in the Apple Developer portal:
//      developer.apple.com/account/resources/identifiers/list/passTypeId
//   3. Certificate (.p12) + private key downloaded from the Apple Developer portal
//   4. Add env vars:
//        APPLE_PASS_TYPE_ID     — e.g. pass.co.za.tapleyconnect.staff
//        APPLE_PASS_CERT_P12    — .p12 file contents, base64-encoded
//        APPLE_PASS_CERT_PASS   — .p12 password
//        APPLE_TEAM_ID          — 10-character Apple Team ID
//   5. Install @walletpass/pass-js or passkit-generator for .pkpass generation

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Apple Wallet coming soon' },
    { status: 503 }
  )
}
