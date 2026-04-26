'use client'

// app/(onboard)/onboard/_components/StepBranding.tsx
//
// Step 4: Brand configuration — logo, colours, card template, live preview.
// Uploads logo to Supabase Storage (company-assets bucket) then calls
// saveOnboardingBranding() server action.

import { useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { saveOnboardingBranding } from '@/lib/actions/self-service-onboarding'
import type { WizardBrand, WizardCompany, WizardPlan, WizardAccount } from '../_types'

const CARD_TEMPLATES = [
  { value: 'minimal' as const, label: 'Minimal', desc: 'Clean, text-forward' },
  { value: 'bold'    as const, label: 'Bold',    desc: 'High-impact colours' },
  { value: 'split'   as const, label: 'Split',   desc: 'Two-tone background' },
]

interface StepBrandingProps {
  initial:   WizardBrand | null
  companyId: string
  plan:      WizardPlan
  company:   WizardCompany
  account:   WizardAccount
  onNext:    (brand: WizardBrand) => void
  onBack:    () => void
}

export function StepBranding({ initial, companyId, company, onNext, onBack }: StepBrandingProps) {
  const [logoUrl,       setLogoUrl]       = useState<string | null>(initial?.logoUrl ?? null)
  const [logoPath,      setLogoPath]      = useState<string | null>(initial?.logoPath ?? null)
  const [primaryColor,  setPrimaryColor]  = useState(initial?.primaryColor  ?? '#16181D')
  const [secondaryColor,setSecondaryColor]= useState(initial?.secondaryColor ?? '#2DD4BF')
  const [isDark,        setIsDark]        = useState(initial?.isDark ?? true)
  const [cardTemplate,  setCardTemplate]  = useState<WizardBrand['cardTemplate']>(initial?.cardTemplate ?? 'minimal')
  const [uploading,     setUploading]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5 MB.')
      return
    }

    setUploading(true)
    setError(null)

    const supabase = createClient()
    const ext      = file.name.split('.').pop() ?? 'png'
    const path     = `${companyId}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path)

    setLogoUrl(publicUrl)
    setLogoPath(path)
    setUploading(false)
  }

  async function handleNext() {
    setSaving(true)
    setError(null)

    const { error: saveError } = await saveOnboardingBranding({
      companyId,
      logoUrl,
      logoPath,
      primaryColor,
      secondaryColor,
      isDark,
      cardTemplate,
    })

    if (saveError) {
      setError(saveError)
      setSaving(false)
      return
    }

    onNext({ logoUrl, logoPath, primaryColor, secondaryColor, isDark, cardTemplate })
  }

  const displayName = company.name

  return (
    <div>
      <h2 className="text-2xl font-bold font-jakarta text-slate-900 mb-1">Brand your cards</h2>
      <p className="text-slate-500 text-sm mb-8">
        Your branding appears on every digital card. You can update it anytime from the dashboard.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Logo upload */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Company logo
            </label>
            <div
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoUrl ? (
                <div className="relative w-12 h-12 flex-shrink-0">
                  <Image src={logoUrl} alt="Logo" fill style={{ objectFit: 'contain' }} />
                </div>
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px] text-slate-400">add_photo_alternate</span>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {uploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                </p>
                <p className="text-xs text-slate-400">PNG, JPG, SVG — max 5 MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
          </div>

          {/* Colours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Primary colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Accent colour
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Dark card background</p>
              <p className="text-xs text-slate-500 mt-0.5">White text on dark background vs black text on light</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              onClick={() => setIsDark(d => !d)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${isDark ? 'bg-teal-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Card template */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Card template
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CARD_TEMPLATES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setCardTemplate(t.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${cardTemplate === t.value ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <p className="font-semibold text-xs text-slate-800">{t.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Preview
          </label>
          <div
            className="rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: isDark ? '#1a1b1f' : '#ffffff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}
          >
            {/* Card header */}
            <div style={{ backgroundColor: primaryColor, padding: '20px 20px 28px', position: 'relative' }}>
              {cardTemplate === 'split' && (
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', backgroundColor: secondaryColor, opacity: 0.3 }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {logoUrl ? (
                  <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                    <Image src={logoUrl} alt={displayName} fill style={{ objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontWeight: 700, fontSize: 16 }}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{displayName}</p>
                  {company.tagline && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, margin: 0 }}>{company.tagline}</p>}
                </div>
              </div>
            </div>
            {/* Accent bar */}
            <div style={{ height: 4, backgroundColor: secondaryColor }} />
            {/* Card body */}
            <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
                <div>
                  <div style={{ height: 10, width: 100, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', borderRadius: 4 }} />
                  <div style={{ height: 8, width: 70, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 4, marginTop: 5 }} />
                </div>
              </div>
              <div style={{ height: 36, borderRadius: 10, backgroundColor: primaryColor, opacity: 0.9 }} />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="flex gap-3 mt-8">
        <button type="button" onClick={onBack} disabled={saving}
          className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          ← Back
        </button>
        <button type="button" onClick={handleNext} disabled={saving || uploading}
          className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm">
          {saving ? 'Saving…' : 'Continue to Payment →'}
        </button>
      </div>
    </div>
  )
}
