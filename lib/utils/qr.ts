// lib/utils/qr.ts
//
// QR code generation utilities.
// Used by the /api/qr/[slug] route and the email signature generator.
//
// Package: qrcode (npm install qrcode && npm install --save-dev @types/qrcode)
//
// URL encoded: always append ?src=qr so analytics can distinguish QR scans from NFC taps.
// Error correction level H: allows a logo overlay on the QR in future (post-MVP).

import QRCode from 'qrcode'

function buildQrUrl(slug: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  return `${appUrl}/c/${slug}?src=qr`
}

/**
 * Generate a QR code as a PNG Buffer (for streaming via API route).
 */
export async function generateQRCodeBuffer(slug: string): Promise<Buffer> {
  const url = buildQrUrl(slug)
  return QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  })
}

/**
 * Generate a QR code as a data URL (base64 PNG) for embedding in HTML.
 * Used by the email signature generator (client-side).
 */
export async function generateQRCodeDataURL(slug: string): Promise<string> {
  const url = buildQrUrl(slug)
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  })
}

/**
 * Generate a QR code as an SVG string.
 * Used for print files where vector quality is needed.
 */
export async function generateQRCodeSVG(slug: string): Promise<string> {
  const url = buildQrUrl(slug)
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
  })
}
