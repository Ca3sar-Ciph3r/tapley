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
 * Generate a QR code as PNG bytes (for streaming via API route).
 *
 * Returned as a Uint8Array backed by a plain ArrayBuffer rather than the Buffer
 * that `qrcode` hands back: Node's Buffer is typed over ArrayBufferLike, which
 * includes SharedArrayBuffer and so is not assignable to the web BodyInit that
 * `new NextResponse(...)` expects.
 */
export async function generateQRCodeBuffer(
  slug: string
): Promise<Uint8Array<ArrayBuffer>> {
  const url = buildQrUrl(slug)
  const png = await QRCode.toBuffer(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  })
  return new Uint8Array(png)
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
