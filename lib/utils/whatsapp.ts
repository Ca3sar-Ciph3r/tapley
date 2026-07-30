// lib/utils/whatsapp.ts
//
// WhatsApp deeplink builder and phone number normalisation.
// Used by the card page for the WhatsApp CTA button.
//
// All phone numbers in the database are stored in E.164 format: +27821234567
// See DATABASE.md and CLAUDE.md Rule 6.

/**
 * Normalise a South African phone number to E.164 format.
 * Strips all non-digit characters, then:
 *   0821234567  → +27821234567
 *   27821234567 → +27821234567
 *   +27821234567 → +27821234567 (unchanged)
 */
export function normalisePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '')

  if (digits.startsWith('0')) {
    return '+27' + digits.slice(1)
  }

  if (digits.startsWith('27')) {
    return '+' + digits
  }

  // Assume already in E.164-ish format
  return '+' + digits
}

/**
 * Is this a usable E.164 number for a wa.me link?
 *
 * normalisePhoneNumber is pure string surgery and will happily return "+" for
 * an empty string or "+123" for junk. Both produce a wa.me link that opens to
 * nothing — and this is the card's PRIMARY call to action, so a dud number
 * means the main button silently does nothing while the card still looks
 * perfect. That is the worst kind of breakage: invisible to the person who
 * caused it and to the person who tapped the card.
 *
 * Deliberately permissive on country: staff may legitimately carry a non-SA
 * number. It only enforces the shape of a plausible international mobile.
 */
export function isValidPhoneNumber(e164: string | null | undefined): boolean {
  if (!e164) return false
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return false

  // South African numbers are +27 followed by exactly 9 digits. Worth checking
  // specifically: a dropped or doubled leading zero is the most common local
  // mistake and produces a number that looks right but is not.
  if (e164.startsWith('+27')) return /^\+27\d{9}$/.test(e164)

  return true
}

/**
 * Build a wa.me deeplink that pre-fills a greeting message.
 *
 * @param phoneNumber  E.164 format (+27821234567)
 * @param staffFirstName  First name of the staff member (for personalised greeting)
 */
export function buildWaLink(phoneNumber: string, staffFirstName: string): string {
  // wa.me requires the number without the leading +
  const number = phoneNumber.replace('+', '')
  const message = encodeURIComponent(
    `Hi ${staffFirstName} 👋 I just tapped your Tapley Connect card. Great to meet you!`
  )
  return `https://wa.me/${number}?text=${message}`
}

/**
 * Extract first name from a full name string.
 * "Sifiso Radebe" → "Sifiso"
 */
export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName
}
