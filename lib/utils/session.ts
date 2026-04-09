// lib/utils/session.ts
//
// Client-side session ID management.
// Used by ViewEventTracker and CardActions for view-event dedup and tracking.
//
// Session ID format: "{timestamp}-{random}" — unique per browser tab session.
// Stored in sessionStorage so it resets on new tab / browser restart.
// ONLY call from client components — sessionStorage is not available server-side.

/**
 * Get the current session ID from sessionStorage, or create a new one.
 * Safe to call multiple times — always returns the same ID for the current tab session.
 */
export function getOrCreateSessionId(): string {
  const KEY = 'tc_session'
  const existing = sessionStorage.getItem(KEY)
  if (existing) return existing
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  sessionStorage.setItem(KEY, id)
  return id
}
