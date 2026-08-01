// lib/utils/card-theme.ts
//
// Resolves the public card page's colour tokens from a company's two brand
// colours plus brand_dark_mode.
//
// Why these are computed in TypeScript rather than with CSS color-mix():
// the design spec uses color-mix() for the gradient fade, the monogram
// radial and the primary button. color-mix() needs Chrome 111+ / Safari 16.2+,
// and a large slice of this product's audience is on budget Android handsets
// running older Chrome — the exact devices CLAUDE.md calls out as the reason
// QR is a mandatory fallback. The brand colour is known at render time on the
// server, so mixing it here costs nothing and emits plain rgb()/rgba() that
// works everywhere.
//
// Light mode is a token swap, not a second layout: only these values change.

export interface CardTheme {
  /** Page background. */
  bg: string
  /** Primary text. */
  fg: string
  /** Secondary text — 62% dark / 66% light per the spec's contrast floor. */
  fg2: string
  /** Tertiary text — 40% dark / 45% light. */
  fg3: string
  /** Hairline dividers. */
  hair: string
  /** Brand accent: icons, outlines, social. */
  brand: string
  /** Gradient fade from the hero into the page background. */
  heroFade: string
  /** Radial gradient behind the monogram fallback. */
  monogramBg: string
  /** Initials colour, chosen to read against the centre of monogramBg. */
  monogramFg: string
  /** Primary CTA fill. */
  ctaFill: string
  /** Soft glow under the primary CTA. */
  ctaGlow: string
  /** Text colour that reads on top of the accent. */
  onBrand: string
}

export interface Rgb {
  r: number
  g: number
  b: number
}

const FALLBACK_PRIMARY = '#16181D'
const FALLBACK_SECONDARY = '#F59608'

export function parseHex(hex: string | null | undefined, fallback: string): Rgb {
  const source = /^#[0-9a-f]{6}$/i.test(hex ?? '') ? (hex as string) : fallback
  return {
    r: parseInt(source.slice(1, 3), 16),
    g: parseInt(source.slice(3, 5), 16),
    b: parseInt(source.slice(5, 7), 16),
  }
}

const toCss = ({ r, g, b }: Rgb): string => `rgb(${r}, ${g}, ${b})`

/** Blend `amount` (0–1) of `a` into `b`. Mirrors CSS color-mix in sRGB. */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount))
  return {
    r: Math.round(a.r * t + b.r * (1 - t)),
    g: Math.round(a.g * t + b.g * (1 - t)),
    b: Math.round(a.b * t + b.b * (1 - t)),
  }
}

const rgba = ({ r, g, b }: Rgb, alpha: number): string =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`

/**
 * Relative luminance per WCAG 2.1.
 * Used to decide whether text on the accent should be black or white.
 */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.1 contrast ratio between two colours (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Nudge the accent until it clears `minRatio` against the card background.
 *
 * A mid-tone brand colour that reads fine on near-black can fail badly on the
 * off-white light ground — the spec calls this out explicitly. Rather than let
 * a company's palette render illegible contact icons and outline buttons, the
 * accent is walked toward white (on a dark ground) or black (on a light one)
 * until it passes. The company's colour is preserved whenever it already does.
 */
export function ensureAccentContrast(accent: Rgb, bg: Rgb, minRatio: number): Rgb {
  if (contrastRatio(accent, bg) >= minRatio) return accent

  const target: Rgb =
    luminance(bg) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }

  let best = accent
  for (let step = 1; step <= 20; step++) {
    best = mix(target, accent, step / 20)
    if (contrastRatio(best, bg) >= minRatio) return best
  }
  return best
}

export interface ResolveCardThemeInput {
  primaryColor: string | null | undefined
  secondaryColor: string | null | undefined
  isDark: boolean
}

/** Light ground. Deliberately off-white, not pure #FFF — matches the spec. */
const LIGHT_BG: Rgb = { r: 247, g: 247, b: 245 }

export function resolveCardTheme({
  primaryColor,
  secondaryColor,
  isDark,
}: ResolveCardThemeInput): CardTheme {
  const primary = parseHex(primaryColor, FALLBACK_PRIMARY)
  const rawAccent = parseHex(secondaryColor, FALLBACK_SECONDARY)

  // Dark mode grounds the card in the company's primary colour; light mode uses
  // the neutral off-white, because an arbitrary brand colour cannot be assumed
  // to work as a light page background.
  const bg = isDark ? primary : LIGHT_BG

  // 4.5:1 is the WCAG AA floor for body text; the accent carries the outline
  // button label and the contact icons, so it has to clear it.
  const brand = ensureAccentContrast(rawAccent, bg, 4.5)

  const fgRgb: Rgb = isDark ? { r: 255, g: 255, b: 255 } : { r: 16, g: 16, b: 20 }

  return {
    bg: toCss(bg),
    fg: toCss(fgRgb),
    fg2: rgba(fgRgb, isDark ? 0.62 : 0.66),
    fg3: rgba(fgRgb, isDark ? 0.4 : 0.45),
    hair: rgba(fgRgb, isDark ? 0.13 : 0.14),
    brand: toCss(brand),

    // Transparent -> 55% bg -> solid bg, so the name lands on solid ground
    // rather than on the photo.
    heroFade: `linear-gradient(to bottom, ${rgba(bg, 0)} 0%, ${rgba(bg, 0.55)} 45%, ${toCss(bg)} 100%)`,

    // Built from the RAW accent, not the contrast-corrected one: this is a
    // large decorative field, and the correction exists for small text and
    // icons. Correcting it here turned a white brand into a grey wash.
    monogramBg: `radial-gradient(120% 90% at 50% 15%, ${toCss(rawAccent)} 0%, ${toCss(mix(rawAccent, bg, 0.35))} 45%, ${toCss(bg)} 100%)`,

    // The initials sit at the radial's centre, i.e. on top of the raw accent
    // at full strength — so their colour follows that, not the page
    // foreground. Using --fg (as the spec's demo does) washes the initials out
    // on any light or mid-tone brand colour: verified illegible against
    // #F59608 and against a white accent in both modes.
    monogramFg: luminance(rawAccent) > 0.5 ? '#101014' : '#FFFFFF',

    ctaFill: `linear-gradient(180deg, ${toCss(mix(brand, { r: 255, g: 255, b: 255 }, 0.88))} 0%, ${toCss(brand)} 100%)`,
    ctaGlow: `0 0 26px -4px ${rgba(brand, 0.65)}`,

    onBrand: luminance(brand) > 0.55 ? '#101014' : '#FFFFFF',
  }
}

/** Initials for the monogram fallback: first + last, max two characters. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
