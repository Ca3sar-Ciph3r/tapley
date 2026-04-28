// lib/wallet/google.ts
//
// Builds a signed Google Wallet "Generic" pass JWT.
//
// The JWT is passed to https://pay.google.com/gp/v/save/[jwt] as a redirect.
// The browser opens Google Wallet and presents an "Add to Wallet" sheet.
//
// Required env vars:
//   GOOGLE_WALLET_ISSUER_ID          — issuer ID from Google Pay & Wallet Console
//   GOOGLE_SERVICE_ACCOUNT_EMAIL     — service account email
//   GOOGLE_SERVICE_ACCOUNT_KEY       — RSA private key, base64-encoded (no newlines)
//
// Algorithm: RS256 (required by Google Wallet JWT spec).
// Docs: https://developers.google.com/wallet/generic

import jwt from 'jsonwebtoken'

export interface StaffCardForWallet {
  full_name: string
  job_title: string
  email: string | null
  phone: string | null
  whatsapp_number: string | null
}

export interface CompanyForWallet {
  name: string
  logo_url: string | null
  brand_primary_color: string
}

export function buildGoogleWalletJWT(
  staffCard: StaffCardForWallet,
  company: CompanyForWallet,
  slug: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID ?? ''
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? ''
  const privateKeyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? ''

  // Decode base64 → PEM (stored without newlines to survive env var handling)
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8')

  // Build WhatsApp deeplink — strip '+' for wa.me format
  const waNumber = staffCard.whatsapp_number ?? staffCard.phone
  const waLink = waNumber ? `https://wa.me/${waNumber.replace('+', '')}` : null

  // Text modules — always show Name/Title/Company; conditionally show contact fields
  const textModulesData: Array<{ header: string; body: string }> = [
    { header: 'Name', body: staffCard.full_name },
    { header: 'Title', body: staffCard.job_title },
    { header: 'Company', body: company.name },
  ]

  if (staffCard.email) {
    textModulesData.push({ header: 'Email', body: staffCard.email })
  }
  if (staffCard.phone) {
    textModulesData.push({ header: 'Phone', body: staffCard.phone })
  }

  // Link modules — card URL always present; WhatsApp if number available
  const uris: Array<{ uri: string; description: string }> = [
    { uri: `${appUrl}/c/${slug}`, description: 'View card' },
  ]
  if (waLink) {
    uris.push({ uri: waLink, description: 'WhatsApp' })
  }

  // Generic pass object
  const genericObject: Record<string, unknown> = {
    id: `${issuerId}.${slug}`,
    classId: `${issuerId}.tapley_staff_card`,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    textModulesData,
    linksModuleData: { uris },
    barcode: {
      type: 'QR_CODE',
      value: `${appUrl}/c/${slug}?src=wallet`,
    },
    hexBackgroundColor: company.brand_primary_color,
    cardTitle: { defaultValue: { language: 'en', value: company.name } },
    subheader: { defaultValue: { language: 'en', value: staffCard.job_title } },
    header: { defaultValue: { language: 'en', value: staffCard.full_name } },
  }

  // Hero image is optional — only include if the company has a logo
  if (company.logo_url) {
    genericObject.heroImage = { sourceUri: { uri: company.logo_url } }
  }

  const payload = {
    iss: serviceAccountEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      genericObjects: [genericObject],
    },
  }

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' })
}
