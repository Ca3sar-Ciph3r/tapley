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
