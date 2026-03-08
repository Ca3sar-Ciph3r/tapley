export default function OperatorPage() {
  const businesses = [
    { name: "Spindler's Barbers", type: 'Barber', customers: 24, active: 18, mrr: 800, status: 'live', slug: 'spindlers', color: '#1A1A1A' },
    { name: 'Jacks Bagels', type: 'Cafe', customers: 0, active: 0, mrr: 800, status: 'pipeline', slug: 'jacks', color: '#E8840A' },
    { name: 'Natalie Fitness', type: 'Fitness', customers: 0, active: 0, mrr: 2500, status: 'pipeline', slug: 'natalie', color: '#7C3AED' },
  ]

  const fraudAlerts = [
    { id: 'fa-001', card: 'a3f8c2d1-9e4b', business: "Spindler's Barbers", type: 'Rapid Succession', time: '2h ago' },
  ]

  const navItems = [
    { label: 'Overview', icon: 'grid_view', href: '/operator', active: true },
    { label: 'Businesses', icon: 'storefront', href: '/operator/businesses' },
    { label: 'Cards', icon: 'credit_card', href: '/operator/cards' },
    { label: 'Fraud Alerts', icon: 'warning', href: '/operator/alerts', badge: 1 },
    { label: 'Activity Log', icon: 'history', href: '/operator/activity' },
    { label: 'Settings', icon: 'settings', href: '/operator/settings' },
  ]

  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      {/* Dark sidebar */}
      <aside className="w-60 shrink-0 bg-[#16181D] flex flex-col">
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
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                item.active ? 'bg-[#6D28F5] text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                {item.label}
              </div>
              {item.badge ? (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{item.badge}</span>
              ) : null}
            </a>
          ))}
        </nav>

        <div className="p-4 space-y-3 border-t border-white/10">
          <a
            href="/operator/businesses/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6D28F5] py-3 text-sm font-bold text-white hover:bg-[#5b21b6] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            NEW BUSINESS
          </a>
          <div className="flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">L</div>
            <div>
              <p className="text-xs font-semibold text-white">Luke Gunn</p>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Operator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Platform Overview</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">March 2026</p>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Businesses', value: 3, icon: 'storefront', violet: false },
              { label: 'Active Cards', value: 24, icon: 'credit_card', violet: false },
              { label: 'Visits This Month', value: 187, icon: 'how_to_reg', violet: false },
              { label: 'Platform MRR', value: 'R4,100', icon: 'payments', violet: true },
            ].map(({ label, value, icon, violet }) => (
              <div key={label} className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#A7A3A8]">{label}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: violet ? '#6D28F5' : '#A7A3A8' }}>{icon}</span>
                </div>
                <p className="text-3xl font-black" style={{ color: violet ? '#6D28F5' : '#16181D' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Businesses table */}
          <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] mb-6">
            <div className="p-6 border-b border-[#E7E5E4]">
              <h2 className="font-bold text-[#16181D]">Client Businesses</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  {['Business', 'Type', 'Customers', 'Active / Month', 'MRR', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#A7A3A8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {businesses.map((b) => (
                  <tr key={b.slug} className="hover:bg-[#F7F7F5]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-black" style={{ backgroundColor: b.color }}>
                          {b.name.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-[#16181D]">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#A7A3A8]">{b.type}</td>
                    <td className="px-6 py-4 text-sm text-[#16181D]">{b.status === 'live' ? b.customers : '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#16181D]">{b.status === 'live' ? b.active : '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#16181D]">R{b.mrr.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                        b.status === 'live' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'live' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <a href={`/dashboard/${b.slug}`} className="text-sm font-semibold text-[#6D28F5] hover:underline">
                        {b.status === 'live' ? 'View →' : 'Setup'}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fraud alerts */}
          <div className="rounded-2xl bg-white shadow-sm border-l-4 border-[#F59608] border border-[#E7E5E4] p-6">
            <h2 className="font-bold text-[#16181D] mb-4">⚠ OPEN FRAUD ALERTS ({fraudAlerts.length})</h2>
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-[#A7A3A8]">{alert.card}…</span>
                  <span className="text-[#A7A3A8]">·</span>
                  <span className="text-[#A7A3A8]">{alert.business}</span>
                  <span className="text-[#A7A3A8]">·</span>
                  <span className="font-semibold text-[#F59608]">{alert.type}</span>
                  <span className="text-[#A7A3A8]">·</span>
                  <span className="text-[#A7A3A8]">{alert.time}</span>
                </div>
                <button className="text-sm font-semibold text-[#6D28F5] hover:underline">Investigate</button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
