'use client'

// app/(dashboard)/dashboard/my-card/signature/page.tsx
//
// Rendering:  Client component — HTML generation is entirely client-side.
// Auth:       Staff Member (or Company Admin accessing their own card).
// Purpose:    Generate a copy-pasteable HTML email signature.
//
// Output:
//   - Visual preview of the rendered signature
//   - Raw HTML in a <pre> with "Copy to clipboard" button
//   - Step-by-step paste instructions for Gmail and Outlook
//
// HTML snippet includes:
//   - Name, job title, company name
//   - Phone (if show_phone = true and phone is set)
//   - Email (if show_email = true and email is set)
//   - QR code image via hosted /api/qr/[slug] URL (works in email clients)
//   - "View my digital card →" link to /c/[slug]
//
// No server call for HTML generation — derived from fetched staff_card data.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Describes the raw shape returned by the Supabase join query.
// Explicit cast is required because the generated client types don't always
// surface joined table columns through TypeScript's inference.
type RawRow = {
  full_name: string
  job_title: string
  department: string | null
  phone: string | null
  email: string | null
  show_phone: boolean
  show_email: boolean
  photo_url: string | null
  nfc_card_id: string | null
  nfc_cards: { slug: string } | { slug: string }[] | null
  companies:
    | { name: string; brand_primary_color: string; website: string | null }
    | { name: string; brand_primary_color: string; website: string | null }[]
    | null
}

type CardData = {
  full_name: string
  job_title: string
  department: string | null
  phone: string | null
  email: string | null
  show_phone: boolean
  show_email: boolean
  photo_url: string | null
  nfc_slug: string | null
  company: {
    name: string
    brand_primary_color: string
    website: string | null
  }
}

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function buildSignatureHtml(card: CardData, appUrl: string): string {
  const primary = card.company.brand_primary_color || '#16181D'
  const cardUrl = card.nfc_slug ? `${appUrl}/c/${card.nfc_slug}` : null
  const qrUrl = card.nfc_slug ? `${appUrl}/api/qr/${card.nfc_slug}` : null

  const phoneRow =
    card.show_phone && card.phone
      ? `<tr>
          <td style="padding: 1px 0; color: #64748b; font-size: 13px; font-family: Arial, sans-serif;">
            📞 <a href="tel:${card.phone}" style="color: #64748b; text-decoration: none;">${card.phone}</a>
          </td>
        </tr>`
      : ''

  const emailRow =
    card.show_email && card.email
      ? `<tr>
          <td style="padding: 1px 0; color: #64748b; font-size: 13px; font-family: Arial, sans-serif;">
            ✉️ <a href="mailto:${card.email}" style="color: #64748b; text-decoration: none;">${card.email}</a>
          </td>
        </tr>`
      : ''

  const qrCell = qrUrl && cardUrl
    ? `<td style="padding-left: 20px; vertical-align: top; border-left: 1px solid #e2e8f0;">
        <a href="${cardUrl}" style="display: block; text-decoration: none;">
          <img
            src="${qrUrl}"
            alt="Scan to view digital card"
            width="80"
            height="80"
            style="display: block; border: 0;"
          />
          <p style="margin: 4px 0 0; font-size: 10px; color: #94a3b8; font-family: Arial, sans-serif; text-align: center;">
            Scan me
          </p>
        </a>
      </td>`
    : ''

  const cardLinkRow = cardUrl
    ? `<tr>
        <td style="padding-top: 8px;">
          <a
            href="${cardUrl}"
            style="
              display: inline-block;
              padding: 5px 12px;
              background-color: ${primary};
              color: #ffffff;
              font-size: 12px;
              font-family: Arial, sans-serif;
              font-weight: bold;
              text-decoration: none;
              border-radius: 4px;
            "
          >
            View my digital card →
          </a>
        </td>
      </tr>`
    : ''

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif;">
  <tr>
    <td style="padding-right: 16px; vertical-align: top; border-right: 3px solid ${primary};">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size: 16px; font-weight: bold; color: #0f172a; font-family: Arial, sans-serif; padding-bottom: 2px;">
            ${escapeHtml(card.full_name)}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: ${primary}; font-family: Arial, sans-serif; padding-bottom: 8px;">
            ${escapeHtml(card.job_title)}${card.department ? ` &bull; ${escapeHtml(card.department)}` : ''}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; font-weight: bold; color: #334155; font-family: Arial, sans-serif; padding-bottom: 6px;">
            ${escapeHtml(card.company.name)}
          </td>
        </tr>
        ${phoneRow}
        ${emailRow}
        ${cardLinkRow}
      </table>
    </td>
    ${qrCell}
  </tr>
</table>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SignaturePage() {
  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [html, setHtml] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadCard()
  }, [])

  async function loadCard() {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadError('Not authenticated.')
      setLoading(false)
      return
    }

    const { data: raw, error } = await supabase
      .from('staff_cards')
      .select(`
        full_name, job_title, department,
        phone, email,
        show_phone, show_email,
        photo_url, nfc_card_id,
        nfc_cards ( slug ),
        companies ( name, brand_primary_color, website )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !raw) {
      setLoadError('Could not load your card.')
      setLoading(false)
      return
    }

    const row = raw as unknown as RawRow

    const nfcRaw = Array.isArray(row.nfc_cards) ? row.nfc_cards[0] : row.nfc_cards
    const nfcSlug = (nfcRaw as { slug: string } | null)?.slug ?? null

    const companyRaw = Array.isArray(row.companies) ? row.companies[0] : row.companies
    const company = companyRaw as CardData['company'] | null

    if (!company) {
      setLoadError('Company data unavailable.')
      setLoading(false)
      return
    }

    const cardData: CardData = {
      full_name: row.full_name,
      job_title: row.job_title,
      department: row.department ?? null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      show_phone: row.show_phone,
      show_email: row.show_email,
      photo_url: row.photo_url ?? null,
      nfc_slug: nfcSlug,
      company,
    }

    setCard(cardData)
    setHtml(buildSignatureHtml(cardData, appUrl))
    setLoading(false)
  }

  async function handleCopy() {
    if (!html) return
    await navigator.clipboard.writeText(html)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 3000)
  }

  // ---------------------------------------------------------------------------
  // Render: loading / error
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-teal-500 animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-slate-500">Loading signature data…</p>
        </div>
      </div>
    )
  }

  if (loadError || !card) {
    return (
      <div className="p-8">
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto">
          <span className="material-symbols-outlined text-[40px] text-slate-300 mb-3 block">
            mail
          </span>
          <p className="text-slate-700 font-medium mb-1">Could not load signature</p>
          <p className="text-sm text-slate-500">{loadError}</p>
          <Link
            href="/dashboard/my-card"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-teal-600 hover:text-teal-700"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to My Card
          </Link>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8 max-w-[820px]">

      {/* Back link + header */}
      <div className="mb-6">
        <Link
          href="/dashboard/my-card?tab=share"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to My Card
        </Link>
        <h1 className="font-jakarta text-2xl font-bold text-slate-900 leading-tight">
          Email Signature
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Copy the HTML snippet below and paste it into your Gmail or Outlook signature settings.
        </p>
      </div>

      {/* Preview */}
      <div className="glass-panel rounded-2xl p-6 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          Preview
        </h2>
        <div
          className="bg-white rounded-xl border border-slate-100 p-5 overflow-x-auto"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {!card.nfc_slug && (
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            QR code and card link will appear once an NFC card is assigned by your administrator.
          </p>
        )}
      </div>

      {/* HTML snippet */}
      <div className="glass-panel rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            HTML Code
          </h2>
          <button
            type="button"
            onClick={handleCopy}
            className={[
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
              copied
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'bg-teal-600 hover:bg-teal-700 text-white',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copied!' : 'Copy HTML'}
          </button>
        </div>
        <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all font-mono max-h-64 overflow-y-auto">
          {html}
        </pre>
      </div>

      {/* Instructions */}
      <div className="space-y-4">

        {/* Gmail */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-red-500">mail</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Gmail Instructions</h2>
          </div>
          <ol className="space-y-2.5">
            {[
              'Click "Copy HTML" above.',
              'Open Gmail and click the gear icon (⚙️) → "See all settings".',
              'Go to the "General" tab and scroll to "Signature".',
              'Click "+ Create new" and give it a name (e.g. "My Digital Card").',
              'Click the "</>" source code button in the signature editor toolbar.',
              'Delete any existing content, paste the HTML, then click "OK".',
              'Scroll to the bottom and click "Save Changes".',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Outlook */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-blue-500">mark_email_read</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Outlook Instructions</h2>
          </div>
          <ol className="space-y-2.5">
            {[
              'Click "Copy HTML" above.',
              'Open Outlook and go to File → Options → Mail → Signatures.',
              'Click "New" and give the signature a name.',
              'In the signature editor, click "Source" or open Notepad, paste the HTML, save it as a .htm file, then insert the file — OR use the Outlook Web App (easier).',
              'For Outlook Web: click the gear icon → "View all Outlook settings" → "Compose and reply".',
              'In the "Email signature" section, paste the HTML directly into the editor.',
              'Click "Save".',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-400 bg-blue-50 rounded-xl p-3">
            <strong>Tip:</strong> The Outlook Web App (outlook.com or your company&apos;s OWA) supports HTML signatures much more reliably than the desktop app. If possible, set your signature there.
          </p>
        </div>

      </div>
    </div>
  )
}
