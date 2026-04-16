'use server'

// lib/actions/analytics.ts
//
// Server actions for analytics features.
// All actions require company-scoped authentication.
//
// sendMonthlyDigest — super admin manually triggers a 30-day analytics
// summary email to a company's primary contact. Automated scheduling is post-MVP.

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getResend, FROM_ADDRESS } from '@/lib/email/resend'
import { sendDay5NudgeEmail, sendDay14AnalyticsEmail } from '@/lib/email/onboarding'

// ---------------------------------------------------------------------------
// sendMonthlyDigest
//
// Sends a 30-day analytics digest to companies.primary_contact_email.
// Super admin only — manual trigger from /admin/[companyId].
//
// Queries:
//   1. Fetch the company (name + primary_contact_email)
//   2. Fetch active staff_cards for this company
//   3. Fetch card_views for last 30 days
//   4. Compute: total views, top 3 cards, month-over-month change
// ---------------------------------------------------------------------------

export async function sendMonthlyDigest(
  companyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (adminRecord?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  // Fetch company details
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name, primary_contact_email, primary_contact_name')
    .eq('id', companyId)
    .single()

  if (companyError || !company) {
    return { error: 'Company not found.' }
  }

  if (!company.primary_contact_email) {
    return { error: 'Company has no primary contact email set.' }
  }

  // Fetch active staff cards
  const { data: staffCards } = await supabaseAdmin
    .from('staff_cards')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const staffCardIds = (staffCards ?? []).map(c => c.id)

  if (staffCardIds.length === 0) {
    return { error: 'No active staff cards found for this company.' }
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch current 30-day views
  const { data: views30d } = await supabaseAdmin
    .from('card_views')
    .select('staff_card_id')
    .in('staff_card_id', staffCardIds)
    .gte('viewed_at', thirtyDaysAgo)

  // Fetch prior 30-day views (month-over-month)
  const { data: viewsPrev30d } = await supabaseAdmin
    .from('card_views')
    .select('staff_card_id')
    .in('staff_card_id', staffCardIds)
    .gte('viewed_at', sixtyDaysAgo)
    .lt('viewed_at', thirtyDaysAgo)

  const totalViews = (views30d ?? []).length
  const prevTotalViews = (viewsPrev30d ?? []).length

  const momChange =
    prevTotalViews > 0
      ? Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100)
      : null

  // Build per-card view counts
  const staffById = new Map((staffCards ?? []).map(c => [c.id, c.full_name]))
  const viewCountMap = new Map<string, number>()
  for (const v of views30d ?? []) {
    if (v.staff_card_id) {
      viewCountMap.set(v.staff_card_id, (viewCountMap.get(v.staff_card_id) ?? 0) + 1)
    }
  }

  // Top 3 cards by views
  const topCards = Array.from(viewCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, views]) => ({ name: staffById.get(id) ?? 'Unknown', views }))

  // Build email HTML
  const momLabel =
    momChange === null
      ? ''
      : momChange >= 0
      ? `<span style="color:#059669;">+${momChange}% vs last month</span>`
      : `<span style="color:#dc2626;">${momChange}% vs last month</span>`

  const topCardsHtml =
    topCards.length === 0
      ? '<p style="color:#94a3b8;">No card views recorded this month.</p>'
      : topCards
          .map(
            (c, i) =>
              `<tr>
                <td style="padding:8px 0;color:#475569;">${i + 1}.</td>
                <td style="padding:8px 0;font-weight:600;color:#0f172a;">${c.name}</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;color:#0d9488;">${c.views}</td>
              </tr>`,
          )
          .join('')

  const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    Your team made ${totalViews.toLocaleString('en-ZA')} connections this month
  </h1>
  <p style="color:#64748b; font-size:13px; margin-bottom:24px;">
    ${company.name} · ${monthLabel} ${momLabel ? `· ${momLabel}` : ''}
  </p>

  <div style="background:#f0fdf9;border-radius:12px;padding:24px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:36px;font-weight:800;color:#0f172a;">
      ${totalViews.toLocaleString('en-ZA')}
    </p>
    <p style="margin:0;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
      Total card taps — last 30 days
    </p>
  </div>

  <h2 style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:12px;">
    Top Team Members
  </h2>
  <table style="width:100%;border-collapse:collapse;">
    ${topCardsHtml}
  </table>

  <hr style="margin:40px 0;border:none;border-top:1px solid #e2e8f0;" />
  <p style="font-size:12px;color:#94a3b8;">
    Tapley Connect · Digital Business Card Platform · South Africa<br />
    You're receiving this as the admin for ${company.name}.
  </p>
</body>
</html>
`

  const { error: sendError } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: company.primary_contact_email,
    subject: `Your team made ${totalViews.toLocaleString('en-ZA')} connections this month — here's the breakdown`,
    html,
  })

  return { error: sendError?.message }
}

// ---------------------------------------------------------------------------
// sendDay5Nudge
//
// Sends the Day 5 drip email to the company's primary contact.
// Super admin only — manual trigger from /admin/[companyId].
// ---------------------------------------------------------------------------

export async function sendDay5Nudge(
  companyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if ((adminRecord as { role: string } | null)?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, primary_contact_email, primary_contact_name')
    .eq('id', companyId)
    .single()

  if (companyError || !company) return { error: 'Company not found.' }
  if (!company.primary_contact_email) return { error: 'Company has no primary contact email.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  return sendDay5NudgeEmail({
    companyName: company.name,
    adminEmail: company.primary_contact_email,
    adminName: company.primary_contact_name ?? company.name,
    analyticsUrl: `${appUrl}/dashboard/analytics`,
  })
}

// ---------------------------------------------------------------------------
// sendDay14Analytics
//
// Sends the Day 14 analytics snapshot email to the company's primary contact.
// Super admin only — manual trigger from /admin/[companyId].
// ---------------------------------------------------------------------------

export async function sendDay14Analytics(
  companyId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised' }

  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if ((adminRecord as { role: string } | null)?.role !== 'super_admin') {
    return { error: 'Access denied — super admin only.' }
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name, primary_contact_email, primary_contact_name')
    .eq('id', companyId)
    .single()

  if (companyError || !company) return { error: 'Company not found.' }
  if (!company.primary_contact_email) return { error: 'Company has no primary contact email.' }

  // Fetch active staff cards
  const { data: staffCards } = await supabaseAdmin
    .from('staff_cards')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('is_active', true)

  const staffCardIds = (staffCards ?? []).map(c => c.id)
  const staffById = new Map((staffCards ?? []).map(c => [c.id, c.full_name]))

  // Fetch 14-day view count
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: views } = await supabaseAdmin
    .from('card_views')
    .select('staff_card_id')
    .in('staff_card_id', staffCardIds.length > 0 ? staffCardIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('viewed_at', fourteenDaysAgo)

  const viewCount = (views ?? []).length

  // Top card by views
  const countMap = new Map<string, number>()
  for (const v of views ?? []) {
    if (v.staff_card_id) {
      countMap.set(v.staff_card_id, (countMap.get(v.staff_card_id) ?? 0) + 1)
    }
  }
  const topEntry = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])[0]
  const topCardName = topEntry ? (staffById.get(topEntry[0]) ?? null) : null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'

  return sendDay14AnalyticsEmail({
    companyName: company.name,
    adminEmail: company.primary_contact_email,
    adminName: company.primary_contact_name ?? company.name,
    viewCount,
    topCardName,
    dashboardUrl: `${appUrl}/dashboard/analytics`,
  })
}
