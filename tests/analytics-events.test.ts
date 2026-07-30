// tests/analytics-events.test.ts
//
// Guards the card_views write path. Fully mocked — writes never reach the
// live database.
//
// The behaviour under test is the one that was silently losing conversions:
// a visitor who taps WhatsApp before the view-event INSERT has landed. The old
// handlers ran a bare UPDATE, matched zero rows, and dropped the click with no
// error anywhere.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- supabaseAdmin mock -----------------------------------------------------
// Records every insert/update so the tests can assert on what was written.

interface Recorded {
  inserts: Record<string, unknown>[]
  updates: { values: Record<string, unknown>; id: string }[]
}

const recorded: Recorded = { inserts: [], updates: [] }
let existingViewRow: { id: string } | null = null
let nfcCardRow: { id: string } | null = { id: 'nfc-1' }
let staffCardRow: { id: string } | null = { id: 'staff-1' }

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder

  // Filter/ordering methods all return the builder for chaining.
  for (const m of ['select', 'eq', 'gte', 'order', 'limit', 'neq', 'is', 'not']) {
    builder[m] = vi.fn(chain)
  }

  builder.maybeSingle = vi.fn(async () => {
    if (table === 'card_views') return { data: existingViewRow, error: null }
    if (table === 'nfc_cards') return { data: nfcCardRow, error: null }
    if (table === 'staff_cards') return { data: staffCardRow, error: null }
    return { data: null, error: null }
  })

  builder.insert = vi.fn(async (values: Record<string, unknown>) => {
    recorded.inserts.push(values)
    return { data: null, error: null }
  })

  builder.update = vi.fn((values: Record<string, unknown>) => ({
    eq: vi.fn(async (_col: string, id: string) => {
      recorded.updates.push({ values, id })
      return { data: null, error: null }
    }),
  }))

  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: vi.fn((table: string) => makeBuilder(table)) },
}))

const { recordInteraction, readGeo, verifyStaffCardBelongsToNfcCard, nfcCardExists } =
  await import('@/lib/analytics/card-events')

beforeEach(() => {
  recorded.inserts = []
  recorded.updates = []
  existingViewRow = null
  nfcCardRow = { id: 'nfc-1' }
  staffCardRow = { id: 'staff-1' }
})

describe('recordInteraction', () => {
  const base = {
    nfcCardId: 'nfc-1',
    sessionId: 'sess-1',
    staffCardId: 'staff-1',
    geo: { city: 'Gqeberha', country: 'ZA' },
  } as const

  it('updates the existing view when one is already there', async () => {
    existingViewRow = { id: 'view-42' }

    await recordInteraction({ ...base, flag: 'wa_clicked' })

    expect(recorded.updates).toEqual([
      { values: { wa_clicked: true }, id: 'view-42' },
    ])
    expect(recorded.inserts).toEqual([])
  })

  it('creates the view when the tap beat the view event — the dropped-click bug', async () => {
    existingViewRow = null

    await recordInteraction({ ...base, flag: 'wa_clicked' })

    expect(recorded.updates).toEqual([])
    expect(recorded.inserts).toHaveLength(1)
    expect(recorded.inserts[0]).toMatchObject({
      nfc_card_id: 'nfc-1',
      staff_card_id: 'staff-1',
      session_id: 'sess-1',
      wa_clicked: true,
      city: 'Gqeberha',
      country: 'ZA',
    })
  })

  it.each(['wa_clicked', 'vcf_downloaded', 'cta_clicked'] as const)(
    'records %s on both the update and the insert path',
    async flag => {
      existingViewRow = { id: 'view-7' }
      await recordInteraction({ ...base, flag })
      expect(recorded.updates[0].values).toEqual({ [flag]: true })

      recorded.updates = []
      existingViewRow = null
      await recordInteraction({ ...base, flag })
      expect(recorded.inserts[0]).toMatchObject({ [flag]: true })
    }
  )

  it('never throws — analytics must not be able to break a card page', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    vi.mocked(supabaseAdmin.from).mockImplementationOnce(() => {
      throw new Error('database on fire')
    })

    await expect(
      recordInteraction({ ...base, flag: 'wa_clicked' })
    ).resolves.toBeUndefined()
  })
})

describe('readGeo', () => {
  it('reads the Vercel headers the platform actually sends', () => {
    const headers = new Headers({
      'x-vercel-ip-city': 'Ballito',
      'x-vercel-ip-country': 'za',
    })
    expect(readGeo(headers)).toEqual({ city: 'Ballito', country: 'ZA' })
  })

  it('decodes percent-encoded city names', () => {
    const headers = new Headers({ 'x-vercel-ip-city': 'Port%20Elizabeth' })
    expect(readGeo(headers).city).toBe('Port Elizabeth')
  })

  it('falls back to Cloudflare headers', () => {
    const headers = new Headers({ 'cf-ipcity': 'Durban', 'cf-ipcountry': 'ZA' })
    expect(readGeo(headers)).toEqual({ city: 'Durban', country: 'ZA' })
  })

  it('defaults country to ZA and city to null when nothing is present', () => {
    // The old code read cf-ipcity on a Vercel deployment, so city was always
    // null in production: 0 of 145 live rows carry one.
    expect(readGeo(new Headers())).toEqual({ city: null, country: 'ZA' })
  })

  it('survives a malformed percent-encoding', () => {
    const headers = new Headers({ 'x-vercel-ip-city': '%E0%A4%A' })
    expect(() => readGeo(headers)).not.toThrow()
  })
})

describe('view-event input validation', () => {
  it('rejects a staff_card that does not belong to the nfc_card', async () => {
    staffCardRow = null // the join filter matched nothing
    expect(await verifyStaffCardBelongsToNfcCard('nfc-1', 'staff-from-rival')).toBeNull()
  })

  it('accepts a genuine pair', async () => {
    staffCardRow = { id: 'staff-1' }
    expect(await verifyStaffCardBelongsToNfcCard('nfc-1', 'staff-1')).toBe('staff-1')
  })

  it.each([null, undefined, 42, '', {}])(
    'rejects the non-string staff_card_id %p without querying',
    async value => {
      expect(await verifyStaffCardBelongsToNfcCard('nfc-1', value)).toBeNull()
    }
  )

  it('rejects an unknown nfc_card_id', async () => {
    nfcCardRow = null
    expect(await nfcCardExists('does-not-exist')).toBe(false)
  })

  it.each([null, undefined, 42, ''])(
    'rejects the non-string nfc_card_id %p',
    async value => {
      expect(await nfcCardExists(value)).toBe(false)
    }
  )
})
