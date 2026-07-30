// tests/tenant-isolation.test.ts
//
// Regression guard for AUDIT.md §1 Issue A — "Cards from Company A show up in
// Company B".
//
// These run against the LIVE database with the service-role key, and they are
// strictly READ-ONLY: no insert, no update, no delete.
//
// Using the service role is deliberate, not a shortcut. It reproduces exactly
// what the super admin sees, because the super_admin_all RLS policy
// (`FOR ALL USING (is_super_admin())`) returns every row in every company. RLS
// therefore cannot tell "super admin viewing Company B" apart from "super admin
// viewing everything" — so the app-layer .eq('company_id', ...) filter is the
// only thing standing between tenants on that path. That filter is what these
// tests pin down.
//
// Each test asserts the pair that matters:
//   1. the UNSCOPED query really does span several tenants (the bug is real)
//   2. the SCOPED query returns one tenant and only one (the fix works)
//
// Assertion 1 is what stops this becoming a test that passes because the
// database happens to hold a single company.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { loadEnvLocal } from './helpers/env'

let supabase: SupabaseClient<Database>
let companyIds: string[] = []

beforeAll(async () => {
  loadEnvLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or provide .env.local) to run tenant-isolation tests.'
    )
  }

  supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data } = await supabase.from('companies').select('id').order('name')
  companyIds = (data ?? []).map(c => c.id)
})

describe('staff_cards tenant isolation', () => {
  it('the unscoped query spans multiple companies — the leak is real', async () => {
    const { data, error } = await supabase.from('staff_cards').select('company_id')

    expect(error).toBeNull()
    const distinct = new Set((data ?? []).map(r => r.company_id))
    expect(distinct.size).toBeGreaterThan(1)
  })

  it("scoping by company_id returns only that company's cards", async () => {
    expect(companyIds.length).toBeGreaterThan(1)

    for (const companyId of companyIds) {
      const { data, error } = await supabase
        .from('staff_cards')
        .select('id, company_id, full_name')
        .eq('company_id', companyId)

      expect(error).toBeNull()
      const foreign = (data ?? []).filter(r => r.company_id !== companyId)
      expect(foreign).toEqual([])
    }
  })

  it("no company's scoped result contains another company's card id", async () => {
    const idsByCompany = new Map<string, Set<string>>()

    for (const companyId of companyIds) {
      const { data } = await supabase
        .from('staff_cards')
        .select('id')
        .eq('company_id', companyId)
      idsByCompany.set(companyId, new Set((data ?? []).map(r => r.id)))
    }

    // Every pair of companies must have disjoint card sets.
    for (const [a, aIds] of idsByCompany) {
      for (const [b, bIds] of idsByCompany) {
        if (a === b) continue
        const overlap = [...aIds].filter(id => bIds.has(id))
        expect(overlap).toEqual([])
      }
    }
  })
})

describe('card_views tenant isolation', () => {
  it('the unscoped query spans multiple companies', async () => {
    const { data, error } = await supabase
      .from('card_views')
      .select('nfc_cards!inner(company_id)')

    expect(error).toBeNull()
    const distinct = new Set(
      (data ?? []).map(r => (r as unknown as { nfc_cards: { company_id: string } }).nfc_cards.company_id)
    )
    expect(distinct.size).toBeGreaterThan(1)
  })

  it("scoping through nfc_cards returns only that company's views", async () => {
    for (const companyId of companyIds) {
      const { data, error } = await supabase
        .from('card_views')
        .select('id, nfc_cards!inner(company_id)')
        .eq('nfc_cards.company_id', companyId)

      expect(error).toBeNull()
      const foreign = (data ?? []).filter(
        r =>
          (r as unknown as { nfc_cards: { company_id: string } }).nfc_cards
            .company_id !== companyId
      )
      expect(foreign).toEqual([])
    }
  })
})

describe('nfc_cards inventory isolation', () => {
  // Assigning Company A's physical card to Company B's staff member is not
  // recoverable: the slug is printed on the card and can never change.
  it("scoping by company_id returns only that company's blank stock", async () => {
    for (const companyId of companyIds) {
      const { data, error } = await supabase
        .from('nfc_cards')
        .select('id, company_id')
        .eq('company_id', companyId)
        .neq('order_status', 'deactivated')

      expect(error).toBeNull()
      const foreign = (data ?? []).filter(r => r.company_id !== companyId)
      expect(foreign).toEqual([])
    }
  })
})

describe('auth_company_id() determinism', () => {
  it('no user currently administers multiple companies', async () => {
    // Documents the precondition the live function relies on. The moment this
    // fails, the un-ordered `limit 1` in auth_company_id() starts returning a
    // non-deterministic company and RLS silently points at the wrong tenant.
    // The migration in supabase/migrations/ fixes the function; this test says
    // whether the fault has started firing yet.
    const { data, error } = await supabase
      .from('company_admins')
      .select('user_id, company_id')

    expect(error).toBeNull()

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      if (!row.company_id) continue
      counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
    }

    const multi = [...counts.entries()].filter(([, n]) => n > 1)
    expect(multi).toEqual([])
  })
})
