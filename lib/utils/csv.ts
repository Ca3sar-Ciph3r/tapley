// lib/utils/csv.ts
//
// CSV parsing and validation for the bulk staff card import.
// No external dependencies — pure TypeScript parser.
//
// Flexible header matching:
//   Supports "full_name", "Full Name", "name", "position", "wa", etc.
//   See HEADER_MAP for all aliases.
//
// Output:
//   Each ParsedStaffRow carries an `errors` array.
//   Empty errors = valid row. Non-empty = the row must be excluded from import.

import { normalisePhoneNumber } from '@/lib/utils/whatsapp'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParsedStaffRow = {
  /** 1-based row number in the file (excluding the header row) */
  rowIndex: number
  full_name: string
  job_title: string
  department: string | null
  email: string | null
  /** Already normalised to E.164 (+27...) or null */
  phone: string | null
  /** Already normalised to E.164 (+27...) or null — defaults to phone if blank */
  whatsapp_number: string | null
  /** Empty array = valid. Non-empty = row has errors and cannot be imported. */
  errors: string[]
}

export type CSVParseResult = {
  rows: ParsedStaffRow[]
  /** Headers found in the CSV that didn't match any known column */
  unknownHeaders: string[]
  /** Required columns missing from the header row (full_name, job_title) */
  missingRequired: string[]
}

// ---------------------------------------------------------------------------
// Header aliases — all lowercased, matched case-insensitively
// ---------------------------------------------------------------------------

const HEADER_MAP: Readonly<Record<string, string>> = {
  // full_name
  full_name: 'full_name',
  'full name': 'full_name',
  name: 'full_name',
  'staff name': 'full_name',
  'employee name': 'full_name',
  // job_title
  job_title: 'job_title',
  'job title': 'job_title',
  title: 'job_title',
  position: 'job_title',
  role: 'job_title',
  designation: 'job_title',
  // department
  department: 'department',
  dept: 'department',
  team: 'department',
  division: 'department',
  // email
  email: 'email',
  'email address': 'email',
  'work email': 'email',
  'e-mail': 'email',
  'e mail': 'email',
  // phone
  phone: 'phone',
  'phone number': 'phone',
  'work phone': 'phone',
  tel: 'phone',
  telephone: 'phone',
  'contact number': 'phone',
  mobile: 'phone',
  'mobile number': 'phone',
  // whatsapp_number
  whatsapp_number: 'whatsapp_number',
  whatsapp: 'whatsapp_number',
  'whatsapp number': 'whatsapp_number',
  wa: 'whatsapp_number',
  'wa number': 'whatsapp_number',
  'whatsapp no': 'whatsapp_number',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email)
}

/**
 * Attempt E.164 normalisation for a phone string.
 * Returns null if the input doesn't look like a plausible phone number.
 */
function tryNormalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // Require at least 9 digits to be considered a phone number
  if (digits.length < 9) return null
  return normalisePhoneNumber(raw)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw CSV string into an array of validated ParsedStaffRow objects.
 *
 * The caller is responsible for reading the file content as a string
 * (e.g. via FileReader.readAsText in the browser).
 */
export function parseStaffCSV(text: string): CSVParseResult {
  const lines = splitCSVLines(text)

  if (lines.length < 2) {
    return {
      rows: [],
      unknownHeaders: [],
      missingRequired: ['full_name', 'job_title'],
    }
  }

  // --- Parse header row ---
  const rawHeaders = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase())
  const columnMap = new Map<string, number>() // canonical field → column index
  const unknownHeaders: string[] = []

  for (let i = 0; i < rawHeaders.length; i++) {
    const canonical = HEADER_MAP[rawHeaders[i]]
    if (canonical) {
      // First occurrence wins — ignore duplicate headers for the same field
      if (!columnMap.has(canonical)) {
        columnMap.set(canonical, i)
      }
    } else if (rawHeaders[i]) {
      unknownHeaders.push(rawHeaders[i])
    }
  }

  // --- Check required headers ---
  const missingRequired: string[] = []
  if (!columnMap.has('full_name')) missingRequired.push('full_name')
  if (!columnMap.has('job_title')) missingRequired.push('job_title')

  if (missingRequired.length > 0) {
    return { rows: [], unknownHeaders, missingRequired }
  }

  // --- Parse data rows ---
  const rows: ParsedStaffRow[] = []
  const seenEmails = new Set<string>() // tracks duplicates within this CSV

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // skip blank lines

    const cols = parseCSVRow(line)

    const get = (field: string): string => {
      const idx = columnMap.get(field)
      if (idx === undefined) return ''
      return (cols[idx] ?? '').trim()
    }

    const full_name = get('full_name')
    const job_title = get('job_title')
    const department = get('department') || null
    const emailRaw = get('email')
    const phoneRaw = get('phone')
    const waRaw = get('whatsapp_number')

    const errors: string[] = []

    // Required field checks
    if (!full_name) errors.push('Full name is required')
    if (!job_title) errors.push('Job title is required')

    // Email validation
    let email: string | null = null
    if (emailRaw) {
      if (!isValidEmail(emailRaw)) {
        errors.push(`Invalid email: "${emailRaw}"`)
      } else if (seenEmails.has(emailRaw.toLowerCase())) {
        errors.push(`Duplicate email in this file: "${emailRaw}"`)
      } else {
        email = emailRaw
        seenEmails.add(emailRaw.toLowerCase())
      }
    }

    // Phone normalisation
    let phone: string | null = null
    if (phoneRaw) {
      const normalised = tryNormalisePhone(phoneRaw)
      if (!normalised) {
        errors.push(`Cannot parse phone number: "${phoneRaw}"`)
      } else {
        phone = normalised
      }
    }

    // WhatsApp normalisation (defaults to phone if blank)
    let whatsapp_number: string | null = null
    if (waRaw) {
      const normalised = tryNormalisePhone(waRaw)
      if (!normalised) {
        errors.push(`Cannot parse WhatsApp number: "${waRaw}"`)
      } else {
        whatsapp_number = normalised
      }
    } else {
      whatsapp_number = phone // inherit work phone
    }

    rows.push({
      rowIndex: i,
      full_name,
      job_title,
      department,
      email,
      phone,
      whatsapp_number,
      errors,
    })
  }

  return { rows, unknownHeaders, missingRequired: [] }
}

/**
 * Returns a CSV template string the admin can download as a starting point.
 */
export function buildCSVTemplate(): string {
  const headers = ['full_name', 'job_title', 'department', 'email', 'phone', 'whatsapp_number']
  const example = ['Jane Smith', 'Sales Manager', 'Sales', 'jane@company.com', '0821234567', '']
  return [headers.join(','), example.join(',')].join('\n')
}

// ---------------------------------------------------------------------------
// Internal: CSV line splitter (handles quoted newlines)
// ---------------------------------------------------------------------------

function splitCSVLines(text: string): string[] {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++ // skip \n in CRLF
      if (current.trim()) lines.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current)
  return lines
}

// ---------------------------------------------------------------------------
// Internal: Single CSV row parser (handles quoted fields + escaped quotes)
// ---------------------------------------------------------------------------

function parseCSVRow(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field ("" → ")
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cols.push(current)
  return cols
}
