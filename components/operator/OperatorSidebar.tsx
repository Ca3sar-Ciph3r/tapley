import Link from 'next/link'

const navItems = [
  { label: 'Overview', icon: 'grid_view', href: '/operator' },
  { label: 'Businesses', icon: 'storefront', href: '/operator/businesses' },
  { label: 'Cards', icon: 'credit_card', href: '/operator/cards' },
  { label: 'Fraud Alerts', icon: 'warning', href: '/operator/alerts', badge: 1 },
  { label: 'Activity Log', icon: 'history', href: '/operator/activity' },
  { label: 'Settings', icon: 'settings', href: '/operator/settings' },
]

export default function OperatorSidebar({ active }: { active: string }) {
  return (
    <aside className="w-60 shrink-0 bg-[#16181D] flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F59608]">
            <span className="text-sm font-black text-white">T</span>
          </div>
          <span className="text-lg font-black text-white tracking-tight">tapley</span>
        </div>
        <span className="rounded-full bg-[#6D28F5] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
          OPERATOR
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active === item.label ? 'bg-[#6D28F5] text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
              {item.label}
            </div>
            {item.badge ? (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{item.badge}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="p-4 space-y-3 border-t border-white/10">
        <Link
          href="/operator/businesses/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28F5] py-3 text-sm font-bold text-white hover:bg-[#5b21b6] transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          NEW BUSINESS
        </Link>
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">L</div>
          <div>
            <p className="text-xs font-semibold text-white">Luke Gunn</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Operator</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
