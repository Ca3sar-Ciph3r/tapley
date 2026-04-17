// app/(public)/c/[slug]/page.tsx
//
// Rendering:    ISR — cached indefinitely, revalidated on demand via revalidatePath().
// Performance:  Visible content < 1.5s on 3G. Served from Vercel edge on every NFC tap.
// Supabase:     supabaseAdmin (service role) — no user session, bypasses RLS for public read.
//
// Slug system (CLAUDE.md Rule 1):
//   1. Lookup nfc_cards WHERE slug = params.slug
//   2. Find staff_cards WHERE nfc_card_id = nfc_card.id AND is_active = true
//   3. Join companies for branding
//
// searchParams are intentionally NOT read here — keeps the page fully cacheable.
// The ViewEventTracker client component reads ?src= from window.location.search after hydration.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildWaLink, getFirstName } from '@/lib/utils/whatsapp'
import { ViewEventTracker } from '@/components/card/view-event-tracker'
import { CardActions } from '@/components/card/card-actions'
import { LeadCaptureSheet } from '@/components/card/lead-capture-sheet'
import type { Tables } from '@/lib/types/database'
import type { Json } from '@/lib/types/database'

// ISR: cache this page indefinitely; revalidate only via revalidatePath('/c/[slug]')
export const revalidate = false

interface PageProps {
  params: Promise<{ slug: string }>
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialLinks {
  linkedin?: string
  instagram?: string
  twitter?: string
  facebook?: string
  website?: string
  calendly?: string
}

interface CompanyData {
  name: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  card_template: string
  website: string | null
  tagline: string | null
  cta_label: string
  cta_url: string | null
}

type StaffCardWithCompany = Tables<'staff_cards'> & {
  companies: CompanyData | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSocialLinks(raw: Json): SocialLinks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as SocialLinks
}

function hasSocialLinks(links: SocialLinks): boolean {
  return Object.values(links).some(Boolean)
}

// ---------------------------------------------------------------------------
// generateMetadata — Open Graph for WhatsApp / iMessage link previews
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const { data: nfcCard } = await supabaseAdmin
    .from('nfc_cards')
    .select('id, company_id')
    .eq('slug', slug)
    .single()

  if (!nfcCard) return { title: 'Card Not Found — Tapley Connect' }

  const { data: staffCard } = await supabaseAdmin
    .from('staff_cards')
    .select('full_name, job_title, photo_url, companies(name, logo_url)')
    .eq('nfc_card_id', nfcCard.id)
    .eq('company_id', nfcCard.company_id)
    .eq('is_active', true)
    .single()

  if (!staffCard) return { title: 'Tapley Connect' }

  const company = Array.isArray(staffCard.companies)
    ? staffCard.companies[0]
    : staffCard.companies

  return {
    title: `${staffCard.full_name} — ${company?.name ?? 'Tapley Connect'}`,
    description: staffCard.job_title,
    openGraph: {
      title: staffCard.full_name,
      description: `${staffCard.job_title}${company?.name ? ` at ${company.name}` : ''}`,
      images: [staffCard.photo_url ?? company?.logo_url ?? ''].filter(Boolean),
    },
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CardPage({ params }: PageProps) {
  const { slug } = await params

  // Step 1: Look up nfc_card by slug
  const { data: nfcCard, error: nfcError } = await supabaseAdmin
    .from('nfc_cards')
    .select('id, company_id, order_status')
    .eq('slug', slug)
    .single()

  if (nfcError || !nfcCard) {
    notFound()
  }

  // Step 2: Deactivated card — show branded error page with company logo
  if (nfcCard.order_status === 'deactivated') {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name, logo_url, brand_primary_color, brand_secondary_color, brand_dark_mode')
      .eq('id', nfcCard.company_id)
      .single()

    return (
      <CardErrorPage
        company={company}
        message="This card is no longer active."
      />
    )
  }

  // Step 3: Find active staff card joined with company branding.
  // The company_id filter is a defense-in-depth guard: the FK join already scopes
  // branding to the staff card's own company, but this ensures a data-integrity
  // anomaly (staff card under a different company_id) can never leak another
  // company's branding onto this page.
  const staffCardResult = await supabaseAdmin
    .from('staff_cards')
    .select(`
      *,
      companies (
        name, logo_url, brand_primary_color, brand_secondary_color,
        brand_dark_mode, card_template, website, tagline, cta_label, cta_url
      )
    `)
    .eq('nfc_card_id', nfcCard.id)
    .eq('company_id', nfcCard.company_id)
    .eq('is_active', true)
    .single()

  const staffCard = staffCardResult.data as StaffCardWithCompany | null

  // Step 4: No active staff card assigned yet — branded placeholder
  if (!staffCard) {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name, logo_url, brand_primary_color, brand_secondary_color, brand_dark_mode')
      .eq('id', nfcCard.company_id)
      .single()

    return (
      <CardErrorPage
        company={company}
        message="This card hasn't been set up yet."
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Resolve branding tokens
  // ---------------------------------------------------------------------------
  const company = staffCard.companies
  const isDark = company?.brand_dark_mode ?? true
  const primaryColor = company?.brand_primary_color ?? '#16181D'
  const secondaryColor = company?.brand_secondary_color ?? '#F59608'

  const textPrimary = isDark ? '#ffffff' : '#111827'
  const textSecondary = isDark ? 'rgba(255,255,255,0.6)' : '#6B7280'
  const surfaceColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)'
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const iconBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
  const iconColor = isDark ? 'rgba(255,255,255,0.7)' : '#6B7280'

  // ---------------------------------------------------------------------------
  // Resolve CTAs
  // ---------------------------------------------------------------------------
  const waNumber = staffCard.whatsapp_number ?? staffCard.phone
  const waUrl = waNumber ? buildWaLink(waNumber, getFirstName(staffCard.full_name)) : null
  const ctaLabel = staffCard.cta_label ?? company?.cta_label ?? 'Send me a WhatsApp'
  // Custom CTA: a separate URL override (e.g. Calendly, website landing page)
  const customCtaUrl = staffCard.cta_url ?? company?.cta_url ?? null
  // Only show custom CTA button if it differs from the WA deeplink
  const showCustomCta = customCtaUrl && customCtaUrl !== waUrl

  const socialLinks = parseSocialLinks(staffCard.social_links)

  const cardTemplate = company?.card_template ?? 'minimal'

  // ── bold template ─────────────────────────────────────────────────────────
  if (cardTemplate === 'bold') {
    return (
      <main className="min-h-screen bg-white">
        <ViewEventTracker nfcCardId={nfcCard.id} staffCardId={staffCard.id} />
        <LeadCaptureSheet
          staffCardId={staffCard.id}
          companyId={staffCard.company_id}
          staffName={staffCard.full_name}
          companyName={company?.name ?? ''}
          logoUrl={company?.logo_url ?? null}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          isDark={isDark}
        />
        <div className="mx-auto max-w-sm pb-4">

          {/* Hero — full-bleed primary colour: logo + photo + name + title */}
          <div style={{ backgroundColor: primaryColor }}>
            <header className="flex items-center justify-center px-6 pt-10 pb-5">
              {company?.logo_url ? (
                <div className="relative h-10 w-36">
                  <Image
                    src={company.logo_url}
                    alt={company.name}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              ) : (
                <p className="text-sm font-semibold tracking-wide" style={{ color: textSecondary }}>
                  {company?.name ?? ''}
                </p>
              )}
            </header>

            <section className="px-6 pb-10 text-center">
              {/* Profile photo */}
              <div
                className="mx-auto mb-5 h-28 w-28 rounded-full p-0.5"
                style={{ background: secondaryColor }}
              >
                <div className="h-full w-full overflow-hidden rounded-full">
                  {staffCard.photo_url ? (
                    <Image
                      src={staffCard.photo_url}
                      alt={staffCard.full_name}
                      width={112}
                      height={112}
                      className="h-full w-full object-cover"
                      priority
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-3xl font-bold"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : primaryColor, color: '#ffffff' }}
                    >
                      {staffCard.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              {/* Name */}
              <h1 className="mb-1 text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
                {staffCard.full_name}
              </h1>
              {/* Job title */}
              <p className="mb-1 text-base font-medium" style={{ color: textSecondary }}>
                {staffCard.job_title}
              </p>
              {(staffCard.department || company?.name) && (
                <p className="text-sm" style={{ color: textSecondary }}>
                  {[staffCard.department, company?.name].filter(Boolean).join(' · ')}
                </p>
              )}
            </section>

            {/* Curved divider — transitions from primary to white */}
            <div className="relative" style={{ backgroundColor: primaryColor }}>
              <svg
                viewBox="0 0 100 20"
                className="w-full block"
                preserveAspectRatio="none"
                style={{ height: 24, display: 'block' }}
              >
                <path d="M0,20 Q50,0 100,20 L100,20 L0,20 Z" fill="white" />
              </svg>
            </div>
          </div>

          {/* White lower section — bio, contact, socials, CTAs */}
          <div className="bg-white px-6 pb-2">
            {staffCard.bio && (
              <p className="mb-5 text-center text-sm leading-relaxed text-slate-500">{staffCard.bio}</p>
            )}
            {!staffCard.bio && company?.tagline && (
              <p className="mb-5 text-center text-sm leading-relaxed italic text-slate-400">{company.tagline}</p>
            )}

            {((staffCard.show_phone && staffCard.phone) || (staffCard.show_email && staffCard.email)) && (
              <section className="space-y-2.5 pb-6">
                {staffCard.show_phone && staffCard.phone && (
                  <a href={`tel:${staffCard.phone}`} className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70" style={{ backgroundColor: '#F9FAFB', color: '#111827' }}>
                    <PhoneIcon color={secondaryColor} />
                    <span className="text-sm font-medium">{staffCard.phone}</span>
                  </a>
                )}
                {staffCard.show_email && staffCard.email && (
                  <a href={`mailto:${staffCard.email}`} className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70" style={{ backgroundColor: '#F9FAFB', color: '#111827' }}>
                    <EmailIcon color={secondaryColor} />
                    <span className="text-sm font-medium">{staffCard.email}</span>
                  </a>
                )}
              </section>
            )}

            {hasSocialLinks(socialLinks) && (
              <section className="pb-6">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {socialLinks.linkedin && <SocialIconLink href={socialLinks.linkedin} label="LinkedIn" bg="rgba(0,0,0,0.06)" color="#6B7280"><LinkedInIcon /></SocialIconLink>}
                  {socialLinks.instagram && <SocialIconLink href={socialLinks.instagram} label="Instagram" bg="rgba(0,0,0,0.06)" color="#6B7280"><InstagramIcon /></SocialIconLink>}
                  {socialLinks.twitter && <SocialIconLink href={socialLinks.twitter} label="Twitter / X" bg="rgba(0,0,0,0.06)" color="#6B7280"><TwitterIcon /></SocialIconLink>}
                  {socialLinks.facebook && <SocialIconLink href={socialLinks.facebook} label="Facebook" bg="rgba(0,0,0,0.06)" color="#6B7280"><FacebookIcon /></SocialIconLink>}
                  {socialLinks.website && <SocialIconLink href={socialLinks.website} label="Website" bg="rgba(0,0,0,0.06)" color="#6B7280"><GlobeIcon /></SocialIconLink>}
                  {socialLinks.calendly && <SocialIconLink href={socialLinks.calendly} label="Book a meeting" bg="rgba(0,0,0,0.06)" color="#6B7280"><CalendarIcon /></SocialIconLink>}
                </div>
              </section>
            )}
          </div>

          <CardActions
            nfcCardId={nfcCard.id}
            waUrl={waUrl}
            slug={slug}
            ctaLabel={ctaLabel}
            customCtaLabel={showCustomCta ? ctaLabel : null}
            customCtaUrl={showCustomCta ? customCtaUrl : null}
            secondaryColor={secondaryColor}
            isDark={false}
          />
        </div>
      </main>
    )
  }

  // ── split template ────────────────────────────────────────────────────────
  if (cardTemplate === 'split') {
    return (
      <main className="min-h-screen bg-white">
        <ViewEventTracker nfcCardId={nfcCard.id} staffCardId={staffCard.id} />
        <LeadCaptureSheet
          staffCardId={staffCard.id}
          companyId={staffCard.company_id}
          staffName={staffCard.full_name}
          companyName={company?.name ?? ''}
          logoUrl={company?.logo_url ?? null}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          isDark={isDark}
        />

        {/* Company logo — full width header */}
        <header
          className="flex items-center justify-center px-6 py-5"
          style={{ backgroundColor: primaryColor }}
        >
          {company?.logo_url ? (
            <div className="relative h-9 w-32">
              <Image
                src={company.logo_url}
                alt={company.name}
                fill
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <p className="text-sm font-semibold tracking-wide" style={{ color: textSecondary }}>
              {company?.name ?? ''}
            </p>
          )}
        </header>

        {/* Mobile: stacked. md+: two-column */}
        <div className="md:flex md:min-h-[calc(100vh-68px)]">

          {/* Left column — brand colour, photo + name + title */}
          <div
            className="flex flex-col items-center justify-center px-8 py-10 md:w-[42%]"
            style={{ backgroundColor: primaryColor }}
          >
            <div
              className="mb-5 h-28 w-28 rounded-full p-0.5"
              style={{ background: secondaryColor }}
            >
              <div className="h-full w-full overflow-hidden rounded-full">
                {staffCard.photo_url ? (
                  <Image
                    src={staffCard.photo_url}
                    alt={staffCard.full_name}
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                    priority
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-3xl font-bold"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : primaryColor, color: '#ffffff' }}
                  >
                    {staffCard.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-xl font-bold text-center tracking-tight" style={{ color: textPrimary }}>
              {staffCard.full_name}
            </h1>
            <p className="mt-1 text-sm font-medium text-center" style={{ color: textSecondary }}>
              {staffCard.job_title}
            </p>
            {(staffCard.department || company?.name) && (
              <p className="mt-1 text-xs text-center" style={{ color: textSecondary }}>
                {[staffCard.department, company?.name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Right column — white, contact details + socials + CTAs */}
          <div className="bg-white flex-1 px-6 py-8">
            {staffCard.bio && (
              <p className="mb-5 text-sm leading-relaxed text-slate-500">{staffCard.bio}</p>
            )}
            {!staffCard.bio && company?.tagline && (
              <p className="mb-5 text-sm leading-relaxed italic text-slate-400">{company.tagline}</p>
            )}

            {((staffCard.show_phone && staffCard.phone) || (staffCard.show_email && staffCard.email)) && (
              <section className="space-y-2.5 pb-6">
                {staffCard.show_phone && staffCard.phone && (
                  <a href={`tel:${staffCard.phone}`} className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70" style={{ backgroundColor: '#F9FAFB', color: '#111827' }}>
                    <PhoneIcon color={primaryColor} />
                    <span className="text-sm font-medium">{staffCard.phone}</span>
                  </a>
                )}
                {staffCard.show_email && staffCard.email && (
                  <a href={`mailto:${staffCard.email}`} className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70" style={{ backgroundColor: '#F9FAFB', color: '#111827' }}>
                    <EmailIcon color={primaryColor} />
                    <span className="text-sm font-medium">{staffCard.email}</span>
                  </a>
                )}
              </section>
            )}

            {hasSocialLinks(socialLinks) && (
              <section className="pb-6">
                <div className="flex flex-wrap items-center gap-3">
                  {socialLinks.linkedin && <SocialIconLink href={socialLinks.linkedin} label="LinkedIn" bg="rgba(0,0,0,0.06)" color="#6B7280"><LinkedInIcon /></SocialIconLink>}
                  {socialLinks.instagram && <SocialIconLink href={socialLinks.instagram} label="Instagram" bg="rgba(0,0,0,0.06)" color="#6B7280"><InstagramIcon /></SocialIconLink>}
                  {socialLinks.twitter && <SocialIconLink href={socialLinks.twitter} label="Twitter / X" bg="rgba(0,0,0,0.06)" color="#6B7280"><TwitterIcon /></SocialIconLink>}
                  {socialLinks.facebook && <SocialIconLink href={socialLinks.facebook} label="Facebook" bg="rgba(0,0,0,0.06)" color="#6B7280"><FacebookIcon /></SocialIconLink>}
                  {socialLinks.website && <SocialIconLink href={socialLinks.website} label="Website" bg="rgba(0,0,0,0.06)" color="#6B7280"><GlobeIcon /></SocialIconLink>}
                  {socialLinks.calendly && <SocialIconLink href={socialLinks.calendly} label="Book a meeting" bg="rgba(0,0,0,0.06)" color="#6B7280"><CalendarIcon /></SocialIconLink>}
                </div>
              </section>
            )}

            <CardActions
              nfcCardId={nfcCard.id}
              waUrl={waUrl}
              slug={slug}
              ctaLabel={ctaLabel}
              customCtaLabel={showCustomCta ? ctaLabel : null}
              customCtaUrl={showCustomCta ? customCtaUrl : null}
              secondaryColor={secondaryColor}
              isDark={false}
            />
          </div>

        </div>
      </main>
    )
  }

  // ── minimal template (default) ────────────────────────────────────────────
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: isDark ? primaryColor : '#F9FAFB' }}
    >
      {/* View event — fires after hydration, fire-and-forget, never blocks render */}
      <ViewEventTracker nfcCardId={nfcCard.id} staffCardId={staffCard.id} />
      <LeadCaptureSheet
        staffCardId={staffCard.id}
        companyId={staffCard.company_id}
        staffName={staffCard.full_name}
        companyName={company?.name ?? ''}
        logoUrl={company?.logo_url ?? null}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        isDark={isDark}
      />

      <div className="mx-auto max-w-sm pb-4">

        {/* ── Header: Company logo ──────────────────────────────────── */}
        <header className="flex items-center justify-center px-6 pt-10 pb-6">
          {company?.logo_url ? (
            <div className="relative h-10 w-36">
              <Image
                src={company.logo_url}
                alt={company.name}
                fill
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <p className="text-sm font-semibold tracking-wide" style={{ color: textSecondary }}>
              {company?.name ?? ''}
            </p>
          )}
        </header>

        {/* ── Profile: Photo + Name + Title ────────────────────────── */}
        <section className="px-6 pb-8 text-center">
          {/* Circular photo with accent-color ring */}
          <div
            className="mx-auto mb-5 h-28 w-28 rounded-full p-0.5"
            style={{ background: secondaryColor }}
          >
            <div className="h-full w-full overflow-hidden rounded-full">
              {staffCard.photo_url ? (
                <Image
                  src={staffCard.photo_url}
                  alt={staffCard.full_name}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  priority
                />
              ) : (
                // Initials fallback
                <div
                  className="flex h-full w-full items-center justify-center text-3xl font-bold"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : primaryColor,
                    color: isDark ? '#ffffff' : '#ffffff',
                  }}
                >
                  {staffCard.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <h1
            className="mb-1 text-2xl font-bold tracking-tight"
            style={{ color: textPrimary }}
          >
            {staffCard.full_name}
          </h1>

          {/* Job title */}
          <p className="mb-1 text-base font-medium" style={{ color: textSecondary }}>
            {staffCard.job_title}
          </p>

          {/* Department · Company name */}
          {(staffCard.department || company?.name) && (
            <p className="mb-4 text-sm" style={{ color: textSecondary }}>
              {[staffCard.department, company?.name].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Bio */}
          {staffCard.bio && (
            <p
              className="mx-auto max-w-xs text-sm leading-relaxed"
              style={{ color: textSecondary }}
            >
              {staffCard.bio}
            </p>
          )}

          {/* Company tagline (shown if no bio) */}
          {!staffCard.bio && company?.tagline && (
            <p
              className="mx-auto max-w-xs text-sm leading-relaxed italic"
              style={{ color: textSecondary }}
            >
              {company.tagline}
            </p>
          )}
        </section>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div
          className="mx-6 mb-6"
          style={{ borderTop: `1px solid ${dividerColor}` }}
        />

        {/* ── Contact info: Phone + Email ───────────────────────────── */}
        {((staffCard.show_phone && staffCard.phone) ||
          (staffCard.show_email && staffCard.email)) && (
          <section className="space-y-2.5 px-6 pb-6">
            {staffCard.show_phone && staffCard.phone && (
              <a
                href={`tel:${staffCard.phone}`}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70"
                style={{ backgroundColor: surfaceColor, color: textPrimary }}
              >
                <PhoneIcon color={secondaryColor} />
                <span className="text-sm font-medium">{staffCard.phone}</span>
              </a>
            )}
            {staffCard.show_email && staffCard.email && (
              <a
                href={`mailto:${staffCard.email}`}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70"
                style={{ backgroundColor: surfaceColor, color: textPrimary }}
              >
                <EmailIcon color={secondaryColor} />
                <span className="text-sm font-medium">{staffCard.email}</span>
              </a>
            )}
          </section>
        )}

        {/* ── Social links ──────────────────────────────────────────── */}
        {hasSocialLinks(socialLinks) && (
          <section className="px-6 pb-6">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {socialLinks.linkedin && (
                <SocialIconLink href={socialLinks.linkedin} label="LinkedIn" bg={iconBg} color={iconColor}>
                  <LinkedInIcon />
                </SocialIconLink>
              )}
              {socialLinks.instagram && (
                <SocialIconLink href={socialLinks.instagram} label="Instagram" bg={iconBg} color={iconColor}>
                  <InstagramIcon />
                </SocialIconLink>
              )}
              {socialLinks.twitter && (
                <SocialIconLink href={socialLinks.twitter} label="Twitter / X" bg={iconBg} color={iconColor}>
                  <TwitterIcon />
                </SocialIconLink>
              )}
              {socialLinks.facebook && (
                <SocialIconLink href={socialLinks.facebook} label="Facebook" bg={iconBg} color={iconColor}>
                  <FacebookIcon />
                </SocialIconLink>
              )}
              {socialLinks.website && (
                <SocialIconLink href={socialLinks.website} label="Website" bg={iconBg} color={iconColor}>
                  <GlobeIcon />
                </SocialIconLink>
              )}
              {socialLinks.calendly && (
                <SocialIconLink href={socialLinks.calendly} label="Book a meeting" bg={iconBg} color={iconColor}>
                  <CalendarIcon />
                </SocialIconLink>
              )}
            </div>
          </section>
        )}

        {/* ── CTA buttons: WhatsApp + Save Contact + Custom ─────────── */}
        <CardActions
          nfcCardId={nfcCard.id}
          waUrl={waUrl}
          slug={slug}
          ctaLabel={ctaLabel}
          customCtaLabel={showCustomCta ? ctaLabel : null}
          customCtaUrl={showCustomCta ? customCtaUrl : null}
          secondaryColor={secondaryColor}
          isDark={isDark}
        />

      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// CardErrorPage — shared for deactivated + unassigned states
// ---------------------------------------------------------------------------

type BrandingMinimal = {
  name: string
  logo_url: string | null
  brand_primary_color: string
  brand_dark_mode: boolean
} | null

function CardErrorPage({
  company,
  message,
}: {
  company: BrandingMinimal
  message: string
}) {
  const isDark = company?.brand_dark_mode ?? true
  const primaryColor = company?.brand_primary_color ?? '#16181D'
  const textColor = isDark ? '#ffffff' : '#111827'
  const textMuted = isDark ? 'rgba(255,255,255,0.45)' : '#9CA3AF'

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: isDark ? primaryColor : '#F9FAFB' }}
    >
      {company?.logo_url && (
        <div className="relative mb-8 h-10 w-40">
          <Image
            src={company.logo_url}
            alt={company.name}
            fill
            className="object-contain"
            priority
          />
        </div>
      )}
      <p className="text-base font-medium" style={{ color: textColor }}>
        {message}
      </p>
      {company?.name && (
        <p className="mt-2 text-sm" style={{ color: textMuted }}>
          {company.name}
        </p>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Small server-component helpers (no client bundle cost)
// ---------------------------------------------------------------------------

function SocialIconLink({
  href,
  label,
  bg,
  color,
  children,
}: {
  href: string
  label: string
  bg: string
  color: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity active:opacity-70"
      style={{ backgroundColor: bg, color }}
    >
      {children}
    </a>
  )
}

function PhoneIcon({ color }: { color: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.9 11.3a19.79 19.79 0 01-3.07-8.67A2 2 0 012.81 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 9.91a16 16 0 006 6l.91-.91a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

function EmailIcon({ color }: { color: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TwitterIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
