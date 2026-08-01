// app/(dashboard)/dashboard/layout.tsx
//
// Rendering:  Server component — fetches role and company name, then renders the shell.
// Auth:       Middleware handles the /login redirect for unauthenticated users.
//             This layout is a second layer of defence: it also redirects if no session.
//
// Role fetch:
//   1. Check company_admins for admin / super_admin
//   2. Fall back to staff_cards for staff role
//   The result is passed to DashboardSidebar (client component).
//
// Company name:
//   Admin → via company_admins → companies(name)
//   Staff → via staff_cards → companies(name)
//
// User display name:
//   user.user_metadata.full_name if set (from Supabase invite), otherwise email prefix.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardSidebar from '@/components/layout/sidebar'
import { brandRampStyle } from '@/lib/utils/brand-ramp'
import ImpersonationBanner from '@/components/layout/impersonation-banner'
import { getImpersonationState } from '@/lib/actions/admin'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defence-in-depth: middleware should have caught this already
  if (!user) {
    redirect('/login')
  }

  // Impersonation state must be resolved first — it overrides the company context
  // for the sidebar and all write operations while active.
  const impersonation = await getImpersonationState()

  // Step 1: Check if this user is a company admin or super admin.
  // Fetch all rows — user may have multiple (super_admin + admin for own company).
  // Pick super_admin if present; otherwise take the first row.
  const { data: adminRowsRaw } = await supabase
    .from('company_admins')
    .select('role, companies(name, logo_url, brand_primary_color)')
    .eq('user_id', user.id)

  type AdminRow = { role: string; companies: { name: string } | { name: string }[] | null }
  const adminRows = (adminRowsRaw ?? []) as AdminRow[]
  const adminRecord = adminRows.find(r => r.role === 'super_admin') ?? adminRows[0] ?? null

  let role: 'admin' | 'super_admin' | 'staff' = 'staff'
  let companyName = 'Tapley Connect'
  let companyLogoUrl: string | null = null
  let companyBrandColor: string | null = null

  // The three branches below all resolve the same shape: whose dashboard this
  // is, and how it should be dressed.
  type CompanyBranding = {
    name: string
    logo_url: string | null
    brand_primary_color: string | null
  }

  if (impersonation?.companyId) {
    // Super admin impersonating: show the impersonated company name in the sidebar
    // so the context matches what write operations will use.
    role = 'super_admin'
    companyName = impersonation.companyName

    // The cookie carries only the name, so branding is fetched. Without this
    // the impersonated view would keep Tapley's teal and show no logo, which
    // defeats the point of previewing what the client actually sees.
    const { data: impersonated } = await supabase
      .from('companies')
      .select('name, logo_url, brand_primary_color')
      .eq('id', impersonation.companyId)
      .maybeSingle()

    if (impersonated) {
      companyLogoUrl = impersonated.logo_url
      companyBrandColor = impersonated.brand_primary_color
    }
  } else if (adminRecord) {
    role = adminRecord.role as 'admin' | 'super_admin'
    const company = (
      Array.isArray(adminRecord.companies)
        ? adminRecord.companies[0]
        : adminRecord.companies
    ) as CompanyBranding | null
    companyName = company?.name ?? 'Tapley Connect'
    companyLogoUrl = company?.logo_url ?? null
    companyBrandColor = company?.brand_primary_color ?? null
  } else {
    // Step 2: Fall back to staff_cards
    const { data: staffCard } = await supabase
      .from('staff_cards')
      .select('companies(name, logo_url, brand_primary_color)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffCard) {
      const company = (
        Array.isArray(staffCard.companies)
          ? staffCard.companies[0]
          : staffCard.companies
      ) as CompanyBranding | null
      companyName = company?.name ?? 'Tapley Connect'
      companyLogoUrl = company?.logo_url ?? null
      companyBrandColor = company?.brand_primary_color ?? null
    }
  }

  // Display name: prefer full_name from Supabase user metadata, fall back to email prefix
  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'User'

  return (
    // The ramp is set here, on the shell, rather than at :root — that is what
    // confines white-labelling to the client dashboard. Tapley's own admin
    // panel and the login page sit outside this element, inherit the :root
    // defaults from globals.css, and stay Tapley teal.
    <div
      className="mesh-gradient min-h-screen flex"
      style={brandRampStyle(companyBrandColor)}
    >
      <DashboardSidebar
        userName={userName}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        role={role}
      />
      {/* ml-60 pushes content past the 240px fixed sidebar */}
      <div className="flex-1 ml-60 min-h-screen flex flex-col">
        {impersonation && (
          <ImpersonationBanner
            companyName={impersonation.companyName}
            companyId={impersonation.companyId}
          />
        )}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
