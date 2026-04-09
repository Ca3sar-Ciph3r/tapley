'use client'

// components/layout/admin-sidebar.tsx
//
// Rendering:  Client component — needs usePathname() for active nav state.
// Purpose:    Fixed 240px sidebar for the /admin/* section.
//             Separate from DashboardSidebar — admin has its own nav.
//
// Nav items:
//   - All Companies → /admin
//
// Design: same glassmorphism + teal/indigo palette as DashboardSidebar,
//         but shows "Super Admin" role badge in amber to distinguish it visually.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'

interface AdminSidebarProps {
  userName: string
}

export default function AdminSidebar({ userName }: AdminSidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 z-40 glass-panel border-r border-slate-200/50 flex flex-col p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Brand */}
      <div className="mb-8">
        <h1 className="font-jakarta text-xl font-bold tracking-tight text-slate-900">
          Tapley Connect
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Admin Panel</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        <Link
          href="/admin"
          className={[
            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
            isActive('/admin', true)
              ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:-translate-y-px',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-[20px] leading-none">
            business
          </span>
          All Companies
        </Link>
      </nav>

      {/* User profile + sign out */}
      <div className="mt-auto pt-5 border-t border-slate-100 space-y-3">
        <div className="px-1">
          <p className="font-jakarta font-semibold text-slate-900 text-sm truncate">
            {userName}
          </p>
          {/* Amber badge distinguishes super admin from regular admin */}
          <p className="text-[11px] uppercase tracking-wider text-amber-600 font-bold mt-0.5">
            Super Admin
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">
              logout
            </span>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
