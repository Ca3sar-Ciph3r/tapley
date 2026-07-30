// lib/constants/logo-size.ts
//
// How large a company's logo renders on the public card.
//
// A plain module, not a server action file, so client components (the branding
// form and the live preview) can import these values directly. See the note in
// lib/constants/change-requests.ts for why that distinction matters.

export const LOGO_SIZE_VALUES = ['s', 'm', 'l'] as const

export type LogoSize = (typeof LOGO_SIZE_VALUES)[number]

export const DEFAULT_LOGO_SIZE: LogoSize = 'm'

interface LogoSizeSpec {
  label: string
  /**
   * Width of the logo when it stands in for the initials, as a percentage of
   * the hero. Height is capped alongside it so a tall square mark cannot grow
   * past the name block.
   */
  standaloneWidth: string
  standaloneHeight: string
  /** Height of the logo when it sits in the corner over a photo, in px. */
  overlayHeight: number
  /** Widest the corner logo may get, as a percentage of the card. */
  overlayMaxWidth: string
}

// Medium reproduces exactly what shipped before the size control existed, so
// every existing company keeps its current appearance by default.
export const LOGO_SIZES: Record<LogoSize, LogoSizeSpec> = {
  s: {
    label: 'Small',
    standaloneWidth: '46%',
    standaloneHeight: '28%',
    overlayHeight: 34,
    overlayMaxWidth: '34%',
  },
  m: {
    label: 'Medium',
    standaloneWidth: '62%',
    standaloneHeight: '38%',
    overlayHeight: 46,
    overlayMaxWidth: '45%',
  },
  l: {
    label: 'Large',
    standaloneWidth: '80%',
    standaloneHeight: '48%',
    overlayHeight: 60,
    overlayMaxWidth: '58%',
  },
}

/** Narrows an arbitrary database value to a usable size. */
export function toLogoSize(raw: unknown): LogoSize {
  return LOGO_SIZE_VALUES.includes(raw as LogoSize)
    ? (raw as LogoSize)
    : DEFAULT_LOGO_SIZE
}

// ---------------------------------------------------------------------------
// Position
//
// Only meaningful when the card has a photo. With no photo the logo replaces
// the initials in the centre of the hero — there is no corner to move it to.
// ---------------------------------------------------------------------------

export const LOGO_POSITION_VALUES = ['left', 'center', 'right'] as const

export type LogoPosition = (typeof LOGO_POSITION_VALUES)[number]

export const DEFAULT_LOGO_POSITION: LogoPosition = 'left'

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  left: 'Left',
  center: 'Centre',
  right: 'Right',
}

export function toLogoPosition(raw: unknown): LogoPosition {
  return LOGO_POSITION_VALUES.includes(raw as LogoPosition)
    ? (raw as LogoPosition)
    : DEFAULT_LOGO_POSITION
}

/**
 * Resolves a staff card's own setting against the company default.
 *
 * NULL on the card means inherit, so a company that later changes its default
 * logo size sees it flow through to every card that never overrode it.
 */
export function resolveLogoSize(
  cardValue: unknown,
  companyValue: unknown
): LogoSize {
  if (LOGO_SIZE_VALUES.includes(cardValue as LogoSize)) return cardValue as LogoSize
  return toLogoSize(companyValue)
}
