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
// The ViewEventTracker client component reads ?src= from window.location.search
// after hydration.
//
// ---------------------------------------------------------------------------
// ONE DESIGN
// ---------------------------------------------------------------------------
// This page previously branched three ways on companies.card_template
// ('minimal' | 'bold' | 'split') — roughly 500 lines of three separate layouts,
// each with its own copy of the icon set. It now renders a single design for
// every company, driven entirely by brand colour, brand_dark_mode and staff data.
//
// card_template is no longer read. The column is deliberately LEFT IN the
// database: dropping it is a riskier migration with no benefit, and keeping it
// means this decision is reversible without touching the schema.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildWaLink, getFirstName, isValidPhoneNumber } from '@/lib/utils/whatsapp'
import { parseSocialLinks, hasSocialLinks } from '@/lib/utils/social-links'
import { sanitiseExternalUrl } from '@/lib/utils/safe-url'
import { resolveCardTheme, type CardTheme } from '@/lib/utils/card-theme'
import { ViewEventTracker } from '@/components/card/view-event-tracker'
import { CardActions } from '@/components/card/card-actions'
import { CardHero } from '@/components/card/card-hero'
import { LeadCaptureSheet } from '@/components/card/lead-capture-sheet'
import type { Tables } from '@/lib/types/database'

// ISR: cache this page indefinitely; revalidate only via revalidatePath('/c/[slug]')
export const revalidate = false

// Required for `revalidate` to actually take effect on a dynamic segment.
//
// A dynamic route with no generateStaticParams is rendered on demand by Next on
// EVERY request, regardless of the revalidate export — it never enters the full
// route cache. Verified against production before this was added: no
// x-nextjs-cache header at all, Cache-Control: private, no-cache, no-store,
// and /c/[slug] absent from prerender-manifest.json. So every NFC tap was
// hitting Supabase, and every revalidatePath() call in the mutation layer was
// busting a cache that did not exist.
//
// Returning [] prerenders nothing at build time — slugs are created at runtime,
// so there is nothing to enumerate — while still opting the route into static
// generation with on-demand fallback. That is ISR, and what CLAUDE.md Rule 2
// requires.
export async function generateStaticParams() {
  return []
}

interface PageProps {
  params: Promise<{ slug: string }>
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyData {
  name: string
  logo_url: string | null
  brand_primary_color: string
  brand_secondary_color: string
  brand_dark_mode: boolean
  website: string | null
  tagline: string | null
  location: string | null
  cta_label: string
  cta_url: string | null
}

type StaffCardWithCompany = Tables<'staff_cards'> & {
  companies: CompanyData | null
}

// Selected in three places — keep identical so the ISR payload is stable.
const COMPANY_FIELDS = `
  name, logo_url, brand_primary_color, brand_secondary_color,
  brand_dark_mode, website, tagline, location, cta_label, cta_url
`

// ---------------------------------------------------------------------------
// generateMetadata — Open Graph for WhatsApp / iMessage link previews
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  const { data: nfcCard } = await supabaseAdmin
    .from('nfc_cards')
    .select('id, company_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!nfcCard) return { title: 'Card Not Found — Tapley Connect' }

  const { data: staffCard } = await supabaseAdmin
    .from('staff_cards')
    .select('full_name, job_title, photo_url, companies(name, logo_url)')
    .eq('nfc_card_id', nfcCard.id)
    .eq('company_id', nfcCard.company_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staffCard) return { title: 'Tapley Connect' }

  const company = Array.isArray(staffCard.companies)
    ? staffCard.companies[0]
    : staffCard.companies

  return {
    title: `${staffCard.full_name} — ${company?.name ?? 'Tapley Connect'}`,
    description: staffCard.job_title,
    // POPIA: a card page publishes a named individual's direct phone number,
    // email and photo. The staff member consented to carrying a card, not to
    // being surfaced in Google results — that is a further processing purpose.
    // Cards are reached by tap, scan or a deliberate share, never by search, so
    // indexing has no product value to trade against it.
    //
    // Crawling stays ALLOWED on purpose: blocking it in robots.txt would stop
    // crawlers ever seeing this tag, and a card URL linked from anywhere could
    // then still be indexed URL-only.
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
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
    .maybeSingle()

  if (nfcError || !nfcCard) {
    notFound()
  }

  // Step 2: Deactivated card — branded placeholder, never a bare 404
  if (nfcCard.order_status === 'deactivated') {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select(COMPANY_FIELDS)
      .eq('id', nfcCard.company_id)
      .maybeSingle()

    return (
      <CardErrorPage
        company={company as CompanyData | null}
        message="This card is no longer active."
      />
    )
  }

  // Step 3: Find the active staff card joined with company branding.
  // The company_id filter is defence-in-depth: the FK join already scopes
  // branding to the staff card's own company, but this ensures a data-integrity
  // anomaly can never leak another company's branding onto this page.
  const staffCardResult = await supabaseAdmin
    .from('staff_cards')
    .select(`*, companies (${COMPANY_FIELDS})`)
    .eq('nfc_card_id', nfcCard.id)
    .eq('company_id', nfcCard.company_id)
    .eq('is_active', true)
    .maybeSingle()

  const staffCard = staffCardResult.data as StaffCardWithCompany | null

  // Step 4: No active staff card assigned yet — branded placeholder
  if (!staffCard) {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select(COMPANY_FIELDS)
      .eq('id', nfcCard.company_id)
      .maybeSingle()

    return (
      <CardErrorPage
        company={company as CompanyData | null}
        message="This card hasn't been set up yet."
      />
    )
  }

  const company = staffCard.companies
  const isDark = company?.brand_dark_mode ?? true

  // Light mode is a token swap, not a second layout — only these values change.
  //
  // resolveCardTheme also contrast-checks the accent against the resolved
  // background and nudges it until it clears WCAG AA. That is not hypothetical:
  // four of the five live companies have brand_secondary_color = #ffffff, which
  // is unreadable as an outline-button label the moment light mode is enabled.
  const theme = resolveCardTheme({
    primaryColor: company?.brand_primary_color,
    secondaryColor: company?.brand_secondary_color,
    isDark,
  })

  // Only render the WhatsApp CTA when the number can actually produce a working
  // wa.me link. normalisePhoneNumber returns '+' for an empty or junk value,
  // which built https://wa.me/?text=... — a perfect-looking primary button that
  // opens to nothing.
  const waNumber = staffCard.whatsapp_number ?? staffCard.phone
  const waUrl = isValidPhoneNumber(waNumber)
    ? buildWaLink(waNumber as string, getFirstName(staffCard.full_name))
    : null

  const ctaLabel = staffCard.cta_label ?? company?.cta_label ?? 'Send me a WhatsApp'

  // Sanitised on read as well as on write: this reaches an href, and rows
  // written before the write-side guard existed could hold an unsafe scheme.
  const customCtaUrl = sanitiseExternalUrl(staffCard.cta_url ?? company?.cta_url)
  const showCustomCta = Boolean(customCtaUrl && customCtaUrl !== waUrl)

  const socialLinks = parseSocialLinks(staffCard.social_links)
  const showPhone = staffCard.show_phone && Boolean(staffCard.phone)
  const showEmail = staffCard.show_email && Boolean(staffCard.email)

  // staff_cards.location overrides companies.location. The separator is omitted
  // entirely when neither is set — handled inside CardHero.
  const location = staffCard.location ?? company?.location ?? null

  return (
    <main
      className="min-h-[100dvh] w-full sm:flex sm:items-center sm:justify-center sm:p-8"
      style={{ backgroundColor: theme.bg }}
    >
      {/* Fires after hydration. Fire-and-forget — never blocks render. */}
      <ViewEventTracker nfcCardId={nfcCard.id} staffCardId={staffCard.id} />

      {/*
        Mobile is the primary case: full-bleed, no chrome. From `sm` up the card
        becomes a centred sheet rather than a narrow ribbon stranded in dead
        space, which is what a fixed max-w-sm produced on tablet and desktop.
      */}
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col sm:min-h-0 sm:overflow-hidden sm:rounded-[28px] sm:shadow-2xl"
        style={{ backgroundColor: theme.bg }}
      >
        <CardHero
          fullName={staffCard.full_name}
          jobTitle={staffCard.job_title}
          companyName={company?.name ?? null}
          location={location}
          photoUrl={staffCard.photo_url}
          logoUrl={company?.logo_url ?? null}
          theme={theme}
        />

        {/*
          justify-center distributes the leftover height evenly instead of
          stranding it all below the buttons. A staff member with no bio and no
          social links otherwise leaves ~150px of flat brand colour above the
          footer, which reads as a page that failed to finish loading. Cards
          with enough content have no slack to distribute, so nothing moves.
        */}
        <div className="flex flex-1 flex-col justify-center gap-4 px-[22px] pb-[26px] pt-4">
          {staffCard.bio && (
            <p
              className="text-center text-[13px] leading-relaxed"
              style={{ color: theme.fg2 }}
            >
              {staffCard.bio}
            </p>
          )}

          {(showPhone || showEmail) && (
            <>
              <Hairline color={theme.hair} />
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12.5px]">
                {showPhone && (
                  <a
                    href={`tel:${staffCard.phone}`}
                    className="inline-flex items-center gap-1.5 no-underline hover:underline hover:underline-offset-[3px]"
                    style={{ color: theme.fg }}
                  >
                    <PhoneGlyph color={theme.brand} />
                    {staffCard.phone}
                  </a>
                )}

                {showPhone && showEmail && (
                  <span style={{ color: theme.fg3 }}>|</span>
                )}

                {showEmail && (
                  <a
                    href={`mailto:${staffCard.email}`}
                    className="inline-flex items-center gap-1.5 break-all no-underline hover:underline hover:underline-offset-[3px]"
                    style={{ color: theme.fg }}
                  >
                    <MailGlyph color={theme.brand} />
                    {staffCard.email}
                  </a>
                )}
              </div>
            </>
          )}

          <Hairline color={theme.hair} />

          <CardActions
            nfcCardId={nfcCard.id}
            staffCardId={staffCard.id}
            waUrl={waUrl}
            slug={slug}
            ctaLabel={ctaLabel}
            customCtaLabel={showCustomCta ? 'View more' : null}
            customCtaUrl={showCustomCta ? customCtaUrl : null}
            secondaryColor={theme.brand}
            isDark={isDark}
          />

          {hasSocialLinks(socialLinks) && (
            <div className="flex flex-col items-center gap-2.5 pt-1">
              <span
                className="text-[10.5px] uppercase"
                style={{ color: theme.fg3, letterSpacing: '0.16em' }}
              >
                Social
              </span>
              <div className="flex gap-[18px]">
                {SOCIAL_ORDER.map(({ key, label, Glyph }) => {
                  const href = socialLinks[key]
                  if (!href) return null
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="grid place-items-center transition-transform duration-150 active:scale-95"
                      style={{ color: theme.brand }}
                    >
                      <Glyph />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {staffCard.show_optin_form && (
        <LeadCaptureSheet
          staffCardId={staffCard.id}
          nfcCardId={nfcCard.id}
          staffName={staffCard.full_name}
          companyName={company?.name ?? ''}
          logoUrl={company?.logo_url ?? null}
          primaryColor={company?.brand_primary_color ?? '#16181D'}
          secondaryColor={theme.brand}
          isDark={isDark}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Presentation helpers — server components, no client bundle cost
// ---------------------------------------------------------------------------

function Hairline({ color }: { color: string }) {
  return <div className="h-px w-full" style={{ backgroundColor: color }} />
}

function PhoneGlyph({ color }: { color: string }) {
  return (
    <svg
      className="h-[13px] w-[13px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailGlyph({ color }: { color: string }) {
  return (
    <svg
      className="h-[13px] w-[13px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  )
}

/**
 * One social glyph factory rather than eight near-identical components.
 * The previous page carried three copies of the whole icon set — one per
 * template — which is what made them look like dead code.
 */
function makeGlyph(path: React.ReactNode, outlined = false) {
  return function Glyph() {
    return (
      <svg
        className="h-[21px] w-[21px]"
        viewBox="0 0 24 24"
        fill={outlined ? 'none' : 'currentColor'}
        stroke={outlined ? 'currentColor' : undefined}
        strokeWidth={outlined ? 2 : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {path}
      </svg>
    )
  }
}

/** Fixed render order so the social row is stable across cards. */
const SOCIAL_ORDER = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    Glyph: makeGlyph(
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    Glyph: makeGlyph(
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1.2" />
      </>,
      true
    ),
  },
  {
    key: 'twitter',
    label: 'Twitter',
    Glyph: makeGlyph(
      <path d="M23.95 4.57a10 10 0 0 1-2.83.78 4.93 4.93 0 0 0 2.17-2.72 9.86 9.86 0 0 1-3.13 1.2 4.92 4.92 0 0 0-8.38 4.48A13.97 13.97 0 0 1 1.64 3.16a4.92 4.92 0 0 0 1.52 6.57 4.9 4.9 0 0 1-2.23-.62v.06a4.92 4.92 0 0 0 3.95 4.83 4.94 4.94 0 0 1-2.22.08 4.93 4.93 0 0 0 4.6 3.42A9.87 9.87 0 0 1 0 19.54a13.94 13.94 0 0 0 7.55 2.21c9.05 0 14-7.5 14-14 0-.21 0-.42-.02-.63a10 10 0 0 0 2.46-2.55z" />
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    Glyph: makeGlyph(
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.5 0-1.96.93-1.96 1.89v2.27h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07z" />
    ),
  },
  {
    key: 'website',
    label: 'Website',
    Glyph: makeGlyph(
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>,
      true
    ),
  },
  {
    key: 'calendly',
    label: 'Book a meeting',
    Glyph: makeGlyph(
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>,
      true
    ),
  },
] as const

// ---------------------------------------------------------------------------
// CardErrorPage — shared by the deactivated and unassigned states
// ---------------------------------------------------------------------------

function CardErrorPage({
  company,
  message,
}: {
  company: CompanyData | null
  message: string
}) {
  const theme: CardTheme = resolveCardTheme({
    primaryColor: company?.brand_primary_color,
    secondaryColor: company?.brand_secondary_color,
    isDark: company?.brand_dark_mode ?? true,
  })

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: theme.bg }}
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
      <p className="text-base font-medium" style={{ color: theme.fg }}>
        {message}
      </p>
      {company?.name && (
        <p className="mt-2 text-sm" style={{ color: theme.fg3 }}>
          {company.name}
        </p>
      )}
    </main>
  )
}
