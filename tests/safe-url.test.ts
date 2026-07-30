// tests/safe-url.test.ts
//
// Staff and admins type these URLs by hand and they land in an href on a public
// page that is printed on a physical card. Two things must hold: nothing
// dangerous renders, and an honest typo still works.

import { describe, it, expect } from 'vitest'
import { sanitiseExternalUrl, sanitiseUrlMap } from '@/lib/utils/safe-url'
import { parseSocialLinks } from '@/lib/utils/social-links'

describe('sanitiseExternalUrl — dangerous schemes', () => {
  // React does NOT sanitise href, so any of these reaching the card page would
  // be stored XSS on a public URL, under the client's brand on a custom domain.
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(document.cookie)',
    'jAvAsCrIpT:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejects %s', input => {
    expect(sanitiseExternalUrl(input)).toBeNull()
  })

  it('rejects a scheme smuggled past a naive check with control characters', () => {
    // Some browsers strip these before parsing, so "java\tscript:" can execute.
    expect(sanitiseExternalUrl('java\tscript:alert(1)')).toBeNull()
    expect(sanitiseExternalUrl('java\nscript:alert(1)')).toBeNull()
    expect(sanitiseExternalUrl('java\0script:alert(1)')).toBeNull()
  })

  it('does not let a protocol-relative URL through as-is', () => {
    // "//evil.com" would inherit the page protocol and silently leave the site.
    const result = sanitiseExternalUrl('//evil.com/path')
    expect(result).toBe('https://evil.com/path')
  })
})

describe('sanitiseExternalUrl — honest typos still work', () => {
  it('adds https:// when the scheme is missing', () => {
    // Without this the browser treats it as RELATIVE and the link resolves to
    // /c/<slug>/linkedin.com/in/me — a silent 404 on a perfect-looking card.
    expect(sanitiseExternalUrl('linkedin.com/in/me')).toBe('https://linkedin.com/in/me')
    expect(sanitiseExternalUrl('www.example.co.za')).toBe('https://www.example.co.za/')
  })

  it('leaves a valid https URL intact', () => {
    expect(sanitiseExternalUrl('https://www.linkedin.com/in/craig-gunn-7a615120b/')).toBe(
      'https://www.linkedin.com/in/craig-gunn-7a615120b/'
    )
  })

  it('allows plain http', () => {
    expect(sanitiseExternalUrl('http://example.co.za')).toBe('http://example.co.za/')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitiseExternalUrl('   https://example.co.za   ')).toBe('https://example.co.za/')
  })

  it.each(['', '   ', null, undefined, 42, {}, []])('returns null for %p', input => {
    expect(sanitiseExternalUrl(input)).toBeNull()
  })

  it('rejects a bare word that is not a hostname', () => {
    // "linkedin" is a typo, not a destination.
    expect(sanitiseExternalUrl('linkedin')).toBeNull()
    expect(sanitiseExternalUrl('my linkedin profile')).toBeNull()
  })
})

describe('sanitiseUrlMap', () => {
  it('keeps safe links and drops unsafe ones', () => {
    expect(
      sanitiseUrlMap({
        linkedin: 'https://linkedin.com/in/x',
        website: 'javascript:alert(1)',
        instagram: 'instagram.com/x',
      })
    ).toEqual({
      linkedin: 'https://linkedin.com/in/x',
      instagram: 'https://instagram.com/x',
    })
  })

  it('does not mutate its input', () => {
    const input = { linkedin: 'https://l.co', website: 'javascript:alert(1)' }
    const snapshot = JSON.stringify(input)
    sanitiseUrlMap(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('parseSocialLinks — read-side defence', () => {
  it('drops an unsafe URL already stored in the database', () => {
    // Both write paths now sanitise, but rows written before that guard existed
    // must not be able to render either.
    expect(
      parseSocialLinks({
        linkedin: 'javascript:alert(document.cookie)',
        website: 'https://safe.co.za',
      })
    ).toEqual({ website: 'https://safe.co.za/' })
  })

  it('repairs a stored link that is missing its scheme', () => {
    expect(parseSocialLinks({ instagram: 'instagram.com/handle' })).toEqual({
      instagram: 'https://instagram.com/handle',
    })
  })
})
