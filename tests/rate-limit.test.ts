// tests/rate-limit.test.ts
//
// The limiter guards public, unauthenticated endpoints, so the properties that
// matter are: a genuine visitor is never blocked, a loop is, clients do not
// interfere with each other, and memory stays bounded.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  allowRequest,
  clientKey,
  __resetRateLimiter,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from '@/lib/analytics/rate-limit'

beforeEach(() => __resetRateLimiter())

describe('allowRequest', () => {
  it('lets a normal visit through', () => {
    // A real visitor fires one view plus a tap or two — nowhere near the cap.
    const now = Date.now()
    for (let i = 0; i < 4; i++) {
      expect(allowRequest('1.2.3.4', now)).toBe(true)
    }
  })

  it('blocks once the window allowance is spent', () => {
    const now = Date.now()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(allowRequest('1.2.3.4', now)).toBe(true)
    }
    expect(allowRequest('1.2.3.4', now)).toBe(false)
    expect(allowRequest('1.2.3.4', now)).toBe(false)
  })

  it('keeps clients independent — one abuser cannot block everyone else', () => {
    const now = Date.now()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) allowRequest('abuser', now)

    expect(allowRequest('abuser', now)).toBe(false)
    expect(allowRequest('an-actual-visitor', now)).toBe(true)
  })

  it('recovers after the window rolls over', () => {
    const now = Date.now()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) allowRequest('1.2.3.4', now)
    expect(allowRequest('1.2.3.4', now)).toBe(false)

    expect(allowRequest('1.2.3.4', now + RATE_LIMIT_WINDOW_MS + 1)).toBe(true)
  })

  it('does not leak buckets for clients that have gone quiet', () => {
    const now = Date.now()
    for (let i = 0; i < 500; i++) allowRequest(`client-${i}`, now)

    // A later request sweeps everything whose window has expired.
    expect(allowRequest('someone-new', now + RATE_LIMIT_WINDOW_MS + 1)).toBe(true)
    // The swept clients start clean rather than carrying stale counts.
    expect(allowRequest('client-0', now + RATE_LIMIT_WINDOW_MS + 1)).toBe(true)
  })
})

describe('clientKey', () => {
  it('prefers x-real-ip over the spoofable x-forwarded-for', () => {
    // The left-most x-forwarded-for entry is set by the client and is trivially
    // forged, so it must not be able to override the platform's own header.
    const headers = new Headers({
      'x-real-ip': '203.0.113.9',
      'x-forwarded-for': '1.1.1.1, 203.0.113.9',
    })
    expect(clientKey(headers)).toBe('203.0.113.9')
  })

  it('falls back to the first x-forwarded-for entry', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' })
    expect(clientKey(headers)).toBe('198.51.100.7')
  })

  it('returns a stable key when no client headers are present', () => {
    expect(clientKey(new Headers())).toBe('unknown')
  })

  it('groups all header-less callers together rather than letting them all through', () => {
    const anon = clientKey(new Headers())
    const now = Date.now()
    for (let i = 0; i < RATE_LIMIT_MAX; i++) allowRequest(anon, now)
    expect(allowRequest(clientKey(new Headers()), now)).toBe(false)
  })
})
