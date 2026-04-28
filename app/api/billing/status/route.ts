// app/api/billing/status/route.ts
//
// GET /api/billing/status?company_id=[uuid]
//
// Returns the subscription_status for the given company.
// Used by /onboard/success to poll until status = 'active'.
//
// Security:
//   - Only returns the status string, no other company data
//   - Uses supabaseAdmin since the user may not have a session yet
//     (PayFast redirects them directly to this page after payment)
//   - company_id validated as UUID format before querying
//
// Always returns 200 — callers treat { status: 'unknown' } as "keep polling".

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }            from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest): Promise<NextResponse> {
  const companyId = req.nextUrl.searchParams.get('company_id')

  if (!companyId || !UUID_RE.test(companyId)) {
    return NextResponse.json({ status: 'unknown' })
  }

  try {
    const { data } = await (supabaseAdmin as unknown as {
      from(t: 'companies'): {
        select(cols: string): {
          eq(col: string, val: string): {
            single(): Promise<{ data: { subscription_status: string } | null; error: unknown }>
          }
        }
      }
    })
      .from('companies')
      .select('subscription_status')
      .eq('id', companyId)
      .single()

    return NextResponse.json({ status: data?.subscription_status ?? 'unknown' })
  } catch {
    return NextResponse.json({ status: 'unknown' })
  }
}
