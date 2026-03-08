export default function DashboardPage({ params }: { params: { slug: string } }) {
  const business = {
    name: "Spindler's Barbers",
    slug: params.slug,
    brand_color: '#1A1A1A',
    owner_email: 'brad@spindlers.co.za',
  }

  const stats = [
    { label: 'Active Customers', value: 24, icon: 'group' },
    { label: 'Total Visits', value: 187, icon: 'storefront' },
    { label: 'Rewards Issued', value: 12, icon: 'redeem' },
    { label: 'New This Month', value: 8, icon: 'person_add' },
  ]

  const recentActivity = [
    { name: 'James T.', date: '8 Mar 2026, 10:32', status: 'Confirmed' },
    { name: 'Sipho M.', date: '8 Mar 2026, 09:14', status: 'Confirmed' },
    { name: 'Brad S.', date: '7 Mar 2026, 16:45', status: 'Confirmed' },
    { name: 'Thabo K.', date: '7 Mar 2026, 14:22', status: 'Confirmed' },
    { name: 'Liam R.', date: '6 Mar 2026, 11:05', status: 'Confirmed' },
  ]

  const navItems = [
    { label: 'Dashboard', icon: 'grid_view', href: `/dashboard/${params.slug}`, active: true },
    { label: 'Customers', icon: 'group', href: `/dashboard/${params.slug}/customers` },
    { label: 'Activity', icon: 'history', href: `/dashboard/${params.slug}/activity` },
    { label: 'Settings', icon: 'settings', href: `/dashboard/${params.slug}/settings` },
  ]

  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-white border-r border-[#E7E5E4] flex flex-col">
        <div className="p-6 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-black text-sm"
              style={{ backgroundColor: business.brand_color }}
            >
              S
            </div>
            <span className="font-bold text-sm text-[#16181D]">{business.name}</span>
          </div>
          <p className="text-xs text-[#A7A3A8] pl-10">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                item.active ? 'text-white' : 'text-[#A7A3A8] hover:bg-[#F7F7F5] hover:text-[#16181D]'
              }`}
              style={item.active ? { backgroundColor: business.brand_color } : undefined}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E7E5E4]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F7F5] text-xs font-bold text-[#16181D]">B</div>
            <div>
              <p className="text-xs font-semibold text-[#16181D]">Brad Spindler</p>
              <p className="text-[10px] text-[#A7A3A8]">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Good morning, Brad 👋</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">Sunday, 8 March 2026</p>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map(({ label, value, icon }) => (
              <div key={label} className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#A7A3A8]">{label}</span>
                  <span className="material-symbols-outlined text-[#A7A3A8]" style={{ fontSize: '20px' }}>{icon}</span>
                </div>
                <p className="text-3xl font-black text-[#16181D]">{value}</p>
              </div>
            ))}
          </div>

          {/* Tier distribution */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
              <h3 className="font-bold text-[#16181D] mb-4">Tier Distribution</h3>
              {[
                { name: 'Apprentice', count: 10, pct: 42 },
                { name: 'Journeyman', count: 9, pct: 38 },
                { name: 'Master', count: 4, pct: 17 },
                { name: 'Legend', count: 1, pct: 4 },
              ].map((tier) => (
                <div key={tier.name} className="mb-3">
                  <div className="flex justify-between text-xs font-semibold text-[#A7A3A8] mb-1">
                    <span>{tier.name}</span><span>{tier.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#E7E5E4]">
                    <div className="h-2 rounded-full bg-[#1A1A1A]" style={{ width: `${tier.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
              <h3 className="font-bold text-[#16181D] mb-4">Visit Frequency</h3>
              <div className="flex items-end gap-2 h-32">
                {[12, 18, 9, 22, 15, 27, 19].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-md bg-[#1A1A1A]" style={{ height: `${(h / 27) * 100}%` }} />
                    <span className="text-[9px] text-[#A7A3A8]">{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4]">
            <div className="p-6 border-b border-[#E7E5E4]">
              <h2 className="font-bold text-[#16181D]">Recent Activity</h2>
            </div>
            <div className="divide-y divide-[#E7E5E4]">
              {recentActivity.map((visit) => (
                <div key={visit.name + visit.date} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F7F5] text-sm font-bold text-[#16181D]">
                      {visit.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#16181D]">{visit.name}</p>
                      <p className="text-xs text-[#A7A3A8]">{visit.date}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                    <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
