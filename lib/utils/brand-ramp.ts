// lib/utils/brand-ramp.ts
//
// Turns a company's single brand hex into a full 50–950 colour ramp, so a
// white-labelled dashboard can be reskinned without touching a single class
// name.
//
// WHY A RAMP AND NOT A FIND-AND-REPLACE
//
// The dashboard uses 226 hard-coded `teal-*` utilities across twenty files.
// Rewriting those by hand is exactly the change most likely to shift a
// padding or drop a hover state — and the brief was explicitly that layout and
// functionality must not change. Instead, tailwind.config maps the `teal`
// palette onto CSS custom properties, :root holds Tailwind's real teal values,
// and the dashboard shell overrides those variables with the company's ramp.
// Every existing `bg-teal-600`, `text-teal-700` and `ring-teal-400/50` then
// re-colours itself, opacity modifiers included, with no markup change at all.
//
// Scoping to the shell matters: Tapley's own admin panel uses teal 92 times and
// the login page 38. Those sit outside the dashboard element, inherit the
// :root defaults, and stay Tapley teal.
//
// CONTRAST
//
// The 600 step carries most of the weight — it is both a button fill behind
// white text and body text on white. A client picking a pale yellow would make
// both illegible, so the ramp is anchored on a version of their colour nudged
// until it clears 4.5:1 against white. Their hue survives; the unreadable
// lightness does not.

import {
  ensureAccentContrast,
  mix,
  parseHex,
  type Rgb,
} from '@/lib/utils/card-theme'

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/** Tailwind's own teal, the default when a company has set no brand colour. */
export const DEFAULT_BRAND_RAMP: Record<string, string> = {
  '50': '240 253 250',
  '100': '204 251 241',
  '200': '153 246 228',
  '300': '94 234 212',
  '400': '45 212 191',
  '500': '20 184 166',
  '600': '13 148 136',
  '700': '15 118 110',
  '800': '17 94 89',
  '900': '19 78 74',
  '950': '4 47 46',
}

// How far each step sits from the anchor. Positive mixes toward white,
// negative toward black. Chosen so the resulting spread matches Tailwind's own
// perceptual spacing closely enough that existing designs keep their weight.
const STEPS: Array<[string, number]> = [
  ['50', 0.95],
  ['100', 0.88],
  ['200', 0.75],
  ['300', 0.58],
  ['400', 0.34],
  ['500', 0.15],
  ['600', 0],
  ['700', -0.18],
  ['800', -0.34],
  ['900', -0.48],
  ['950', -0.68],
]

/** WCAG AA for normal text. The 600 step is used as text on white. */
const MIN_CONTRAST_ON_WHITE = 4.5

/**
 * Builds a 50–950 ramp from one hex, as space-separated RGB triples ready for
 * `rgb(var(--brand-600) / <alpha-value>)`.
 *
 * Returns the Tapley default when the input is missing or malformed, so a
 * half-configured company never renders an unreadable dashboard.
 */
export function buildBrandRamp(
  hex: string | null | undefined
): Record<string, string> {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) return DEFAULT_BRAND_RAMP

  const raw = parseHex(hex, '#0d9488')
  const anchor = ensureAccentContrast(raw, WHITE, MIN_CONTRAST_ON_WHITE)

  const ramp: Record<string, string> = {}
  for (const [step, amount] of STEPS) {
    // mix(a, b, t) weights `a` by t, so pass the anchor as `b` and blend the
    // target in by (1 - t).
    const colour =
      amount === 0
        ? anchor
        : amount > 0
          ? mix(WHITE, anchor, amount)
          : mix(BLACK, anchor, -amount)
    ramp[step] = `${colour.r} ${colour.g} ${colour.b}`
  }
  return ramp
}

/**
 * The ramp as inline CSS custom properties for the dashboard shell.
 *
 * Returned as a plain object so it can be spread into a React `style` prop —
 * no dangerouslySetInnerHTML, and nothing from the database reaches a style
 * sheet as raw text.
 */
export function brandRampStyle(
  hex: string | null | undefined
): Record<string, string> {
  const ramp = buildBrandRamp(hex)
  const style: Record<string, string> = {}
  for (const [step, value] of Object.entries(ramp)) {
    style[`--brand-${step}`] = value
  }

  // The page's mesh background tints itself too, otherwise a navy-branded
  // dashboard sits on Tapley's mint wash and the reskin stops halfway.
  // Untouched when there is no brand colour, so Tapley's own pages keep their
  // exact background.
  if (/^#[0-9a-f]{6}$/i.test(hex ?? '')) {
    style['--mesh-accent'] = ramp['500']
  }
  return style
}
