// lib/utils/vcf.ts
//
// vCard 3.0 file generator.
// Used by the /c/[slug]/vcf API route to stream a contact file.
// The file is downloaded by the browser and imported into the user's contacts app.
//
// Format: vCard 3.0 — broadest compatibility with iOS and Android.
// Line endings: CRLF (\r\n) as per RFC 6350.

interface StaffCardData {
  full_name: string
  job_title: string
  phone?: string | null
  whatsapp_number?: string | null
  email?: string | null
  photo_url?: string | null
  social_links?: {
    linkedin?: string
    instagram?: string
    twitter?: string
    facebook?: string
    website?: string
    calendly?: string
  } | null
}

interface CompanyData {
  name: string
  website?: string | null
}

/**
 * Generate a vCard 3.0 string for a staff member.
 *
 * @param staffCard  Staff card data from the database
 * @param company    Company data for ORG and URL fields
 * @param slug       The nfc_card slug — used to build the card page URL in the NOTE field
 */
export function generateVCF(
  staffCard: StaffCardData,
  company: CompanyData,
  slug: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const nameParts = staffCard.full_name.trim().split(' ')
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : staffCard.full_name

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${staffCard.full_name}`,
    `N:${lastName};${firstName};;;`,
    `ORG:${company.name}`,
    `TITLE:${staffCard.job_title}`,
  ]

  if (staffCard.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${staffCard.phone}`)
  }

  if (
    staffCard.whatsapp_number &&
    staffCard.whatsapp_number !== staffCard.phone
  ) {
    lines.push(`TEL;TYPE=CELL:${staffCard.whatsapp_number}`)
  }

  if (staffCard.email) {
    lines.push(`EMAIL;TYPE=WORK:${staffCard.email}`)
  }

  const website = staffCard.social_links?.website ?? company.website
  if (website) {
    lines.push(`URL:${website}`)
  }

  if (staffCard.photo_url) {
    lines.push(`PHOTO;VALUE=URI:${staffCard.photo_url}`)
  }

  if (staffCard.social_links?.linkedin) {
    lines.push(`X-SOCIALPROFILE;type=linkedin:${staffCard.social_links.linkedin}`)
  }

  lines.push(`NOTE:Digital card: ${appUrl}/c/${slug}`)
  lines.push('END:VCARD')

  return lines.join('\r\n')
}
