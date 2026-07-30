// tests/crop.test.ts
//
// The cropper's geometry is the part that fails silently: a wrong source rect
// produces a plausible-looking image that is subtly mis-framed, and nobody
// notices until it is printed on a card.
//
// The invariant that matters: the crop rect must never fall outside the source
// image. If it does, canvas fills the overflow with transparent black and the
// saved photo gets a hard edge.

import { describe, it, expect } from 'vitest'
import {
  CROP_ASPECT,
  centreOffset,
  clampOffset,
  coverScale,
  checkSourceResolution,
  toSourceRect,
  type Size,
} from '@/lib/utils/crop'

const FRAME: Size = { width: 320, height: 400 } // 4:5

const LANDSCAPE: Size = { width: 4000, height: 3000 }
const PORTRAIT: Size = { width: 3000, height: 4000 }
const SQUARE: Size = { width: 2000, height: 2000 }
const TINY: Size = { width: 100, height: 80 }

describe('CROP_ASPECT', () => {
  it('is 4:5 and matches the frame used by the UI', () => {
    expect(CROP_ASPECT).toBeCloseTo(0.8)
    expect(FRAME.width / FRAME.height).toBeCloseTo(CROP_ASPECT)
  })
})

describe('coverScale', () => {
  it.each([
    ['landscape', LANDSCAPE],
    ['portrait', PORTRAIT],
    ['square', SQUARE],
    ['smaller than the frame', TINY],
  ])('makes a %s image cover the frame exactly or more', (_label, natural) => {
    const s = coverScale(natural, FRAME)
    expect(natural.width * s).toBeGreaterThanOrEqual(FRAME.width - 0.001)
    expect(natural.height * s).toBeGreaterThanOrEqual(FRAME.height - 0.001)
  })

  it('scales a small image UP so it still covers', () => {
    // The old resizePhoto only ever scaled down, so a small landscape photo
    // would have been letterboxed in a full-bleed hero.
    expect(coverScale(TINY, FRAME)).toBeGreaterThan(1)
  })

  it('does not divide by zero on a degenerate image', () => {
    expect(coverScale({ width: 0, height: 0 }, FRAME)).toBe(1)
  })
})

describe('clampOffset', () => {
  it.each([
    ['landscape', LANDSCAPE],
    ['portrait', PORTRAIT],
    ['square', SQUARE],
  ])('never lets a %s image expose a blank edge, however hard you drag', (_l, natural) => {
    const scale = coverScale(natural, FRAME)

    for (const attempt of [
      { x: 9999, y: 9999 },
      { x: -9999, y: -9999 },
      { x: 9999, y: -9999 },
      { x: -9999, y: 9999 },
      { x: 0, y: 0 },
    ]) {
      const o = clampOffset(attempt, natural, FRAME, scale)
      const dw = natural.width * scale
      const dh = natural.height * scale

      // Top-left never moves past the frame's top-left...
      expect(o.x).toBeLessThanOrEqual(0)
      expect(o.y).toBeLessThanOrEqual(0)
      // ...and the bottom-right never comes inside it.
      expect(o.x + dw).toBeGreaterThanOrEqual(FRAME.width - 0.001)
      expect(o.y + dh).toBeGreaterThanOrEqual(FRAME.height - 0.001)
    }
  })
})

describe('centreOffset', () => {
  it('centres a landscape image horizontally with no vertical slack', () => {
    const scale = coverScale(LANDSCAPE, FRAME)
    const o = centreOffset(LANDSCAPE, FRAME, scale)
    // 4000x3000 covering 320x400 is limited by height, so it overflows sideways.
    expect(o.x).toBeLessThan(0)
    expect(o.y).toBeCloseTo(0)
  })

  it('centres a portrait image vertically with no horizontal slack', () => {
    const scale = coverScale(PORTRAIT, FRAME)
    const o = centreOffset(PORTRAIT, FRAME, scale)
    expect(o.x).toBeCloseTo(0)
    expect(o.y).toBeLessThan(0)
  })
})

describe('toSourceRect', () => {
  it.each([
    ['landscape', LANDSCAPE],
    ['portrait', PORTRAIT],
    ['square', SQUARE],
    ['tiny', TINY],
  ])('keeps the crop rect inside a %s source at every zoom level', (_l, natural) => {
    const base = coverScale(natural, FRAME)

    for (const zoom of [1, 1.25, 2, 3, 4]) {
      const scale = base * zoom
      for (const attempt of [
        { x: 9999, y: 9999 },
        { x: -9999, y: -9999 },
        centreOffset(natural, FRAME, scale),
      ]) {
        const offset = clampOffset(attempt, natural, FRAME, scale)
        const { sx, sy, sw, sh } = toSourceRect(offset, FRAME, scale)

        expect(sx).toBeGreaterThanOrEqual(-0.001)
        expect(sy).toBeGreaterThanOrEqual(-0.001)
        expect(sx + sw).toBeLessThanOrEqual(natural.width + 0.001)
        expect(sy + sh).toBeLessThanOrEqual(natural.height + 0.001)
      }
    }
  })

  it('always produces a 4:5 source rect, so the output is never stretched', () => {
    for (const natural of [LANDSCAPE, PORTRAIT, SQUARE, TINY]) {
      const scale = coverScale(natural, FRAME)
      const offset = centreOffset(natural, FRAME, scale)
      const { sw, sh } = toSourceRect(offset, FRAME, scale)
      expect(sw / sh).toBeCloseTo(CROP_ASPECT, 5)
    }
  })

  it('zooming in selects a strictly smaller region of the source', () => {
    const base = coverScale(PORTRAIT, FRAME)
    const at = (zoom: number) => {
      const scale = base * zoom
      const offset = clampOffset(
        centreOffset(PORTRAIT, FRAME, scale),
        PORTRAIT,
        FRAME,
        scale
      )
      return toSourceRect(offset, FRAME, scale)
    }
    expect(at(2).sw).toBeLessThan(at(1).sw)
    expect(at(4).sw).toBeLessThan(at(2).sw)
  })

  it('a landscape photo is cropped to portrait rather than squashed', () => {
    // This is the whole point of the change: resizePhoto preserved the source
    // aspect, so a 4000x3000 photo went into a full-bleed 4:5 hero and got
    // cropped through the subject's face by object-fit instead of by choice.
    const scale = coverScale(LANDSCAPE, FRAME)
    const offset = centreOffset(LANDSCAPE, FRAME, scale)
    const { sw, sh } = toSourceRect(offset, FRAME, scale)

    expect(sh).toBeCloseTo(LANDSCAPE.height, 0) // full height used
    expect(sw).toBeLessThan(LANDSCAPE.width)    // sides trimmed
    expect(sw / sh).toBeCloseTo(CROP_ASPECT, 5)
  })
})

describe('checkSourceResolution', () => {
  it('accepts a normal phone photo', () => {
    // Any modern phone camera is far above the floor.
    expect(checkSourceResolution({ width: 3024, height: 4032 })).toBeNull()
    expect(checkSourceResolution({ width: 500, height: 625 })).toBeNull()
  })

  it('rejects an image that would be upscaled into a blurry hero', () => {
    // coverScale would happily blow this up to fill 56% of the card.
    const result = checkSourceResolution({ width: 200, height: 150 })
    expect(result?.reason).toBe('too-small')
    expect(result?.message).toContain('200×150')
  })

  it('rejects when only one dimension is too small', () => {
    expect(checkSourceResolution({ width: 4000, height: 300 })?.reason).toBe('too-small')
    expect(checkSourceResolution({ width: 300, height: 4000 })?.reason).toBe('too-small')
  })
})
