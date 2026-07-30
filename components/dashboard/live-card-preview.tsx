// components/dashboard/live-card-preview.tsx
//
// A live preview of the public card page, driven by the form values being
// edited. No network calls — it re-renders on every keystroke.
//
// It shares resolveCardTheme() and CardHero with the real card page, so what an
// admin previews is what actually ships. It previously carried its own
// three-template implementation, which meant every change to the real page had
// to be mirrored here by hand — and the two had already drifted.
//
// The preview renders at the real card's pixel dimensions and is then scaled
// down with a CSS transform, rather than being rebuilt at a smaller size. That
// matters because the card's type uses vw-based clamps: re-implementing it at
// 320px wide would change every proportion, whereas scaling a true-size render
// preserves them exactly.

import { CardHero } from '@/components/card/card-hero'
import { resolveCardTheme } from '@/lib/utils/card-theme'
import type { SocialLinks } from '@/lib/utils/social-links'

// A 390x780 frame is an iPhone 14/15 viewport, the most common device that
// taps these cards. SCALE fits that into the dashboard's preview column.
const CARD_WIDTH = 390
const CARD_HEIGHT = 780
const SCALE = 0.82
// 56% of CARD_HEIGHT, matching the real card's h-[56vh] hero. Written as a
// literal because Tailwind scans source text and cannot generate a class name
// built at runtime — `h-[${n}px]` would silently produce no CSS at all.
const HERO_HEIGHT_CLASS = 'h-[437px]'

interface CompanyPreview {
  name: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  location?: string | null
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
  socialLinks: SocialLinks
  ctaLabel: string
  ctaUrl: string
  /** Local object URL for a pending upload, or the stored Supabase URL. */
  photoSrc: string | null
  /** Staff-level override of the company location. */
  location?: string
  company: CompanyPreview
}

const SOCIAL_KEYS = [
  'linkedin',
  'instagram',
  'twitter',
  'facebook',
  'website',
  'calendly',
] as const

export function LiveCardPreview({
  fullName,
  jobTitle,
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
  location,
}: LiveCardPreviewProps) {
  const theme = resolveCardTheme({
    primaryColor: company.brand_primary_color,
    secondaryColor: company.brand_secondary_color,
    isDark: company.brand_dark_mode,
  })

  const displayName = fullName.trim() || 'Full Name'
  const displayTitle = jobTitle.trim() || 'Job Title'
  const effectiveCtaLabel =
    ctaLabel.trim() || company.cta_label || 'Send me a WhatsApp'
  const hasWaButton = Boolean(whatsappNumber.trim() || phone.trim())
  const resolvedLocation = location?.trim() || company.location?.trim() || null

  const visiblePhone = showPhone && phone.trim()
  const visibleEmail = showEmail && email.trim()
  const activeSocials = SOCIAL_KEYS.filter(k => socialLinks[k]?.trim())

  return (
    <div className="sticky top-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Live Preview
      </p>

      <div
        className="overflow-hidden rounded-[26px] shadow-xl ring-1 ring-black/10"
        style={{
          width: CARD_WIDTH * SCALE,
          height: CARD_HEIGHT * SCALE,
        }}
      >
        <div
          className="flex flex-col"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${SCALE})`,
            transformOrigin: 'top left',
            backgroundColor: theme.bg,
          }}
        >
          <CardHero
            fullName={displayName}
            jobTitle={displayTitle}
            companyName={company.name}
            location={resolvedLocation}
            photoUrl={photoSrc}
            logoUrl={company.logo_url}
            theme={theme}
            // vh would resolve against the browser window, not this fixed frame.
            heightClassName={HERO_HEIGHT_CLASS}
            // photoSrc is often a blob: URL for a file not yet uploaded, which
            // the Next image optimiser cannot fetch.
            unoptimizedImage
          />

          <div className="flex flex-1 flex-col justify-center gap-4 px-[22px] pb-[26px] pt-4">
            {bio.trim() && (
              <p
                className="text-center text-[13px] leading-relaxed"
                style={{ color: theme.fg2 }}
              >
                {bio.trim()}
              </p>
            )}

            {(visiblePhone || visibleEmail) && (
              <>
                <div className="h-px w-full" style={{ backgroundColor: theme.hair }} />
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12.5px]">
                  {visiblePhone && (
                    <span style={{ color: theme.fg }}>{phone.trim()}</span>
                  )}
                  {visiblePhone && visibleEmail && (
                    <span style={{ color: theme.fg3 }}>|</span>
                  )}
                  {visibleEmail && (
                    <span className="break-all" style={{ color: theme.fg }}>
                      {email.trim()}
                    </span>
                  )}
                </div>
              </>
            )}

            <div className="h-px w-full" style={{ backgroundColor: theme.hair }} />

            <div className="flex flex-col gap-2.5">
              {hasWaButton && (
                <span
                  className="flex h-[52px] w-full items-center justify-center rounded-full px-4 text-center text-[15px] font-bold leading-tight"
                  style={{
                    background: theme.ctaFill,
                    color: theme.onBrand,
                    boxShadow: theme.ctaGlow,
                  }}
                >
                  {effectiveCtaLabel}
                </span>
              )}
              <span
                className="flex h-[52px] w-full items-center justify-center rounded-full border-[1.5px] text-[15px] font-bold"
                style={{ borderColor: theme.brand, color: theme.brand }}
              >
                Save Contact
              </span>
            </div>

            {activeSocials.length > 0 && (
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <span
                  className="text-[10.5px] uppercase"
                  style={{ color: theme.fg3, letterSpacing: '0.16em' }}
                >
                  Social
                </span>
                <div className="flex gap-[18px]">
                  {activeSocials.map(key => (
                    <span
                      key={key}
                      className="h-[18px] w-[18px] rounded-full"
                      style={{ backgroundColor: theme.brand }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
