'use client'

// app/(dashboard)/dashboard/branding/page.tsx
//
// Rendering:  Client component — colour pickers, logo upload, live preview.
// Auth:       Company Admin only (middleware + RLS enforce this).
// Supabase:   Browser client for reads; server action for writes.
//
// On save: updateCompanyBranding server action updates the companies table
//          and revalidates ALL non-deactivated NFC card pages for the company.
//
// Logo upload: client-side resize → Supabase Storage (company-logos bucket)
//              → URL stored in state → submitted with the rest of the form.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LiveCardPreview } from '@/components/dashboard/live-card-preview'
import {
  updateCompanyBranding,
  type CardTemplate,
  type UpdateCompanyBrandingInput,
} from '@/lib/actions/branding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompanyData = {
  id: string
  name: string
  tagline: string
  website: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  card_template: CardTemplate
  cta_label: string
  cta_url: string
}

type FormValues = CompanyData & {
  logo_file: File | null
  logo_preview: string | null   // local object URL while uploading
}

type FormErrors = Partial<Record<
  'name' | 'brand_primary_color' | 'brand_secondary_color' | 'logo',
  string
>>

// ---------------------------------------------------------------------------
// Card template options
// ---------------------------------------------------------------------------

const TEMPLATES: { value: CardTemplate; label: string; description: string }[] = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Clean white card — focus on content',
  },
  {
    value: 'bold',
    label: 'Bold',
    description: 'Full-bleed brand colour header',
  },
  {
    value: 'split',
    label: 'Split',
    description: 'Vertical split — photo left, details right',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

function isValidHex(v: string): boolean {
  return HEX_PATTERN.test(v)
}

function validateForm(v: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!v.name.trim()) errors.name = 'Company name is required.'
  if (!isValidHex(v.brand_primary_color))
    errors.brand_primary_color = 'Enter a valid hex colour (e.g. #16181D).'
  if (!isValidHex(v.brand_secondary_color))
    errors.brand_secondary_color = 'Enter a valid hex colour (e.g. #F59608).'
  return errors
}

// Normalise a hex input: ensure it starts with #, uppercase letters kept, trim whitespace.
function normaliseHex(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('#')) return `#${trimmed}`
  return trimmed
}

// Resize an image file to max 400×400px for logos, returning a JPEG Blob.
async function resizeLogo(file: File): Promise<Blob> {
  const MAX = 400
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
        'image/png',
        0.9
      )
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = objectUrl
  })
}

// ---------------------------------------------------------------------------
// Colour input sub-component
// ---------------------------------------------------------------------------

function ColourField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (hex: string) => void
  error?: string
}) {
  // Keep a local raw string for the text input so the user can type freely
  const [raw, setRaw] = useState(value)

  useEffect(() => { setRaw(value) }, [value])

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setRaw(v)
    // Propagate up only when it looks like a valid or near-valid hex
    const normalised = normaliseHex(v)
    if (isValidHex(normalised)) {
      onChange(normalised)
    }
  }

  function handleTextBlur() {
    const normalised = normaliseHex(raw)
    if (isValidHex(normalised)) {
      setRaw(normalised)
      onChange(normalised)
    }
  }

  function handlePickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setRaw(v)
    onChange(v)
  }

  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-3">
        {/* Colour swatch / native picker */}
        <label className="relative cursor-pointer flex-shrink-0">
          <div
            className="w-11 h-11 rounded-xl shadow border-2 border-white"
            style={{ backgroundColor: isValidHex(value) ? value : '#cccccc' }}
          />
          <input
            type="color"
            value={isValidHex(value) ? value : '#cccccc'}
            onChange={handlePickerChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label={`Pick ${label}`}
          />
        </label>
        {/* Hex text input */}
        <div className="flex-1">
          <input
            type="text"
            value={raw}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            maxLength={7}
            placeholder="#000000"
            className={[
              'w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm font-mono',
              'focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow',
              error
                ? 'border-red-300 bg-red-50'
                : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrandingPage() {
  const [values, setValues] = useState<FormValues | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [dragOver, setDragOver] = useState(false)

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // -------------------------------------------------------------------------
  // Load company data on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    loadCompany()
  }, [])

  async function loadCompany() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadError('Not authenticated.'); setLoading(false); return }

    // company_admins infers `never` for .data under this Supabase/PostgREST
    // version combination when destructured directly. Assign to result first,
    // then cast — this is the standard Supabase workaround for v14.4 types.
    type CompanyRow = {
      id: string
      name: string
      tagline: string | null
      website: string | null
      logo_url: string | null
      brand_primary_color: string
      brand_secondary_color: string
      brand_dark_mode: boolean
      card_template: string
      cta_label: string
      cta_url: string | null
    }
    type AdminRow = {
      company_id: string
      companies: CompanyRow | CompanyRow[] | null
    }

    const adminResult = await supabase
      .from('company_admins')
      .select(`
        company_id,
        companies (
          id, name, tagline, website, logo_url,
          brand_primary_color, brand_secondary_color, brand_dark_mode,
          card_template, cta_label, cta_url
        )
      `)
      .eq('user_id', user.id)
      .single()

    const adminRecord = adminResult.data as AdminRow | null

    if (adminResult.error || !adminRecord) {
      setLoadError('No company found for this account.')
      setLoading(false)
      return
    }

    // Normalise joined relation — Supabase may return array or object.
    const companyRaw = Array.isArray(adminRecord.companies)
      ? adminRecord.companies[0]
      : adminRecord.companies

    if (!companyRaw) {
      setLoadError('Failed to load company settings.')
      setLoading(false)
      return
    }

    const company = companyRaw as CompanyRow

    setCompanyId(adminRecord.company_id)
    setValues({
      id: company.id,
      name: company.name ?? '',
      tagline: company.tagline ?? '',
      website: company.website ?? '',
      logo_url: company.logo_url ?? null,
      brand_primary_color: company.brand_primary_color ?? '#16181D',
      brand_secondary_color: company.brand_secondary_color ?? '#F59608',
      brand_dark_mode: company.brand_dark_mode ?? true,
      card_template: (company.card_template as CardTemplate) ?? 'minimal',
      cta_label: company.cta_label ?? 'Send me a WhatsApp',
      cta_url: company.cta_url ?? '',
      logo_file: null,
      logo_preview: null,
    })
    setLoading(false)
  }

  // -------------------------------------------------------------------------
  // Logo upload handling
  // -------------------------------------------------------------------------

  const handleLogoFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, logo: 'Please select an image file.' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, logo: 'Logo must be under 5 MB.' }))
      return
    }
    setErrors(prev => ({ ...prev, logo: undefined }))

    const preview = URL.createObjectURL(file)
    setValues(prev => prev
      ? { ...prev, logo_file: file, logo_preview: preview }
      : prev
    )
  }, [])

  function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleLogoFile(file)
  }

  function handleLogoInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleLogoFile(file)
  }

  // -------------------------------------------------------------------------
  // Field change helper — immutable update
  // -------------------------------------------------------------------------

  function setField<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues(prev => prev ? { ...prev, [key]: val } : prev)
  }

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  async function handleSave() {
    if (!values || !companyId) return

    const validationErrors = validateForm(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSaving(true)
    setSaveError(null)

    // 1. Upload logo to Supabase Storage if a new file was selected
    let finalLogoUrl = values.logo_url

    if (values.logo_file) {
      try {
        const supabase = createClient()
        const resized = await resizeLogo(values.logo_file)
        const ext = 'png'
        const path = `${companyId}/logo.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(path, resized, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) {
          setSaveError(`Logo upload failed: ${uploadError.message}`)
          setSaving(false)
          return
        }

        const { data: urlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(path)

        // Bust the CDN cache by appending a timestamp query param
        finalLogoUrl = `${urlData.publicUrl}?t=${Date.now()}`
      } catch (err) {
        setSaveError('Logo upload failed. Please try again.')
        setSaving(false)
        return
      }
    }

    // 2. Call the server action — updates companies + revalidates all card pages
    const payload: UpdateCompanyBrandingInput = {
      name: values.name,
      tagline: values.tagline,
      website: values.website,
      brand_primary_color: values.brand_primary_color,
      brand_secondary_color: values.brand_secondary_color,
      brand_dark_mode: values.brand_dark_mode,
      card_template: values.card_template,
      cta_label: values.cta_label,
      cta_url: values.cta_url,
      logo_url: finalLogoUrl,
    }

    const result = await updateCompanyBranding(payload)

    if (result.error) {
      setSaveError(result.error)
      setSaving(false)
      return
    }

    // Update local state with the persisted logo URL and clear file state
    setValues(prev => prev
      ? { ...prev, logo_url: finalLogoUrl, logo_file: null, logo_preview: null }
      : prev
    )

    setSaving(false)
    setSaveSuccess(true)

    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(() => setSaveSuccess(false), 3500)
  }

  // -------------------------------------------------------------------------
  // Derived preview values — uses the live form state, not the saved state
  // -------------------------------------------------------------------------

  const previewLogoUrl = values?.logo_preview ?? values?.logo_url ?? null
  const previewCompany = values
    ? {
        name: values.name || 'Company Name',
        logo_url: previewLogoUrl,
        brand_primary_color: isValidHex(values.brand_primary_color)
          ? values.brand_primary_color
          : '#16181D',
        brand_secondary_color: isValidHex(values.brand_secondary_color)
          ? values.brand_secondary_color
          : '#F59608',
        brand_dark_mode: values.brand_dark_mode,
        cta_label: values.cta_label || 'Send me a WhatsApp',
        cta_url: values.cta_url || null,
      }
    : null

  // -------------------------------------------------------------------------
  // Render states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading branding settings…</p>
        </div>
      </div>
    )
  }

  if (loadError || !values) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3 max-w-sm">
          <span className="material-symbols-outlined text-4xl text-red-400">error</span>
          <p className="text-sm text-slate-600">{loadError ?? 'Failed to load branding settings.'}</p>
          <button
            onClick={loadCompany}
            className="px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main render
  // -------------------------------------------------------------------------

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Branding</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your company brand. Changes apply to all team cards instantly.
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={[
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            saving
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : saveSuccess
              ? 'bg-teal-500 text-white shadow-md'
              : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm hover:shadow-md',
          ].join(' ')}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : saveSuccess ? (
            <>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Saved & applied
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">save</span>
              Save & Apply to All Cards
            </>
          )}
        </button>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0">error</span>
          {saveError}
        </div>
      )}

      {/* Two-column layout: form left, preview right */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">

        {/* ------------------------------------------------------------------ */}
        {/* LEFT — form                                                         */}
        {/* ------------------------------------------------------------------ */}
        <div className="space-y-6">

          {/* Company Identity */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[20px] text-teal-600">business</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Company Identity</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Company name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={values.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="Karam Africa"
                  className={[
                    'w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow',
                    errors.name
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Website */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={values.website}
                  onChange={e => setField('website', e.target.value)}
                  placeholder="https://karamafrica.co.za"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow"
                />
              </div>

              {/* Tagline — full width */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  value={values.tagline}
                  onChange={e => setField('tagline', e.target.value)}
                  placeholder="Keeping you protected. Every day."
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Shown beneath your company name on every card page.
                </p>
              </div>

            </div>
          </section>

          {/* Logo */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[20px] text-teal-600">image</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Company Logo</h2>
            </div>

            <div className="flex items-start gap-6">

              {/* Current logo preview */}
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl border-2 border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shadow-sm">
                  {previewLogoUrl ? (
                    <img
                      src={previewLogoUrl}
                      alt="Company logo"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-slate-300">
                      image
                    </span>
                  )}
                </div>
                {(values.logo_url || values.logo_preview) && (
                  <button
                    onClick={() => setValues(prev => prev
                      ? { ...prev, logo_url: null, logo_file: null, logo_preview: null }
                      : prev
                    )}
                    className="mt-2 text-[11px] text-red-400 hover:text-red-600 font-medium w-full text-center transition-colors"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              {/* Drop zone */}
              <div
                className={[
                  'flex-1 rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer',
                  dragOver
                    ? 'border-teal-400 bg-teal-50/50'
                    : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50/50',
                  errors.logo ? 'border-red-300 bg-red-50/30' : '',
                ].join(' ')}
                onClick={() => logoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleLogoDrop}
              >
                <span className={[
                  'material-symbols-outlined text-3xl mb-2 block',
                  dragOver ? 'text-teal-500' : 'text-slate-300',
                ].join(' ')}>
                  cloud_upload
                </span>
                <p className="text-sm font-medium text-slate-600">
                  {values.logo_file ? values.logo_file.name : 'Click to upload or drag logo here'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  PNG, JPG, SVG or WebP — max 5 MB
                </p>
                {errors.logo && <p className="text-xs text-red-500 mt-2">{errors.logo}</p>}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoInputChange}
              />
            </div>
          </section>

          {/* Brand Colours */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[20px] text-teal-600">palette</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Brand Colours</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <ColourField
                label="Primary Colour"
                value={values.brand_primary_color}
                onChange={hex => setField('brand_primary_color', hex)}
                error={errors.brand_primary_color}
              />
              <ColourField
                label="Secondary Colour"
                value={values.brand_secondary_color}
                onChange={hex => setField('brand_secondary_color', hex)}
                error={errors.brand_secondary_color}
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-4">
              Primary colour is used for the card header, buttons, and icons.
              Secondary is used for accents.
            </p>
          </section>

          {/* Card Template */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[20px] text-teal-600">style</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Card Template</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TEMPLATES.map(t => {
                const active = values.card_template === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setField('card_template', t.value)}
                    className={[
                      'relative text-left rounded-2xl border-2 p-4 transition-all focus:outline-none focus:ring-2 focus:ring-teal-400/50',
                      active
                        ? 'border-teal-500 bg-teal-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white/50',
                    ].join(' ')}
                  >
                    {/* Template mini-illustration */}
                    <TemplateIllustration
                      template={t.value}
                      primary={isValidHex(values.brand_primary_color)
                        ? values.brand_primary_color
                        : '#16181D'}
                      active={active}
                    />

                    <div className="mt-3">
                      <p className={[
                        'text-sm font-semibold',
                        active ? 'text-teal-700' : 'text-slate-700',
                      ].join(' ')}>
                        {t.label}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </div>

                    {active && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-[14px]">check</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Appearance */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[20px] text-teal-600">contrast</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Appearance</h2>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Dark mode header</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  When on, the logo is shown in white on a dark brand-colour header.
                  When off, the logo is shown at full colour on a light background.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values.brand_dark_mode}
                onClick={() => setField('brand_dark_mode', !values.brand_dark_mode)}
                className={[
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                  'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-400/50',
                  values.brand_dark_mode ? 'bg-teal-500' : 'bg-slate-200',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow',
                    'transition duration-200 ease-in-out',
                    values.brand_dark_mode ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </div>
          </section>

          {/* Default CTA */}
          <section className="glass-panel rounded-2xl border border-slate-200/60 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[20px] text-teal-600">ads_click</span>
              <h2 className="font-jakarta font-semibold text-slate-800 text-base">Default CTA Button</h2>
            </div>
            <p className="text-[12px] text-slate-400 mb-5 ml-7">
              The WhatsApp call-to-action shown on every card. Staff can override this on their individual card.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Button Label
                </label>
                <input
                  type="text"
                  value={values.cta_label}
                  onChange={e => setField('cta_label', e.target.value)}
                  placeholder="Send me a WhatsApp"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Custom URL <span className="text-slate-300 font-normal normal-case">(optional — overrides wa.me)</span>
                </label>
                <input
                  type="url"
                  value={values.cta_url}
                  onChange={e => setField('cta_url', e.target.value)}
                  placeholder="https://wa.me/27…"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50 transition-shadow"
                />
              </div>
            </div>
          </section>

        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT — sticky live preview                                         */}
        {/* ------------------------------------------------------------------ */}
        {previewCompany && (
          <div className="hidden xl:block">
            <LiveCardPreview
              fullName="Alex Mokoena"
              jobTitle="Sales Manager"
              department="Sales & Marketing"
              bio=""
              phone="+27821234567"
              email="alex@example.com"
              whatsappNumber="+27821234567"
              showPhone
              showEmail
              socialLinks={{ linkedin: 'https://linkedin.com', website: '' }}
              ctaLabel={values.cta_label}
              ctaUrl={values.cta_url}
              photoSrc={null}
              company={previewCompany}
              cardTemplate={values.card_template}
            />
          </div>
        )}

      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// TemplateIllustration — small SVG diagram per template type
// ---------------------------------------------------------------------------

function TemplateIllustration({
  template,
  primary,
  active,
}: {
  template: CardTemplate
  primary: string
  active: boolean
}) {
  const bg = active ? primary : '#cbd5e1'

  if (template === 'minimal') {
    return (
      <div className="w-full h-16 rounded-xl overflow-hidden border border-slate-100 bg-white flex flex-col">
        {/* Header stripe */}
        <div className="h-5 w-full" style={{ backgroundColor: bg }} />
        {/* Content */}
        <div className="flex-1 px-2 py-1.5 space-y-1">
          <div className="h-1.5 w-2/3 rounded-full bg-slate-200" />
          <div className="h-1 w-1/2 rounded-full bg-slate-100" />
          <div className="h-2 w-full rounded-md mt-1" style={{ backgroundColor: `${bg}33` }} />
        </div>
      </div>
    )
  }

  if (template === 'bold') {
    return (
      <div className="w-full h-16 rounded-xl overflow-hidden border border-slate-100 bg-white flex flex-col">
        {/* Big brand header */}
        <div className="h-9 w-full flex items-end px-2 pb-1" style={{ backgroundColor: bg }}>
          <div className="w-5 h-5 rounded-full bg-white/40" />
        </div>
        {/* Minimal content */}
        <div className="flex-1 px-2 py-1 space-y-1">
          <div className="h-1.5 w-1/2 rounded-full bg-slate-200" />
          <div className="h-2 w-full rounded-md" style={{ backgroundColor: `${bg}33` }} />
        </div>
      </div>
    )
  }

  // split
  return (
    <div className="w-full h-16 rounded-xl overflow-hidden border border-slate-100 bg-white flex flex-row">
      {/* Left colour column */}
      <div className="w-1/3 h-full flex items-center justify-center" style={{ backgroundColor: bg }}>
        <div className="w-5 h-5 rounded-full bg-white/40" />
      </div>
      {/* Right content */}
      <div className="flex-1 px-2 py-2 space-y-1">
        <div className="h-1.5 w-3/4 rounded-full bg-slate-200" />
        <div className="h-1 w-1/2 rounded-full bg-slate-100" />
        <div className="h-2 w-full rounded-md mt-1" style={{ backgroundColor: `${bg}22` }} />
      </div>
    </div>
  )
}
