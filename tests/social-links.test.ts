// tests/social-links.test.ts
//
// staff_cards.social_links is jsonb, so it reaches the app as untrusted Json.
// The card page and the .vcf route both interpolate the result into hrefs and
// vCard lines, so the parser must never hand back a non-string.

import { describe, it, expect } from 'vitest'
import { parseSocialLinks, hasSocialLinks } from '@/lib/utils/social-links'

describe('parseSocialLinks', () => {
  it('keeps the canonical string keys', () => {
    // Values come back WHATWG-normalised (a bare origin gains its root path),
    // because they are now run through sanitiseExternalUrl on read.
    expect(
      parseSocialLinks({
        linkedin: 'https://linkedin.com/in/x',
        website: 'https://example.co.za',
      })
    ).toEqual({
      linkedin: 'https://linkedin.com/in/x',
      website: 'https://example.co.za/',
    })
  })

  it('returns an empty object for every non-object shape', () => {
    expect(parseSocialLinks(null)).toEqual({})
    expect(parseSocialLinks('nope')).toEqual({})
    expect(parseSocialLinks(42)).toEqual({})
    expect(parseSocialLinks(true)).toEqual({})
    expect(parseSocialLinks([])).toEqual({})
    expect(parseSocialLinks(['https://x.com'])).toEqual({})
  })

  it('drops non-string values instead of trusting the cast', () => {
    // The previous implementation was `raw as SocialLinks`, which would have
    // let 42 through as a `string` and interpolated it into an href.
    expect(
      parseSocialLinks({ linkedin: 42, instagram: null, facebook: { a: 1 } })
    ).toEqual({})
  })

  it('drops unknown keys', () => {
    expect(
      parseSocialLinks({ myspace: 'https://myspace.com/x', website: 'https://y.co' })
    ).toEqual({ website: 'https://y.co/' })
  })

  it('drops blank and whitespace-only values, and trims the rest', () => {
    expect(parseSocialLinks({ website: '   ', linkedin: '  https://l.co  ' })).toEqual({
      linkedin: 'https://l.co/',
    })
  })

  it('does not mutate its input', () => {
    const input = { linkedin: 'https://l.co', myspace: 'https://m.co' }
    const snapshot = JSON.stringify(input)
    parseSocialLinks(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('hasSocialLinks', () => {
  it('is false for an empty object', () => {
    expect(hasSocialLinks({})).toBe(false)
  })

  it('is true when any link is present', () => {
    expect(hasSocialLinks({ website: 'https://x.co' })).toBe(true)
  })
})
