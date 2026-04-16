'use client'

// components/layout/sidebar.tsx
//
// Rendering:  Client component — needs usePathname() for active nav state.
// Purpose:    Fixed 240px sidebar with role-aware navigation, company name, and sign-out.
//
// Role nav:
//   admin / super_admin → Dashboard, Team Cards, Analytics, Settings
//   staff               → My Card only
//
// Design: glassmorphism panel, teal/indigo palette, Material Symbols icons.
// Active item: teal-50 bg + teal-700 text.
// Inactive item: slate-500, hover slate-900.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'

interface SidebarProps {
  userName: string
  companyName: string
  role: 'admin' | 'super_admin' | 'staff'
}

interface NavItem {
  label: string
  icon: string
  href: string
  /** Match exactly — don't use startsWith */
  exact?: boolean
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard', exact: true },
  { label: 'Team Cards', icon: 'groups', href: '/dashboard/cards' },
  { label: 'Analytics', icon: 'monitoring', href: '/dashboard/analytics' },
  { label: 'Refer & Earn', icon: 'card_giftcard', href: '/dashboard/refer' },
  { label: 'Branding', icon: 'palette', href: '/dashboard/branding' },
  { label: 'Billing', icon: 'receipt_long', href: '/dashboard/billing' },
]

const STAFF_NAV: NavItem[] = [
  { label: 'My Card', icon: 'id_card', href: '/dashboard/my-card' },
]

export default function DashboardSidebar({
  userName,
  companyName,
  role,
}: SidebarProps) {
  const pathname = usePathname()
  const navItems = role === 'staff' ? STAFF_NAV : ADMIN_NAV

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 z-40 glass-panel border-r border-slate-200/50 flex flex-col p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Brand */}
      <div className="mb-8">
        <h1 className="font-jakarta text-xl font-bold tracking-tight text-slate-900">
          Tapley Connect
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 truncate">{companyName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-teal-50 text-teal-700 font-semibold shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:-translate-y-px',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[20px] leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User profile + sign out */}
      <div className="mt-auto pt-5 border-t border-slate-100 space-y-3">
        <div className="px-1">
          <p className="font-jakarta font-semibold text-slate-900 text-sm truncate">
            {userName}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-teal-600 font-bold mt-0.5">
            {role === 'staff' ? 'Staff Member' : 'Admin'}
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
