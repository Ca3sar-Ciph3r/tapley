// components/dashboard/live-card-preview.tsx
//
// Renders a scaled-down preview of the public card page using live form values.
// Used in the desktop sidebar of:
//   /dashboard/cards/[id]   — admin card edit
//   /dashboard/my-card      — staff self-edit
//   /dashboard/branding     — company branding config
//
// Updates in real-time as the admin edits fields — no network calls.
// Three visually distinct layouts driven by cardTemplate prop.

interface SocialLinksPreview {
  linkedin?: string
  instagram?: string
  twitter?: string
  facebook?: string
  website?: string
  calendly?: string
}

interface CompanyPreview {
  name: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  cta_label: string
  cta_url: string | null
}

export interface LiveCardPreviewProps {
  fullName: string
  jobTitle: string
  department: string
  bio: string
  phone: string
  email: string
  whatsappNumber: string
  showPhone: boolean
  showEmail: boolean
  socialLinks: SocialLinksPreview
  ctaLabel: string
  ctaUrl: string
  photoSrc: string | null  // local object URL or existing Supabase URL
  company: CompanyPreview
  cardTemplate: string     // 'minimal' | 'bold' | 'split'
}

// ---------------------------------------------------------------------------
// Social platform config — label + Material Symbol icon
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS: {
  key: keyof SocialLinksPreview
  label: string
  icon: string
}[] = [
  { key: 'linkedin',  label: 'LinkedIn',  icon: 'work' },
  { key: 'instagram', label: 'Instagram', icon: 'photo_camera' },
  { key: 'twitter',   label: 'Twitter',   icon: 'alternate_email' },
  { key: 'facebook',  label: 'Facebook',  icon: 'groups' },
  { key: 'website',   label: 'Website',   icon: 'language' },
  { key: 'calendly',  label: 'Calendly',  icon: 'calendar_today' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveCardPreview({
  fullName,
  jobTitle,
  department,
  bio,
  phone,
  email,
  whatsappNumber,
  showPhone,
  showEmail,
  socialLinks,
  ctaLabel,
  company,
  photoSrc,
  cardTemplate,
}: LiveCardPreviewProps) {
  const primary = company.brand_primary_color || '#16181D'
  const isDark = company.brand_dark_mode

  const displayName = fullName.trim() || 'Full Name'
  const displayTitle = jobTitle.trim() || 'Job Title'

  const activeSocials = SOCIAL_PLATFORMS.filter(p => socialLinks[p.key]?.trim())

  const effectiveCtaLabel = ctaLabel.trim() || company.cta_label || 'Send me a WhatsApp'
  const hasWaButton = !!(whatsappNumber.trim() || phone.trim())

  // Initials fallback for photo
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // ---------------------------------------------------------------------------
  // Shared sub-components
  // ---------------------------------------------------------------------------

  const PhotoAvatar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const cls = size === 'sm'
      ? 'w-12 h-12 text-sm'
      : 'w-16 h-16 text-lg'
    return (
      <div className={`${cls} rounded-full ring-2 ring-white shadow-md overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0`}>
        {photoSrc ? (
          <img src={photoSrc} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold text-slate-400">{initials}</span>
        )}
      </div>
    )
  }

  const ContactRows = () => (
    <>
      {((showPhone && phone.trim()) || (showEmail && email.trim())) && (
        <div className="space-y-1">
          {showPhone && phone.trim() && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] leading-none flex-shrink-0" style={{ color: primary }}>phone</span>
              <span className="text-[11px] text-slate-600 truncate">{phone}</span>
            </div>
          )}
          {showEmail && email.trim() && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[13px] leading-none flex-shrink-0" style={{ color: primary }}>mail</span>
              <span className="text-[11px] text-slate-600 truncate">{email}</span>
            </div>
          )}
        </div>
      )}
    </>
  )

  const SocialRow = () => (
    <>
      {activeSocials.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {activeSocials.map(p => (
            <span
              key={p.key}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white"
              style={{ backgroundColor: primary, opacity: 0.85 }}
              title={p.label}
            >
              <span className="material-symbols-outlined text-[12px] leading-none">{p.icon}</span>
            </span>
          ))}
        </div>
      )}
    </>
  )

  const CtaButtons = ({ textColor = '#ffffff' }: { textColor?: string }) => (
    <div className="space-y-1.5 pt-1">
      {hasWaButton && (
        <div className="w-full py-1.5 px-3 rounded-lg text-[10px] font-semibold text-center" style={{ backgroundColor: primary, color: textColor }}>
          {effectiveCtaLabel}
        </div>
      )}
      <div className="w-full py-1.5 px-3 rounded-lg text-[10px] font-semibold text-slate-600 text-center border border-slate-200 bg-white">
        Save Contact
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // bold template — full-bleed primary hero, white lower half
  // ---------------------------------------------------------------------------

  if (cardTemplate === 'bold') {
    return (
      <div className="sticky top-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Preview</p>
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200/70 max-w-[320px]">
          {/* Hero — full primary color */}
          <div className="px-5 pt-6 pb-8 text-center" style={{ backgroundColor: primary }}>
            {/* Logo */}
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-5 object-contain mx-auto mb-4"
                style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined, opacity: 0.9 }}
              />
            ) : (
              <span className="block text-xs font-bold mb-4" style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }}>
                {company.name}
              </span>
            )}
            {/* Photo */}
            <div className="flex justify-center mb-3">
              <PhotoAvatar />
            </div>
            {/* Name + title on colored bg */}
            <p className="text-sm font-bold leading-tight" style={{ color: isDark ? '#fff' : '#111' }}>
              {displayName}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
              {displayTitle}{department.trim() ? ` · ${department.trim()}` : ''}
            </p>
          </div>

          {/* Curve divider */}
          <div className="relative -mt-1" style={{ backgroundColor: primary }}>
            <svg viewBox="0 0 100 12" className="w-full block" preserveAspectRatio="none" style={{ height: 12 }}>
              <path d="M0,12 Q50,0 100,12 L100,12 L0,12 Z" fill="white" />
            </svg>
          </div>

          {/* White lower section */}
          <div className="bg-white px-5 pb-5 space-y-3">
            {bio.trim() && (
              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 pt-1">{bio.trim()}</p>
            )}
            <ContactRows />
            <SocialRow />
            <CtaButtons />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">Preview updates as you edit</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // split template — two-column (color left / white right)
  // ---------------------------------------------------------------------------

  if (cardTemplate === 'split') {
    return (
      <div className="sticky top-8">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Live Preview</p>
        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200/70 max-w-[320px]">
          {/* Logo header — full width */}
          <div className="px-4 py-3 flex items-center" style={{ backgroundColor: primary }}>
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-5 object-contain"
                style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined, opacity: 0.9 }}
              />
            ) : (
              <span className="text-xs font-bold" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)' }}>
                {company.name}
              </span>
            )}
          </div>

          {/* Two-column body */}
          <div className="flex min-h-[160px]">
            {/* Left: colored, photo + name + title */}
            <div
              className="w-[44%] flex flex-col items-center justify-center px-3 py-4 gap-2"
              style={{ backgroundColor: primary }}
            >
              <PhotoAvatar size="md" />
              <div className="text-center">
                <p className="text-[11px] font-bold leading-tight" style={{ color: isDark ? '#fff' : '#111' }}>
                  {displayName}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.6)' }}>
                  {displayTitle}
                </p>
              </div>
            </div>

            {/* Right: white, details */}
            <div className="w-[56%] bg-white px-3 py-4 space-y-2.5 flex flex-col justify-center">
              {bio.trim() && (
                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{bio.trim()}</p>
              )}
              <ContactRows />
              <SocialRow />
              <CtaButtons />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">Preview updates as you edit</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // minimal template (default) — coloured header strip, white body
  // ---------------------------------------------------------------------------

  return (
    <div className="sticky top-8">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Live Preview
      </p>
      <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200/70 bg-white max-w-[320px]">
        {/* Branded header strip */}
        <div
          className="relative px-5 pt-6 pb-10"
          style={{ backgroundColor: primary }}
        >
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-7 object-contain"
              style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined, opacity: 0.9 }}
            />
          ) : (
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.85)' }}
            >
              {company.name}
            </span>
          )}
        </div>

        {/* Profile photo — overlaps header */}
        <div className="relative px-5">
          <div className="relative -mt-8">
            <PhotoAvatar />
          </div>
        </div>

        {/* Card body */}
        <div className="px-5 pb-5 space-y-3 mt-2">
          {/* Name + title */}
          <div>
            <p className="text-base font-bold text-slate-900 leading-tight">{displayName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {displayTitle}
              {department.trim() ? ` · ${department.trim()}` : ''}
            </p>
            {bio.trim() && (
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{bio.trim()}</p>
            )}
          </div>

          <ContactRows />
          <SocialRow />
          <CtaButtons />
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Preview updates as you edit
      </p>
    </div>
  )
}
