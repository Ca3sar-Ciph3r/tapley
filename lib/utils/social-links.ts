// lib/utils/social-links.ts
//
// staff_cards.social_links is a jsonb column, so it arrives from Supabase typed
// as Json — an untrusted shape. Everything that renders it (the public card page,
// the .vcf generator) must narrow it here first rather than casting.
//
// Keys are fixed by DATABASE.md; anything else in the column is dropped.

import type { Json } from '@/lib/types/database'
import { sanitiseExternalUrl } from '@/lib/utils/safe-url'

export const SOCIAL_LINK_KEYS = [
  'linkedin',
  'instagram',
  'twitter',
  'facebook',
  'website',
  'calendly',
] as const

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

export type SocialLinks = Partial<Record<SocialLinkKey, string>>

/**
 * Narrow a raw jsonb value into the known social link shape.
 *
 * Drops unknown keys, non-string values, and anything that is not a safe
 * http(s) URL — so callers can interpolate the result into an href without
 * re-checking.
 *
 * The URL check is deliberately duplicated here even though both write paths
 * now sanitise on save: this is the read side, and it is what protects rows
 * written before that guard existed. A `javascript:` link reaching an href on
 * the public card page would be stored XSS.
 */
export function parseSocialLinks(raw: Json): SocialLinks {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  return SOCIAL_LINK_KEYS.reduce<SocialLinks>((acc, key) => {
    const value = (raw as { [k: string]: Json | undefined })[key]
    if (typeof value !== 'string') return acc

    const safe = sanitiseExternalUrl(value)
    return safe ? { ...acc, [key]: safe } : acc
  }, {})
}

export function hasSocialLinks(links: SocialLinks): boolean {
  return Object.values(links).some(Boolean)
}
