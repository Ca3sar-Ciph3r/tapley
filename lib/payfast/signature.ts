// lib/payfast/signature.ts
//
// PayFast MD5 signature generation.
//
// PayFast uses PHP's urlencode() semantics:
//   - spaces → '+'
//   - '!', '~', '*', "'", '(', ')' → percent-encoded (unlike JS encodeURIComponent)
//
// The signature is an MD5 hash of all form params (excluding 'signature') joined
// as key=value pairs with '&', optionally followed by &passphrase=<passphrase>.

import { createHash } from 'crypto'

function phpUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/[!~*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function generatePayFastSignature(
  params: Record<string, string>,
  passphrase: string,
): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${phpUrlencode(v)}`)
    .join('&')

  const str = passphrase
    ? `${pairs}&passphrase=${phpUrlencode(passphrase)}`
    : pairs

  return createHash('md5').update(str).digest('hex')
}

export function verifyPayFastSignature(
  rawBody: string,
  passphrase: string,
): boolean {
  const params = new URLSearchParams(rawBody)
  const received = params.get('signature')
  if (!received) return false

  const pairs = [...params.entries()]
    .filter(([k]) => k !== 'signature')
    .map(([k, v]) => `${k}=${phpUrlencode(v.trim())}`)
    .join('&')

  const str = passphrase
    ? `${pairs}&passphrase=${phpUrlencode(passphrase)}`
    : pairs

  const expected = createHash('md5').update(str).digest('hex')
  return expected === received
}
