'use client'

// app/(dashboard)/dashboard/cards/[id]/page.tsx
//
// Rendering:  Client component — form state, live preview, analytics query.
// Auth:       Company Admin only. RLS on staff_cards scopes to user's company.
// Supabase:   Browser client for reads; server action for writes.
//
// After save: server action calls revalidatePath('/c/[slug]') to bust ISR.
//
// Sections:
//   1. Profile      — photo, name, title, dept, bio
//   2. Contact      — phone, email, whatsapp, show/hide toggles
//   3. Social Links — LinkedIn, Instagram, Twitter, Facebook, Website, Calendly
//   4. CTA Override — label and URL (overrides company default)
//   5. Settings     — wa_notify_enabled, show_optin_form
//   6. NFC Card     — current assignment, Reassign button
//   7. Analytics    — view count last 30d, source breakdown
//   8. Danger Zone  — Deactivate card
//
// Desktop layout: left form + right sticky live preview.

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  updateStaffCard,
  deactivateStaffCard,
  type UpdateStaffCardInput,
} from '@/lib/actions/cards'
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'
import { LiveCardPreview } from '@/components/dashboard/live-card-preview'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SocialLinksForm = {
  linkedin: string
  instagram: string
  twitter: string
  facebook: string
  website: string
  calendly: string
}

type FormValues = {
  full_name: string
  job_title: string
  department: string
  bio: string
  phone: string
  email: string
  whatsapp_number: string
  show_phone: boolean
  show_email: boolean
  social_links: SocialLinksForm
  // cta_label / cta_url intentionally excluded: set at company level via /dashboard/branding
  wa_notify_enabled: boolean
  show_optin_form: boolean
  photo_url: string | null
  photo_file: File | null
  photo_preview: string | null
}

type FormErrors = Partial<Record<
  'full_name' | 'job_title' | 'bio' | 'email' | 'phone' | 'whatsapp_number' | 'photo',
  string
>>

type CardMeta = {
  id: string
  company_id: string
  is_active: boolean
  nfc_card_id: string | null
  nfc_slug: string | null
  nfc_order_status: string | null
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

type Analytics = {
  total: number
  by_source: Record<'nfc' | 'qr' | 'link' | 'unknown', number>
}

const EMPTY_SOCIAL: SocialLinksForm = {
  linkedin: '',
  instagram: '',
  twitter: '',
  facebook: '',
  website: '',
  calendly: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateForm(v: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!v.full_name.trim()) errors.full_name = 'Full name is required.'
  else if (v.full_name.trim().length < 2) errors.full_name = 'Full name must be at least 2 characters.'
  if (!v.job_title.trim()) errors.job_title = 'Job title is required.'
  if (v.email.trim() && !isValidEmail(v.email.trim())) errors.email = 'Enter a valid email address.'
  if (v.bio.trim().length > 200) errors.bio = 'Bio must be 200 characters or fewer.'
  return errors
}

// Resize a File to max 800×800px using the Canvas API, returning a JPEG Blob.
// Per JOURNEYS.md Journey 4.
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
        blob => { blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')) },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = objectUrl
  })
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [meta, setMeta] = useState<CardMeta | null>(null)
  const [values, setValues] = useState<FormValues | null>(null)
  const [departments, setDepartments] = useState<string[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [deactivating, setDeactivating] = useState(false)
  // Track whether the photo was explicitly changed so we only write photo_url
  // to the DB when the user actually uploaded a new photo or removed the existing
  // one. Without this guard, saving other fields would unconditionally overwrite
  // any photo_url already stored in the database.
  const [photoChanged, setPhotoChanged] = useState(false)

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load card + analytics on mount
  useEffect(() => {
    loadCard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadCard() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()

    // Load card with NFC + company join
    const { data: card, error: cardError } = await supabase
      .from('staff_cards')
      .select(`
        id, company_id, is_active, nfc_card_id,
        full_name, job_title, department, bio,
        phone, email, whatsapp_number,
        show_phone, show_email, social_links,
        cta_label, cta_url,
        wa_notify_enabled, show_optin_form, photo_url,
        nfc_cards ( id, slug, order_status ),
        companies (
          name, logo_url,
          brand_primary_color, brand_secondary_color, brand_dark_mode, card_template,
          cta_label, cta_url, website, tagline
        )
      `)
      .eq('id', id)
      .single()

    if (cardError || !card) {
      setLoadError('Staff card not found or you do not have access.')
      setLoading(false)
      return
    }

    // Normalise nfc_cards (Supabase may return array or object for joins)
    const nfcRaw = Array.isArray(card.nfc_cards) ? card.nfc_cards[0] : card.nfc_cards
    const nfcCard = nfcRaw as { id: string; slug: string; order_status: string } | null
    const companyRaw = Array.isArray(card.companies) ? card.companies[0] : card.companies
    const company = companyRaw as CardMeta['company'] | null

    if (!company) {
      setLoadError('Company data unavailable.')
      setLoading(false)
      return
    }

    setMeta({
      id: card.id,
      company_id: card.company_id,
      is_active: card.is_active,
      nfc_card_id: card.nfc_card_id,
      nfc_slug: nfcCard?.slug ?? null,
      nfc_order_status: nfcCard?.order_status ?? null,
      company,
    })

    // Populate form values from loaded card
    const social = (card.social_links ?? {}) as Record<string, string>
    setValues({
      full_name: card.full_name,
      job_title: card.job_title,
      department: card.department ?? '',
      bio: card.bio ?? '',
      phone: card.phone ?? '',
      email: card.email ?? '',
      whatsapp_number: card.whatsapp_number ?? '',
      show_phone: card.show_phone,
      show_email: card.show_email,
      social_links: {
        linkedin:  social.linkedin  ?? '',
        instagram: social.instagram ?? '',
        twitter:   social.twitter   ?? '',
        facebook:  social.facebook  ?? '',
        website:   social.website   ?? '',
        calendly:  social.calendly  ?? '',
      },
      wa_notify_enabled: card.wa_notify_enabled,
      show_optin_form: card.show_optin_form,
      photo_url: card.photo_url,
      photo_file: null,
      photo_preview: null,
    })

    // Fetch 30-day analytics in parallel
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: views } = await supabase
      .from('card_views')
      .select('source')
      .eq('staff_card_id', id)
      .gte('viewed_at', thirtyDaysAgo)

    const bySource: Analytics['by_source'] = { nfc: 0, qr: 0, link: 0, unknown: 0 }
    for (const v of views ?? []) {
      const src = (v.source as string) || 'unknown'
      if (src === 'nfc' || src === 'qr' || src === 'link') bySource[src]++
      else bySource.unknown++
    }
    setAnalytics({ total: views?.length ?? 0, by_source: bySource })

    // Load departments for datalist
    const { data: deptData } = await supabase
      .from('staff_cards')
      .select('department')
      .eq('is_active', true)
      .not('department', 'is', null)
    if (deptData) {
      const unique = [...new Set(deptData.map(r => r.department as string))].sort()
      setDepartments(unique)
    }

    setLoading(false)
  }

  // ---------------------------------------------------------------------------
  // Form field setters — immutable updates
  // ---------------------------------------------------------------------------

  function set<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues(prev => prev ? { ...prev, [field]: value } : prev)
    if (field in errors) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
    setSaveSuccess(false)
  }

  function setSocial(key: keyof SocialLinksForm, value: string) {
    setValues(prev =>
      prev ? { ...prev, social_links: { ...prev.social_links, [key]: value } } : prev
    )
    setSaveSuccess(false)
  }

  function handlePhoneBlur(field: 'phone' | 'whatsapp_number') {
    if (!values) return
    const raw = values[field].trim()
    if (!raw) return
    try {
      set(field, normalisePhoneNumber(raw))
    } catch {
      // Leave as-is; server action will also normalise
    }
  }

  // Photo: preview locally, upload to Storage on Save
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, photo: 'Photo must be JPEG, PNG, or WebP.' }))
      return
    }
    // Validate size (max 5MB per DATABASE.md)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'Photo must be under 5 MB.' }))
      return
    }

    const preview = URL.createObjectURL(file)
    setValues(prev =>
      prev ? { ...prev, photo_file: file, photo_preview: preview } : prev
    )
    setPhotoChanged(true)
    setErrors(prev => ({ ...prev, photo: undefined }))
    setSaveSuccess(false)
  }

  function handleRemovePhoto() {
    if (values?.photo_preview) URL.revokeObjectURL(values.photo_preview)
    setValues(prev =>
      prev ? { ...prev, photo_file: null, photo_preview: null, photo_url: null } : prev
    )
    setPhotoChanged(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setSaveSuccess(false)
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (!values || !meta) return

    setSaveError(null)
    setSaveSuccess(false)

    const validation = validateForm(values)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSaving(true)

    let finalPhotoUrl = values.photo_url

    // Upload new photo if selected.
    // The filename includes a timestamp so each upload gets a unique URL.
    // This is required to bust the Next.js Image optimisation cache and CDN:
    // if we uploaded to the same path (photo.jpg) the URL would be identical
    // and both caches would keep serving the old image even after revalidatePath.
    if (values.photo_file) {
      try {
        const blob = await resizePhoto(values.photo_file)
        const supabase = createClient()
        const storagePath = `${meta.company_id}/${meta.id}/photo_${Date.now()}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('staff-photos')
          .upload(storagePath, blob, { upsert: false, contentType: 'image/jpeg' })

        if (uploadError) {
          setSaveError(`Photo upload failed: ${uploadError.message}`)
          setSaving(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('staff-photos')
          .getPublicUrl(storagePath)
        finalPhotoUrl = urlData.publicUrl
      } catch (err) {
        setSaveError('Photo upload failed. Please try again.')
        setSaving(false)
        return
      }
    }

    // Only include photo_url when the admin explicitly uploaded a new photo or
    // removed the existing one. Omitting it causes the server action to leave
    // the stored value untouched, preventing a plain field-edit save from
    // accidentally overwriting a photo that was already in the database.
    const input: UpdateStaffCardInput = {
      full_name: values.full_name,
      job_title: values.job_title,
      department: values.department,
      bio: values.bio,
      phone: values.phone,
      email: values.email,
      whatsapp_number: values.whatsapp_number,
      show_phone: values.show_phone,
      show_email: values.show_email,
      social_links: values.social_links,
      // cta_label / cta_url deliberately omitted — set at company level, preserved in DB
      wa_notify_enabled: values.wa_notify_enabled,
      show_optin_form: values.show_optin_form,
      ...(photoChanged ? { photo_url: finalPhotoUrl } : {}),
    }

    const result = await updateStaffCard(meta.id, input)

    if (result.error) {
      setSaveError(result.error)
      setSaving(false)
      return
    }

    // Revoke old preview URL if we uploaded a new photo
    if (values.photo_preview) URL.revokeObjectURL(values.photo_preview)

    setValues(prev =>
      prev
        ? { ...prev, photo_url: finalPhotoUrl, photo_file: null, photo_preview: null }
        : prev
    )
    setPhotoChanged(false)
    setSaving(false)
    setSaveSuccess(true)

    // Auto-clear the success banner after 3s
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000)
  }

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  async function handleDeactivate() {
    if (!meta) return
    if (
      !confirm(
        'Deactivate this staff card?\n\nThe public card page will immediately stop showing this person. This cannot be undone from the dashboard (contact support to reactivate).'
      )
    )
      return

    setDeactivating(true)
    const result = await deactivateStaffCard(meta.id)
    if (result.error) {
      alert(`Could not deactivate: ${result.error}`)
      setDeactivating(false)
    } else {
      router.push('/dashboard/cards')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
        <span className="text-sm">Loading card…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16 text-center">
        <span className="material-symbols-outlined text-[48px] text-red-400">error</span>
        <p className="text-slate-700 font-semibold mt-3">{loadError}</p>
        <Link href="/dashboard/cards" className="text-sm text-teal-600 hover:text-teal-700 mt-4 inline-block">
          ← Back to Team Cards
        </Link>
      </div>
    )
  }

  if (!meta || !values) return null

  const photoDisplay = values.photo_preview ?? values.photo_url
  const bioCharsLeft = 200 - values.bio.length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/cards"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Back to Team Cards"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
          </Link>
          <div className="min-w-0">
            <h1 className="font-jakarta text-2xl font-bold text-slate-900 truncate">
              {values.full_name || 'Edit Staff Card'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{values.job_title}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-teal-600 font-semibold">
              <span className="material-symbols-outlined text-[18px] leading-none">check_circle</span>
              Saved
            </span>
          )}
          {meta.nfc_slug && (
            <a
              href={`/c/${meta.nfc_slug}?src=link`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">open_in_new</span>
              View Card
            </a>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none animate-spin">progress_activity</span>
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none">save</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-start gap-2 p-3 mb-5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0">error</span>
          {saveError}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex gap-8 items-start">
        {/* ── LEFT: Form sections ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Section 1: Profile ── */}
          <SectionPanel title="Profile" icon="person">
            {/* Photo upload */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Profile Photo</p>
              <div className="flex items-start gap-4">
                {/* Photo preview */}
                <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 ring-2 ring-slate-200 flex-shrink-0 flex items-center justify-center">
                  {photoDisplay ? (
                    <img
                      src={photoDisplay}
                      alt={values.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[32px] text-slate-300">person</span>
                  )}
                </div>
                {/* Upload controls */}
                <div className="flex flex-col gap-2 justify-center h-20">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">upload</span>
                    {photoDisplay ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {photoDisplay && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
              </div>
              {errors.photo && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] leading-none">error</span>
                  {errors.photo}
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-400">JPEG, PNG or WebP — max 5 MB. Resized to 800×800 on save.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Full Name" required error={errors.full_name}>
                <input
                  type="text"
                  value={values.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  placeholder="e.g. Sifiso Radebe"
                  className={inputClass(!!errors.full_name)}
                />
              </Field>
              <Field label="Job Title" required error={errors.job_title}>
                <input
                  type="text"
                  value={values.job_title}
                  onChange={e => set('job_title', e.target.value)}
                  placeholder="e.g. Safety Officer"
                  className={inputClass(!!errors.job_title)}
                />
              </Field>
            </div>

            <Field
              label="Department"
              hint="Select an existing department or type a new one"
            >
              <input
                type="text"
                list="dept-list"
                value={values.department}
                onChange={e => set('department', e.target.value)}
                placeholder="e.g. Operations"
                className={inputClass(false)}
              />
              <datalist id="dept-list">
                {departments.map(d => <option key={d} value={d} />)}
              </datalist>
            </Field>

            <Field
              label="Bio"
              hint={`${bioCharsLeft} characters remaining`}
              error={errors.bio}
            >
              <textarea
                value={values.bio}
                onChange={e => set('bio', e.target.value)}
                rows={3}
                placeholder="A short professional bio (optional)"
                maxLength={200}
                className={[
                  inputClass(!!errors.bio),
                  'resize-none',
                ].join(' ')}
              />
            </Field>
          </SectionPanel>

          {/* ── Section 2: Contact ── */}
          <SectionPanel title="Contact Details" icon="phone">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Work Phone" hint="SA format: 0821234567" error={errors.phone}>
                <input
                  type="tel"
                  value={values.phone}
                  onChange={e => set('phone', e.target.value)}
                  onBlur={() => handlePhoneBlur('phone')}
                  placeholder="0821234567"
                  className={inputClass(!!errors.phone)}
                />
              </Field>
              <Field label="Work Email" error={errors.email}>
                <input
                  type="email"
                  value={values.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="sifiso@company.co.za"
                  className={inputClass(!!errors.email)}
                />
              </Field>
            </div>

            <Field
              label="WhatsApp Number"
              hint="Leave blank to use Work Phone for WhatsApp"
              error={errors.whatsapp_number}
            >
              <input
                type="tel"
                value={values.whatsapp_number}
                onChange={e => set('whatsapp_number', e.target.value)}
                onBlur={() => handlePhoneBlur('whatsapp_number')}
                placeholder="0821234567 (defaults to work phone)"
                className={inputClass(!!errors.whatsapp_number)}
              />
            </Field>

            <div className="flex flex-col sm:flex-row gap-3">
              <Toggle
                label="Show phone on card"
                description="Visitors can tap to call"
                checked={values.show_phone}
                onChange={v => set('show_phone', v)}
              />
              <Toggle
                label="Show email on card"
                description="Visitors can tap to email"
                checked={values.show_email}
                onChange={v => set('show_email', v)}
              />
            </div>
          </SectionPanel>

          {/* ── Section 3: Social Links ── */}
          <SectionPanel title="Social Links" icon="link">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {(
                [
                  { key: 'linkedin',  label: 'LinkedIn URL',  placeholder: 'https://linkedin.com/in/…' },
                  { key: 'instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/…' },
                  { key: 'twitter',   label: 'Twitter / X URL', placeholder: 'https://x.com/…' },
                  { key: 'facebook',  label: 'Facebook URL',  placeholder: 'https://facebook.com/…' },
                  { key: 'website',   label: 'Personal Website', placeholder: 'https://…' },
                  { key: 'calendly',  label: 'Calendly URL',  placeholder: 'https://calendly.com/…' },
                ] as { key: keyof SocialLinksForm; label: string; placeholder: string }[]
              ).map(({ key, label, placeholder }) => (
                <Field key={key} label={label}>
                  <input
                    type="url"
                    value={values.social_links[key]}
                    onChange={e => setSocial(key, e.target.value)}
                    placeholder={placeholder}
                    className={inputClass(false)}
                  />
                </Field>
              ))}
            </div>
          </SectionPanel>

          {/* CTA Button: set at company level via /dashboard/branding — not per-card */}

          {/* ── Section 5: Settings ── */}
          <SectionPanel title="Settings" icon="settings">
            <Toggle
              label="WhatsApp notification on card view"
              description="Staff member receives a WhatsApp message each time someone views their card"
              checked={values.wa_notify_enabled}
              onChange={v => set('wa_notify_enabled', v)}
            />
            <Toggle
              label="Show opt-in contact form"
              description="Displays a contact form on the card page (post-MVP feature — enable when ready)"
              checked={values.show_optin_form}
              onChange={v => set('show_optin_form', v)}
            />
          </SectionPanel>

          {/* ── Section 6: NFC Card ── */}
          <SectionPanel title="NFC Card" icon="nfc">
            {meta.nfc_card_id && meta.nfc_slug ? (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Assigned card</p>
                  <a
                    href={`/c/${meta.nfc_slug}?src=link`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">nfc</span>
                    {meta.nfc_slug}
                  </a>
                </div>
                <Link
                  href={`/dashboard/cards/${meta.id}/assign`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">swap_horiz</span>
                  Reassign NFC Card
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-[18px] leading-none">nfc</span>
                  <span className="text-sm">No NFC card assigned — card is unlinked from any physical card.</span>
                </div>
                <Link
                  href={`/dashboard/cards/${meta.id}/assign`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">add_link</span>
                  Assign NFC Card
                </Link>
              </div>
            )}
          </SectionPanel>

          {/* ── Section 7: Analytics ── */}
          <SectionPanel title="Analytics — last 30 days" icon="monitoring">
            {analytics ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900 font-jakarta tabular-nums">
                    {analytics.total}
                  </span>
                  <span className="text-sm text-slate-500">card view{analytics.total !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { key: 'nfc',     label: 'NFC tap',  icon: 'nfc' },
                      { key: 'qr',      label: 'QR scan',  icon: 'qr_code_scanner' },
                      { key: 'link',    label: 'Link',     icon: 'link' },
                      { key: 'unknown', label: 'Unknown',  icon: 'help_outline' },
                    ] as { key: keyof Analytics['by_source']; label: string; icon: string }[]
                  ).map(({ key, label, icon }) => (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <span className="material-symbols-outlined text-[18px] text-slate-400 mb-1">{icon}</span>
                      <span className="text-lg font-bold text-slate-800 tabular-nums">
                        {analytics.by_source[key]}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No view data yet.</p>
            )}
          </SectionPanel>

          {/* ── Section 8: Danger Zone ── */}
          <div className="glass-panel rounded-2xl border border-red-100 p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-50 flex-shrink-0">
                <span className="material-symbols-outlined text-[20px] leading-none text-red-500">warning</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">Danger Zone</p>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Deactivating removes this person from their physical card immediately. The NFC card returns to inventory.
                </p>
                {meta.is_active ? (
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivating}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold border border-red-200 transition-colors disabled:opacity-50"
                  >
                    <span
                      className={[
                        'material-symbols-outlined text-[16px] leading-none',
                        deactivating ? 'animate-spin' : '',
                      ].join(' ')}
                    >
                      {deactivating ? 'progress_activity' : 'person_off'}
                    </span>
                    {deactivating ? 'Deactivating…' : 'Deactivate Card'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <span className="material-symbols-outlined text-[14px] leading-none">block</span>
                    Card is already deactivated
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT: Live preview (desktop only) ── */}
        <div className="hidden lg:block w-[320px] flex-shrink-0">
          <LiveCardPreview
            fullName={values.full_name}
            jobTitle={values.job_title}
            department={values.department}
            bio={values.bio}
            phone={values.phone}
            email={values.email}
            whatsappNumber={values.whatsapp_number}
            showPhone={values.show_phone}
            showEmail={values.show_email}
            socialLinks={values.social_links}
            ctaLabel=""
            ctaUrl=""
            photoSrc={photoDisplay}
            company={meta.company}
            cardTemplate={meta.company.card_template}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean): string {
  return [
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white/70 placeholder-slate-400 transition-shadow',
    'focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400',
    hasError
      ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400'
      : 'border-slate-200',
  ].join(' ')
}

interface SectionPanelProps {
  title: string
  icon: string
  children: React.ReactNode
}

function SectionPanel({ title, icon, children }: SectionPanelProps) {
  return (
    <div className="glass-panel rounded-2xl border border-slate-200/50 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] leading-none text-slate-400">{icon}</span>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}

function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] leading-none">error</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-1 min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/40',
          checked ? 'bg-teal-600' : 'bg-slate-200',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
