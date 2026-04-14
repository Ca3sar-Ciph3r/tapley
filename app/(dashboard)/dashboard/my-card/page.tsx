'use client'

// app/(dashboard)/dashboard/my-card/page.tsx
//
// Rendering:  Client component — tabs, form state, photo upload.
// Auth:       Staff Member (staff_cards.user_id = auth.uid()).
//             Company Admins land on /dashboard instead — handled by middleware.
//
// Tabs:
//   1. My Card   — edit allowed fields (ROLES.md Staff Card Self-Edit Limits)
//   2. Analytics — personal view count (7/30/90 days), source breakdown, recent activity
//   3. Share     — QR code display + download, card URL copy, link to signature page
//
// Staff CAN edit:  photo, bio (max 200), whatsapp_number, social_links,
//                  cta_label/cta_url, show_phone, show_email, wa_notify_enabled
//
// Staff CANNOT edit: full_name, job_title, department, phone, email
//                    (shown as greyed-out read-only fields)
//
// Photo upload: client-side Canvas resize to max 800×800px, then Supabase Storage upload.
// After save: updateOwnStaffCard server action → revalidatePath('/c/[slug]').

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateOwnStaffCard, type UpdateOwnStaffCardInput } from '@/lib/actions/staff-self-edit'
import { LiveCardPreview } from '@/components/dashboard/live-card-preview'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'card' | 'analytics' | 'share'
type AnalyticsPeriod = 7 | 30 | 90

type SocialLinks = {
  linkedin: string
  instagram: string
  twitter: string
  facebook: string
  website: string
  calendly: string
}

type CardData = {
  id: string
  company_id: string
  full_name: string
  job_title: string
  department: string | null
  bio: string | null
  phone: string | null
  email: string | null
  whatsapp_number: string | null
  show_phone: boolean
  show_email: boolean
  wa_notify_enabled: boolean
  social_links: SocialLinks
  cta_label: string | null
  cta_url: string | null
  photo_url: string | null
  nfc_card_id: string | null
  nfc_slug: string | null
  company: {
    name: string
    logo_url: string | null
    brand_primary_color: string
    brand_secondary_color: string
    brand_dark_mode: boolean
    card_template: string
    cta_label: string
    cta_url: string | null
    website: string | null
    tagline: string | null
  }
}

type RawView = {
  viewed_at: string
  source: string | null
  city: string | null
}

type Analytics = {
  total: number
  by_source: Record<string, number>
  recent: RawView[]
}

// Form state for editable fields only
type EditForm = {
  bio: string
  whatsapp_number: string
  show_phone: boolean
  show_email: boolean
  wa_notify_enabled: boolean
  social_links: SocialLinks
  cta_label: string
  cta_url: string
  photo_url: string | null
  photo_file: File | null
  photo_preview: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_SOCIAL: SocialLinks = {
  linkedin: '',
  instagram: '',
  twitter: '',
  facebook: '',
  website: '',
  calendly: '',
}

const SOCIAL_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string; icon: string }[] = [
  { key: 'linkedin',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/in/yourname', icon: 'work' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle', icon: 'photo_camera' },
  { key: 'twitter',   label: 'Twitter / X', placeholder: 'https://x.com/yourhandle',      icon: 'alternate_email' },
  { key: 'facebook',  label: 'Facebook',  placeholder: 'https://facebook.com/yourname',   icon: 'groups' },
  { key: 'website',   label: 'Website',   placeholder: 'https://yourwebsite.com',         icon: 'language' },
  { key: 'calendly',  label: 'Calendly',  placeholder: 'https://calendly.com/yourname',   icon: 'calendar_today' },
]

const SOURCE_LABELS: Record<string, string> = {
  nfc: 'NFC Tap',
  qr: 'QR Scan',
  link: 'Direct Link',
  unknown: 'Other',
}

const SOURCE_COLOURS: Record<string, string> = {
  nfc:     'bg-teal-500',
  qr:      'bg-indigo-500',
  link:    'bg-amber-500',
  unknown: 'bg-slate-400',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Resize a File to max 800×800px via Canvas API. Returns a JPEG Blob.
async function resizePhoto(file: File): Promise<Blob> {
  const MAX = 800
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width: w, height: h } = img
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX }
        else { w = Math.round((w * MAX) / h); h = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = objectUrl
  })
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyCardPage() {
  const [tab, setTab] = useState<Tab>('card')
  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Edit form state
  const [form, setForm] = useState<EditForm | null>(null)
  const [bioCount, setBioCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [uploading, setUploading] = useState(false)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analytics state
  const [period, setPeriod] = useState<AnalyticsPeriod>(30)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Copy state for Share tab
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadCard()
  }, [])

  useEffect(() => {
    if (tab === 'analytics' && card && !analytics) {
      fetchAnalytics(period, card.id)
    }
  }, [tab, card]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 'analytics' && card) {
      fetchAnalytics(period, card.id)
    }
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCard() {
    setLoading(true)
    setLoadError(null)

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
        id, company_id,
        full_name, job_title, department, bio,
        phone, email, whatsapp_number,
        show_phone, show_email, wa_notify_enabled,
        social_links, cta_label, cta_url,
        photo_url, nfc_card_id,
        nfc_cards ( slug ),
        companies (
          name, logo_url,
          brand_primary_color, brand_secondary_color,
          brand_dark_mode, card_template,
          cta_label, cta_url, website, tagline
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !raw) {
      setLoadError('Could not load your card. Please contact your administrator.')
      setLoading(false)
      return
    }

    const nfcRaw = Array.isArray(raw.nfc_cards) ? raw.nfc_cards[0] : raw.nfc_cards
    const nfcSlug = (nfcRaw as { slug: string } | null)?.slug ?? null

    const companyRaw = Array.isArray(raw.companies) ? raw.companies[0] : raw.companies
    const company = companyRaw as CardData['company'] | null

    if (!company) {
      setLoadError('Company data unavailable.')
      setLoading(false)
      return
    }

    const social = (raw.social_links ?? {}) as Record<string, string>

    const cardData: CardData = {
      id: raw.id,
      company_id: raw.company_id,
      full_name: raw.full_name,
      job_title: raw.job_title,
      department: raw.department ?? null,
      bio: raw.bio ?? null,
      phone: raw.phone ?? null,
      email: raw.email ?? null,
      whatsapp_number: raw.whatsapp_number ?? null,
      show_phone: raw.show_phone,
      show_email: raw.show_email,
      wa_notify_enabled: raw.wa_notify_enabled,
      social_links: {
        linkedin:  social.linkedin  ?? '',
        instagram: social.instagram ?? '',
        twitter:   social.twitter   ?? '',
        facebook:  social.facebook  ?? '',
        website:   social.website   ?? '',
        calendly:  social.calendly  ?? '',
      },
      cta_label: raw.cta_label ?? null,
      cta_url: raw.cta_url ?? null,
      photo_url: raw.photo_url ?? null,
      nfc_card_id: raw.nfc_card_id ?? null,
      nfc_slug: nfcSlug,
      company,
    }

    setCard(cardData)
    setForm({
      bio: cardData.bio ?? '',
      whatsapp_number: cardData.whatsapp_number ?? '',
      show_phone: cardData.show_phone,
      show_email: cardData.show_email,
      wa_notify_enabled: cardData.wa_notify_enabled,
      social_links: { ...cardData.social_links },
      cta_label: cardData.cta_label ?? '',
      cta_url: cardData.cta_url ?? '',
      photo_url: cardData.photo_url,
      photo_file: null,
      photo_preview: null,
    })
    setBioCount(cardData.bio?.length ?? 0)
    setLoading(false)
  }

  async function fetchAnalytics(days: AnalyticsPeriod, staffCardId: string) {
    setAnalyticsLoading(true)
    const supabase = createClient()
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data: views } = await supabase
      .from('card_views')
      .select('viewed_at, source, city')
      .eq('staff_card_id', staffCardId)
      .gte('viewed_at', cutoff)
      .order('viewed_at', { ascending: false })

    const bySource: Record<string, number> = { nfc: 0, qr: 0, link: 0, unknown: 0 }
    for (const v of views ?? []) {
      const src = v.source ?? 'unknown'
      bySource[src in bySource ? src : 'unknown']++
    }

    setAnalytics({
      total: views?.length ?? 0,
      by_source: bySource,
      recent: (views ?? []).slice(0, 10),
    })
    setAnalyticsLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Form handlers
  // ---------------------------------------------------------------------------

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function setSocialField(key: keyof SocialLinks, value: string) {
    setForm(prev => prev ? {
      ...prev,
      social_links: { ...prev.social_links, [key]: value },
    } : prev)
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !card || !form) return

    // Validation
    if (!file.type.startsWith('image/')) {
      setSaveError('Please select an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Photo must be under 5MB.')
      return
    }

    setSaveError(null)
    setUploading(true)

    try {
      // 1. Client-side resize to max 800×800px
      const resized = await resizePhoto(file)

      // 2. Show preview immediately
      const previewUrl = URL.createObjectURL(resized)
      setForm(prev => prev ? { ...prev, photo_file: file, photo_preview: previewUrl } : prev)

      // 3. Upload to Supabase Storage
      const supabase = createClient()
      const path = `${card.company_id}/${card.id}/photo.jpg`

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(path, resized, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) {
        setSaveError(`Photo upload failed: ${uploadError.message}`)
        setUploading(false)
        return
      }

      // 4. Get public URL and update form
      const { data: urlData } = supabase.storage
        .from('staff-photos')
        .getPublicUrl(path)

      setForm(prev => prev ? {
        ...prev,
        photo_url: urlData.publicUrl,
        photo_file: null,
        // Keep preview until page reloads to avoid flicker
      } : prev)
    } catch (err) {
      setSaveError('Photo processing failed. Please try a different image.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!form || !card) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    const input: UpdateOwnStaffCardInput = {
      bio: form.bio,
      whatsapp_number: form.whatsapp_number,
      show_phone: form.show_phone,
      show_email: form.show_email,
      wa_notify_enabled: form.wa_notify_enabled,
      social_links: { ...form.social_links },
      cta_label: form.cta_label,
      cta_url: form.cta_url,
      photo_url: form.photo_url,
    }

    const result = await updateOwnStaffCard(input)

    if (result.error) {
      setSaveError(result.error)
    } else {
      setSaveSuccess(true)
      // Sync local card state with saved values
      setCard(prev => prev ? {
        ...prev,
        bio: form.bio.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        show_phone: form.show_phone,
        show_email: form.show_email,
        wa_notify_enabled: form.wa_notify_enabled,
        social_links: { ...form.social_links },
        cta_label: form.cta_label.trim() || null,
        cta_url: form.cta_url.trim() || null,
        photo_url: form.photo_url,
      } : prev)
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3500)
    }
    setSaving(false)
  }

  async function handleCopyUrl() {
    if (!card?.nfc_slug) return
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'}/c/${card.nfc_slug}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2500)
  }

  // ---------------------------------------------------------------------------
  // Render: loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-teal-500 animate-spin">
            progress_activity
          </span>
          <p className="text-sm text-slate-500">Loading your card…</p>
        </div>
      </div>
    )
  }

  if (loadError || !card || !form) {
    return (
      <div className="p-8">
        <div className="glass-panel rounded-2xl p-8 text-center max-w-md mx-auto">
          <span className="material-symbols-outlined text-[40px] text-slate-300 mb-3 block">
            id_card
          </span>
          <p className="text-slate-700 font-medium mb-1">Card not found</p>
          <p className="text-sm text-slate-500">
            {loadError ?? 'Your card could not be loaded. Please contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Preview values — derived from current form state + read-only card fields
  // ---------------------------------------------------------------------------

  const photoSrc = form.photo_preview ?? form.photo_url
  const previewCompany: Parameters<typeof LiveCardPreview>[0]['company'] = {
    name: card.company.name,
    logo_url: card.company.logo_url,
    brand_primary_color: card.company.brand_primary_color,
    brand_secondary_color: card.company.brand_secondary_color,
    brand_dark_mode: card.company.brand_dark_mode,
    cta_label: card.company.cta_label,
    cta_url: card.company.cta_url,
  }

  const cardUrl = card.nfc_slug
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'}/c/${card.nfc_slug}`
    : null

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-8 max-w-[1200px]">

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900 leading-tight">
            My Card
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {card.full_name} · {card.job_title}
            {card.department ? ` · ${card.department}` : ''}
          </p>
        </div>
        {cardUrl && (
          <a
            href={cardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">
              open_in_new
            </span>
            Preview my card
          </a>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {([ ['card', 'id_card', 'My Card'], ['analytics', 'monitoring', 'Analytics'], ['share', 'share', 'Share'] ] as const).map(([t, icon, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              tab === t
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB: My Card                                                         */}
      {/* ------------------------------------------------------------------ */}

      {tab === 'card' && (
        <div className="flex gap-8">

          {/* Left: form */}
          <div className="flex-1 space-y-5 min-w-0">

            {/* Read-only admin fields */}
            <div className="glass-panel rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[18px] text-slate-400">lock</span>
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Admin-managed fields
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                These fields are managed by your administrator. Contact them to make changes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: card.full_name },
                  { label: 'Job Title', value: card.job_title },
                  { label: 'Department', value: card.department ?? '—' },
                  { label: 'Work Email', value: card.email ?? '—' },
                  { label: 'Work Phone', value: card.phone ?? '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                      {label}
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-default select-none">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile photo */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Profile Photo
              </h2>
              <div className="flex items-center gap-5">
                {/* Avatar preview */}
                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 flex items-center justify-center flex-shrink-0">
                  {(form.photo_preview ?? form.photo_url) ? (
                    <img
                      src={form.photo_preview ?? form.photo_url!}
                      alt={card.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-slate-300">
                      {card.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Uploading…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">upload</span>
                        {form.photo_url ? 'Change Photo' : 'Upload Photo'}
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-400 mt-2">
                    JPG or PNG, max 5MB. Resized to 800×800px automatically.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Bio
              </h2>
              <div>
                <textarea
                  value={form.bio}
                  onChange={e => {
                    setField('bio', e.target.value)
                    setBioCount(e.target.value.length)
                  }}
                  maxLength={200}
                  rows={3}
                  placeholder="A short description about yourself…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
                />
                <p className={`text-xs mt-1 text-right ${bioCount > 180 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {bioCount}/200 characters
                </p>
              </div>
            </div>

            {/* WhatsApp number */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                WhatsApp Number
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                This can be your personal number — it&apos;s used for the WhatsApp CTA button on your card.
                Format: 082 123 4567 or +27821234567
              </p>
              <input
                type="tel"
                value={form.whatsapp_number}
                onChange={e => setField('whatsapp_number', e.target.value)}
                placeholder="+27821234567"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              />
            </div>

            {/* Social links */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Social Links
              </h2>
              <div className="space-y-3">
                {SOCIAL_FIELDS.map(({ key, label, placeholder, icon }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-slate-500">
                        {icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="url"
                        value={form.social_links[key]}
                        onChange={e => setSocialField(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        aria-label={label}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visibility toggles */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                Visibility &amp; Notifications
              </h2>
              <div className="space-y-4">
                {[
                  {
                    key: 'show_phone' as const,
                    label: 'Show phone number on card',
                    description: 'Display your work phone number publicly',
                  },
                  {
                    key: 'show_email' as const,
                    label: 'Show email address on card',
                    description: 'Display your work email address publicly',
                  },
                  {
                    key: 'wa_notify_enabled' as const,
                    label: 'WhatsApp view notifications',
                    description: 'Receive a WhatsApp message when someone views your card',
                  },
                ].map(({ key, label, description }) => (
                  <label key={key} className="flex items-start gap-4 cursor-pointer group">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={form[key] as boolean}
                        onChange={e => setField(key, e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={[
                          'w-10 h-6 rounded-full transition-colors duration-200',
                          (form[key] as boolean) ? 'bg-teal-500' : 'bg-slate-200',
                        ].join(' ')}
                      />
                      <div
                        className={[
                          'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200',
                          (form[key] as boolean) ? 'left-5' : 'left-1',
                        ].join(' ')}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                      <p className="text-xs text-slate-400">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom CTA (optional — admin-managed at company level, staff can override) */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Custom CTA Button
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Optionally override the company&apos;s default call-to-action button on your card.
                Leave blank to use the company default.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Button Label</label>
                  <input
                    type="text"
                    value={form.cta_label}
                    onChange={e => setField('cta_label', e.target.value)}
                    placeholder={card.company.cta_label || 'Send me a WhatsApp'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Button URL</label>
                  <input
                    type="url"
                    value={form.cta_url}
                    onChange={e => setField('cta_url', e.target.value)}
                    placeholder="https://…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Save / error feedback */}
            {saveError && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-teal-50 border border-teal-100 text-sm text-teal-700">
                <span className="material-symbols-outlined text-[18px] flex-shrink-0">check_circle</span>
                Card updated successfully. Your public page will reflect the changes shortly.
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Save Changes
                </>
              )}
            </button>

          </div>

          {/* Right: live preview (desktop) */}
          <div className="hidden xl:block w-[320px] flex-shrink-0">
            <LiveCardPreview
              fullName={card.full_name}
              jobTitle={card.job_title}
              department={card.department ?? ''}
              bio={form.bio}
              phone={card.phone ?? ''}
              email={card.email ?? ''}
              whatsappNumber={form.whatsapp_number}
              showPhone={form.show_phone}
              showEmail={form.show_email}
              socialLinks={form.social_links}
              ctaLabel={form.cta_label}
              ctaUrl={form.cta_url}
              photoSrc={photoSrc}
              company={previewCompany}
            />
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: Analytics                                                       */}
      {/* ------------------------------------------------------------------ */}

      {tab === 'analytics' && (
        <div className="max-w-2xl space-y-5">

          {/* Period toggle */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {([7, 30, 90] as AnalyticsPeriod[]).map(d => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={[
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  period === d
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {d} days
              </button>
            ))}
          </div>

          {analyticsLoading ? (
            <div className="flex items-center gap-3 py-12 justify-center">
              <span className="material-symbols-outlined text-[24px] text-teal-500 animate-spin">
                progress_activity
              </span>
              <span className="text-sm text-slate-500">Loading analytics…</span>
            </div>
          ) : analytics ? (
            <>
              {/* Stat card */}
              <div className="glass-panel rounded-2xl p-6 flex items-center gap-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${card.company.brand_primary_color}18` }}
                >
                  <span
                    className="material-symbols-outlined text-[28px]"
                    style={{ color: card.company.brand_primary_color }}
                  >
                    visibility
                  </span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-slate-900 font-jakarta">{analytics.total}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    card views in the last {period} days
                  </p>
                </div>
              </div>

              {/* Source breakdown */}
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                  Views by Source
                </h2>
                {analytics.total === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No views in this period.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(analytics.by_source)
                      .filter(([, count]) => count > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([source, count]) => {
                        const pct = analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0
                        return (
                          <div key={source}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700">
                                {SOURCE_LABELS[source] ?? source}
                              </span>
                              <span className="text-sm font-semibold text-slate-900">
                                {count} <span className="text-slate-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${SOURCE_COLOURS[source] ?? 'bg-slate-400'} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Recent activity */}
              <div className="glass-panel rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                  Recent Activity
                </h2>
                {analytics.recent.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No recent activity.</p>
                ) : (
                  <div className="space-y-2">
                    {analytics.recent.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold ${SOURCE_COLOURS[v.source ?? 'unknown'] ?? 'bg-slate-400'}`}
                          >
                            {(v.source ?? 'other').slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-sm text-slate-700">
                            {SOURCE_LABELS[v.source ?? 'unknown'] ?? v.source}
                            {v.city ? ` · ${v.city}` : ''}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">{formatTimeAgo(v.viewed_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB: Share                                                           */}
      {/* ------------------------------------------------------------------ */}

      {tab === 'share' && (
        <div className="max-w-2xl space-y-5">

          {/* QR Code */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              QR Code
            </h2>
            {card.nfc_slug ? (
              <div className="flex items-start gap-6">
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-white p-3 flex-shrink-0">
                  <img
                    src={`/api/qr/${card.nfc_slug}`}
                    alt={`QR code for ${card.full_name}`}
                    width={140}
                    height={140}
                    className="block"
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-slate-600">
                    Share this QR code and anyone who scans it will land on your digital card.
                    Works even without an NFC phone.
                  </p>
                  <a
                    href={`/api/qr/${card.nfc_slug}`}
                    download={`${card.full_name.replace(/\s+/g, '-').toLowerCase()}-qr.png`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download QR Code
                  </a>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400">
                <span className="material-symbols-outlined text-[32px] text-slate-200 block mb-2">
                  qr_code
                </span>
                QR code will be available once an NFC card is assigned by your administrator.
              </div>
            )}
          </div>

          {/* Card URL */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              Card Link
            </h2>
            {cardUrl ? (
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-mono truncate">
                  {cardUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className={[
                    'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex-shrink-0',
                    copied
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-2">
                Card URL will be available once an NFC card is assigned.
              </p>
            )}
          </div>

          {/* Email signature */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email Signature
                </h2>
                <p className="text-sm text-slate-500">
                  Generate an HTML snippet to paste into Gmail or Outlook.
                  Includes your name, title, QR code, and card link.
                </p>
              </div>
              <Link
                href="/dashboard/my-card/signature"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors flex-shrink-0 ml-4"
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                Generate
              </Link>
            </div>
          </div>

        </div>
      )}

    </div>
  )
}
