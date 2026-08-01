// tests/brand-ramp.test.ts
//
// The white-label ramp is the one place a client's own input can make the
// entire dashboard unreadable, so the guardrails are tested rather than
// assumed. A pale brand colour must not produce invisible buttons.

import {
  buildBrandRamp,
  brandRampStyle,
  DEFAULT_BRAND_RAMP,
} from '@/lib/utils/brand-ramp'
import { contrastRatio, type Rgb } from '@/lib/utils/card-theme'

const WHITE: Rgb = { r: 255, g: 255, b: 255 }

function toRgb(triple: string): Rgb {
  const [r, g, b] = triple.split(' ').map(Number)
  return { r, g, b }
}

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

describe('buildBrandRamp — shape', () => {
  test('returns every step Tailwind expects', () => {
    const ramp = buildBrandRamp('#0d9488')
    expect(Object.keys(ramp).sort()).toEqual([...STEPS].sort())
  })

  test('emits space-separated channels, not hex', () => {
    // `rgb(var(--brand-600) / <alpha-value>)` only composes alpha with this
    // form. Hex here would silently break every `teal-400/50` in the dashboard.
    for (const value of Object.values(buildBrandRamp('#b4221d'))) {
      expect(value).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
    }
  })

  test('channels stay in range for an extreme input', () => {
    for (const value of Object.values(buildBrandRamp('#ffffff'))) {
      for (const channel of value.split(' ').map(Number)) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })
})

describe('buildBrandRamp — invalid input falls back', () => {
  test.each([null, undefined, '', 'teal', '#fff', '#12345g', 'rgb(1,2,3)'])(
    '%p yields the Tapley default rather than a broken ramp',
    input => {
      expect(buildBrandRamp(input as string | null)).toEqual(DEFAULT_BRAND_RAMP)
    }
  )
})

describe('buildBrandRamp — contrast guardrail', () => {
  // 600 is both a button fill behind white text and body text on white, so it
  // carries the legibility risk for the whole dashboard.
  test.each([
    ['#ffff00', 'pure yellow'],
    ['#f5f5dc', 'beige'],
    ['#00ff00', 'bright green'],
    ['#87ceeb', 'sky blue'],
    ['#ffffff', 'white'],
  ])('%s (%s) still clears 4.5:1 at step 600', hex => {
    const ramp = buildBrandRamp(hex)
    expect(contrastRatio(toRgb(ramp['600']), WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  test('a colour that already passes is left alone', () => {
    // Protech's navy is comfortably dark; the ramp must not wash it out.
    const ramp = buildBrandRamp('#2f385d')
    expect(ramp['600']).toBe('47 56 93')
  })

  test('darker steps are darker than lighter ones', () => {
    const ramp = buildBrandRamp('#b4221d')
    const lum = (s: string) => {
      const { r, g, b } = toRgb(ramp[s])
      return r + g + b
    }
    for (let i = 1; i < STEPS.length; i++) {
      expect(lum(STEPS[i])).toBeLessThan(lum(STEPS[i - 1]))
    }
  })
})

describe('brandRampStyle', () => {
  test('produces CSS custom properties the shell can spread into style', () => {
    const style = brandRampStyle('#b4221d')
    expect(Object.keys(style)).toContain('--brand-600')
    // 11 ramp steps plus the mesh accent.
    expect(Object.keys(style)).toHaveLength(STEPS.length + 1)
    for (const key of Object.keys(style)) {
      expect(key).toMatch(/^--(brand-\d{2,3}|mesh-accent)$/)
    }
  })

  test('no brand colour yields Tapley teal, so nothing changes by default', () => {
    expect(brandRampStyle(null)['--brand-600']).toBe(DEFAULT_BRAND_RAMP['600'])
  })

  test('mesh accent is left alone without a brand colour', () => {
    // Tapley's mesh is rgb(0,201,167), not teal-500. Overriding it here would
    // shift the admin panel's background.
    expect(brandRampStyle(null)['--mesh-accent']).toBeUndefined()
  })

  test('mesh accent tints with a brand colour', () => {
    expect(brandRampStyle('#293c7f')['--mesh-accent']).toBe(buildBrandRamp('#293c7f')['500'])
  })
})
