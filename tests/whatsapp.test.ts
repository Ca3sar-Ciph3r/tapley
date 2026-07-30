// tests/whatsapp.test.ts
//
// The WhatsApp button is the card's primary call to action. A malformed number
// renders a perfect-looking button that opens to nothing — invisible to whoever
// caused it, and invisible to the person who tapped the card.

import { describe, it, expect } from 'vitest'
import {
  normalisePhoneNumber,
  isValidPhoneNumber,
  buildWaLink,
  getFirstName,
} from '@/lib/utils/whatsapp'

describe('normalisePhoneNumber', () => {
  it.each([
    ['0821234567', '+27821234567'],
    ['082 123 4567', '+27821234567'],
    ['082-123-4567', '+27821234567'],
    ['27821234567', '+27821234567'],
    ['+27821234567', '+27821234567'],
    ['(082) 123 4567', '+27821234567'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhoneNumber(input)).toBe(expected)
  })
})

describe('isValidPhoneNumber', () => {
  it('accepts a normalised SA mobile', () => {
    expect(isValidPhoneNumber('+27821234567')).toBe(true)
    expect(isValidPhoneNumber(normalisePhoneNumber('082 123 4567'))).toBe(true)
  })

  it('rejects the empty-string case that produced a bare "+"', () => {
    // normalisePhoneNumber is pure string surgery: '' -> '+', which built the
    // link https://wa.me/?text=... — a button that opens to nothing.
    expect(normalisePhoneNumber('')).toBe('+')
    expect(isValidPhoneNumber('+')).toBe(false)
  })

  it('rejects junk that survives normalisation', () => {
    expect(isValidPhoneNumber(normalisePhoneNumber('call me'))).toBe(false)
    expect(isValidPhoneNumber(normalisePhoneNumber('123'))).toBe(false)
  })

  it('rejects an SA number of the wrong length', () => {
    expect(isValidPhoneNumber('+2782123456')).toBe(false)   // one short
    expect(isValidPhoneNumber('+278212345678')).toBe(false) // one long
  })

  it('accepts a plausible non-SA number — staff may not be local', () => {
    expect(isValidPhoneNumber('+442071234567')).toBe(true)
    expect(isValidPhoneNumber('+15551234567')).toBe(true)
  })

  it.each([null, undefined, ''])('rejects %p', input => {
    expect(isValidPhoneNumber(input)).toBe(false)
  })
})

describe('buildWaLink', () => {
  it('strips the + and encodes the greeting', () => {
    const link = buildWaLink('+27821234567', 'Sifiso')
    expect(link.startsWith('https://wa.me/27821234567?text=')).toBe(true)
    expect(decodeURIComponent(link)).toContain('Hi Sifiso')
  })
})

describe('getFirstName', () => {
  it.each([
    ['Sifiso Radebe', 'Sifiso'],
    ['Craig', 'Craig'],
    ['Nomvula Ramaphosa-Van Der Merwe', 'Nomvula'],
  ])('%s -> %s', (input, expected) => {
    expect(getFirstName(input)).toBe(expected)
  })
})
