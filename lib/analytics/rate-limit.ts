// lib/analytics/rate-limit.ts
//
// A small in-memory limiter for the public, unauthenticated view-event
// endpoints.
//
// Phase 2 stopped FORGED events — a staff_card_id that does not belong to its
// nfc_card_id is now rejected. It did not stop VOLUME: anyone who has tapped a
// card knows a real nfc_card_id, and could sit in a loop inflating a
// competitor's view count, or a staff member could pad their own numbers.
//
// Scope and honesty about it:
//   This is per-instance memory. Vercel runs several lambda instances and
//   recycles them, so the effective limit is looser than the number below and
//   resets on cold start. That is fine for the threat here — casual inflation
//   by someone with a browser — and it costs no infrastructure. It is NOT a
//   defence against a distributed or determined attacker. If analytics
//   integrity ever needs to be guaranteed, this wants Upstash/Redis or Vercel
//   Firewall rules instead, and this module is where that swap happens.

interface Bucket {
  count: number
  resetAt: number
}

const WINDOW_MS = 60_000

/**
 * Requests allowed per key per minute. A genuine visitor fires at most a
 * handful: one view, plus a tap on WhatsApp, Save Contact and a custom CTA.
 */
const MAX_PER_WINDOW = 20

/** Beyond this many tracked keys, drop the oldest — bounds memory. */
const MAX_KEYS = 10_000

const buckets = new Map<string, Bucket>()

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
  if (buckets.size > MAX_KEYS) {
    // Map preserves insertion order, so the oldest keys come first.
    const excess = buckets.size - MAX_KEYS
    let removed = 0
    for (const key of buckets.keys()) {
      buckets.delete(key)
      if (++removed >= excess) break
    }
  }
}

/**
 * Identify the caller. Prefers the platform's real-client-IP headers over
 * x-forwarded-for, whose left-most entry is client-controlled and trivially
 * spoofed.
 */
export function clientKey(headers: Headers): string {
  const direct =
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-vercel-forwarded-for')

  if (direct) return direct.trim()

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}

/**
 * Consume one unit of the caller's allowance.
 * Returns false when they are over the limit and the event should be dropped.
 */
export function allowRequest(key: string, now: number = Date.now()): boolean {
  sweep(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (bucket.count >= MAX_PER_WINDOW) return false

  bucket.count += 1
  return true
}

/** Test hook — the limiter is module-level state. */
export function __resetRateLimiter(): void {
  buckets.clear()
}

export const RATE_LIMIT_WINDOW_MS = WINDOW_MS
export const RATE_LIMIT_MAX = MAX_PER_WINDOW
