'use server'

// lib/actions/bulk-import.ts
//
// Server action for bulk staff card insertion.
//
// The client parses and validates the CSV (lib/utils/csv.ts), filters out
// invalid rows, and sends only the clean rows here. This action is the
// authoritative second layer:
//   1. Verifies auth + company membership
//   2. Enforces the max_staff_cards plan limit
//   3. De-duplicates against existing staff emails for this company
//   4. Batch-inserts the valid rows
//
// Returns a per-row result so the UI can show exactly what happened.

import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportRow = {
  full_name: string
  job_title: string
  department: string | null
  email: string | null
  /** E.164 format (+27...) or null */
  phone: string | null
  /** E.164 format (+27...) or null */
  whatsapp_number: string | null
}

export type ImportResult = {
  created: number
  skipped: number
  /** Rows that failed on insert (edge cases — should be rare after client validation) */
  errors: Array<{ name: string; reason: string }>
  /** True when the row count was capped by the max_staff_cards plan limit */
  cappedByPlanLimit: boolean
  cappedCount: number
}

// ---------------------------------------------------------------------------
// bulkImportStaffCards
// ---------------------------------------------------------------------------

export async function bulkImportStaffCards(
  rows: ImportRow[]
): Promise<{ result?: ImportResult; error?: string }> {
  if (rows.length === 0) return { result: { created: 0, skipped: 0, errors: [], cappedByPlanLimit: false, cappedCount: 0 } }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorised' }

  // --- Resolve company ---
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord?.company_id) {
    return { error: 'No company found for this account.' }
  }

  const companyId = adminRecord.company_id

  // --- Enforce max_staff_cards plan limit ---
  const [companyResult, countResult] = await Promise.all([
    supabase
      .from('companies')
      .select('max_staff_cards')
      .eq('id', companyId)
      .single(),
    supabase
      .from('staff_cards')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_active', true),
  ])

  const maxCards = companyResult.data?.max_staff_cards ?? 10
  const currentActive = countResult.count ?? 0
  const slotsAvailable = Math.max(0, maxCards - currentActive)

  let cappedByPlanLimit = false
  let cappedCount = 0
  let rowsToProcess = rows

  if (rows.length > slotsAvailable) {
    cappedByPlanLimit = true
    cappedCount = rows.length - slotsAvailable
    rowsToProcess = rows.slice(0, slotsAvailable)
  }

  // --- Fetch existing emails to deduplicate ---
  const { data: existingCards } = await supabase
    .from('staff_cards')
    .select('email')
    .eq('company_id', companyId)
    .not('email', 'is', null)

  const existingEmails = new Set<string>(
    (existingCards ?? [])
      .map(c => c.email?.toLowerCase())
      .filter((e): e is string => Boolean(e))
  )

  // --- Insert rows ---
  let created = 0
  let skipped = cappedCount  // rows cut by the plan limit are counted as skipped
  const errors: ImportResult['errors'] = []

  for (const row of rowsToProcess) {
    // Skip if this email already exists for this company
    if (row.email && existingEmails.has(row.email.toLowerCase())) {
      skipped++
      continue
    }

    const { error: insertError } = await supabase
      .from('staff_cards')
      .insert({
        company_id: companyId,
        full_name: row.full_name.trim(),
        job_title: row.job_title.trim(),
        department: row.department?.trim() || null,
        email: row.email?.trim() || null,
        phone: row.phone || null,
        whatsapp_number: row.whatsapp_number || null,
      })

    if (insertError) {
      errors.push({ name: row.full_name, reason: insertError.message })
    } else {
      created++
      // Track to prevent duplicate inserts within this batch
      if (row.email) existingEmails.add(row.email.toLowerCase())
    }
  }

  return {
    result: {
      created,
      skipped,
      errors,
      cappedByPlanLimit,
      cappedCount,
    },
  }
}
