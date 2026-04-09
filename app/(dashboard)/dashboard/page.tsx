// app/(dashboard)/dashboard/page.tsx
//
// Rendering:  Server component — role check + redirect for super_admin and staff.
//             Company admins (and impersonating super admins) see DashboardOverview.
//
// Purpose:    Role-based hub. Determines where each role lands after login.
//
// Routing:
//   super_admin (not impersonating)  → /admin
//   super_admin (impersonating)      → renders DashboardOverview (acting as company admin)
//   admin                            → renders DashboardOverview
//   staff                            → /dashboard/my-card
//   no role                          → /login
//
// Impersonation note:
//   startImpersonation sets an httpOnly cookie but does NOT change auth.uid().
//   Without this check, the super admin would be redirected back to /admin on every
//   visit to /dashboard, making impersonation of the company view impossible.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getImpersonationState } from '@/lib/actions/admin'
import { DashboardOverview } from './_components/DashboardOverview'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if the super admin is currently impersonating a company.
  // If so, skip the /admin redirect and show the company admin view.
  const impersonation = await getImpersonationState()

  // Check company_admins table for role
  const { data: adminRecordRaw } = await supabase
    .from('company_admins')
    .select('role, company_id')
    .eq('user_id', user.id)
    .single()

  const adminRecord = adminRecordRaw as { role: string; company_id: string } | null

  if (adminRecord?.role === 'super_admin') {
    if (impersonation) {
      // Impersonating — show the company admin dashboard view
      return <DashboardOverview />
    }
    redirect('/admin')
  }

  if (adminRecord?.role === 'admin') {
    return <DashboardOverview />
  }

  // No admin record — check if they are a staff member
  const { data: staffCard } = await supabase
    .from('staff_cards')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (staffCard) {
    redirect('/dashboard/my-card')
  }

  // No valid role found
  redirect('/login')
}
