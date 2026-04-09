// app/(admin)/admin/layout.tsx
//
// Rendering:  Server component — auth guard + role check happens here.
// Auth:       Must be authenticated AND have role = 'super_admin'.
//             Middleware already blocks non-super_admin from /admin/*,
//             but this is a defence-in-depth check.
//
// Layout:     Fixed 240px AdminSidebar (separate from DashboardSidebar).
//             Content fills the remaining width.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/layout/admin-sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Defence-in-depth: verify super_admin role
  const { data: adminRecord } = await supabase
    .from('company_admins')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (adminRecord?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const userName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Super Admin'

  return (
    <div className="mesh-gradient min-h-screen flex">
      <AdminSidebar userName={userName} />
      {/* ml-60 pushes content past the 240px fixed sidebar */}
      <main className="flex-1 ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
