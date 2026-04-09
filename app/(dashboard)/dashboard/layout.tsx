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

  // Step 1: Check if this user is a company admin or super admin
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role, companies(name)')
    .eq('user_id', user.id)
    .single()

  let role: 'admin' | 'super_admin' | 'staff' = 'staff'
  let companyName = 'Tapley Connect'

  if (adminRecord) {
    role = adminRecord.role as 'admin' | 'super_admin'
    const company = Array.isArray(adminRecord.companies)
      ? adminRecord.companies[0]
      : adminRecord.companies
    companyName = (company as { name: string } | null)?.name ?? 'Tapley Connect'
  } else {
    // Step 2: Fall back to staff_cards
    const { data: staffCard } = await supabase
      .from('staff_cards')
      .select('companies(name)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffCard) {
      const company = Array.isArray(staffCard.companies)
        ? staffCard.companies[0]
        : staffCard.companies
      companyName = (company as { name: string } | null)?.name ?? 'Tapley Connect'
    }
  }

  // Display name: prefer full_name from Supabase user metadata, fall back to email prefix
  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'User'

  // Check if the super admin is currently impersonating a company.
  // This is an httpOnly cookie set by startImpersonation() and cleared by stopImpersonation().
  const impersonation = await getImpersonationState()

  return (
    <div className="mesh-gradient min-h-screen flex">
      <DashboardSidebar userName={userName} companyName={companyName} role={role} />
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
