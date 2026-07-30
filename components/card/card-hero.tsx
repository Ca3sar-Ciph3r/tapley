// components/card/card-hero.tsx
//
// The full-bleed hero: photo or monogram, gradient fade, and the name block.
//
// THE LAYOUT MUST NOT BRANCH. Photo and monogram occupy the identical box, so
// nothing below the hero shifts between the two states. Many staff at an
// industrial client will never have a studio portrait — the monogram is a
// first-class state, not an edge case.
//
// Server component: no interactivity, so it adds nothing to the client bundle
// and cannot delay the card render.

import Image from 'next/image'
import type { CardTheme } from '@/lib/utils/card-theme'
import { getInitials } from '@/lib/utils/card-theme'

interface CardHeroProps {
  fullName: string
  jobTitle: string
  companyName: string | null
  location: string | null
  photoUrl: string | null
  /**
   * Company logo. With no photo it replaces the initials outright; with a
   * photo it sits in the top-left corner on its own backdrop.
   */
  logoUrl?: string | null
  theme: CardTheme
  /**
   * Skip the Next image optimiser. Needed by the dashboard's live preview,
   * where photoUrl is often a blob: URL for a file not yet uploaded.
   */
  unoptimizedImage?: boolean
  /**
   * Height utilities for the hero box. The default is viewport-relative, which
   * is correct for the real card page because that fills the screen. The
   * dashboard preview renders into a fixed-size box instead, so it passes a
   * percentage — otherwise the hero would size itself against the browser
   * window and the preview would misrepresent the card's proportions.
   */
  heightClassName?: string
}

export function CardHero({
  fullName,
  jobTitle,
  companyName,
  location,
  photoUrl,
  logoUrl = null,
  theme,
  unoptimizedImage = false,
  heightClassName = 'h-[56vh] min-h-[300px] sm:h-[52vh] lg:h-[56vh]',
}: CardHeroProps) {
  // Omit the separator entirely when only one of the two is set.
  const metaParts = [companyName, location].filter(Boolean) as string[]

  return (
    <div className={`relative shrink-0 ${heightClassName}`}>
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={fullName}
          fill
          // Focal point sits high so faces are not cropped at the chin.
          className="object-cover [object-position:50%_22%]"
          // The hero is the LCP element on every card — load it eagerly.
          priority
          unoptimized={unoptimizedImage}
          sizes="(max-width: 640px) 100vw, 480px"
        />
      ) : (
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ background: theme.monogramBg }}
        >
          {logoUrl ? (
            // The company's own mark beats generated initials whenever one
            // exists — it is the thing the recipient actually recognises.
            <div className="relative -translate-y-[12%] h-[38%] w-[62%]">
              <Image
                src={logoUrl}
                alt={companyName ?? 'Company logo'}
                fill
                className="object-contain"
                priority
                unoptimized={unoptimizedImage}
                sizes="(max-width: 640px) 62vw, 280px"
              />
            </div>
          ) : (
            <span
              // Sits in the upper half so a long name wrapping to three lines
              // does not ride over the initials.
              className="-translate-y-[12%] text-[clamp(64px,22vw,92px)] font-black leading-none"
              style={{ color: theme.monogramFg, letterSpacing: '-0.05em' }}
              aria-hidden="true"
            >
              {getInitials(fullName)}
            </span>
          )}
        </div>
      )}

      {/*
        With a photo present the logo cannot sit on the photo unaided — logos
        are drawn for a known background and most are transparent PNGs, so a
        dark mark lands on dark hair and disappears. A near-opaque white chip
        gives it the clean ground it was designed for, and reads consistently
        whatever the photo behind it happens to be.
      */}
      {photoUrl && logoUrl && (
        <div className="absolute left-[18px] top-[18px] flex h-[46px] max-w-[45%] items-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-sm ring-1 ring-black/5">
          <div className="relative h-full w-full min-w-[54px]">
            <Image
              src={logoUrl}
              alt={companyName ?? 'Company logo'}
              fill
              className="object-contain object-left"
              unoptimized={unoptimizedImage}
              sizes="180px"
            />
          </div>
        </div>
      )}

      {/* Fades the hero into the page so the name sits on solid ground. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{ background: theme.heroFade }}
      />

      <div className="absolute inset-x-0 bottom-0 px-[22px] pb-1 text-center">
        <h1
          className="text-[clamp(34px,11vw,44px)] font-black uppercase"
          style={{
            color: theme.fg,
            lineHeight: 0.92,
            letterSpacing: '-0.035em',
            textWrap: 'balance',
          }}
        >
          {fullName}
        </h1>

        <p
          className="mt-[9px] text-[13px] font-semibold uppercase"
          style={{ color: theme.fg2, letterSpacing: '0.18em' }}
        >
          {jobTitle}
        </p>

        {metaParts.length > 0 && (
          <p className="mt-[9px] text-[12.5px]" style={{ color: theme.fg2 }}>
            {metaParts.map((part, i) => (
              <span key={part}>
                {i > 0 && (
                  <span className="mx-[5px]" style={{ color: theme.fg3 }}>
                    |
                  </span>
                )}
                {part}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
