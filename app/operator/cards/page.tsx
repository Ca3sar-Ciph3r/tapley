import OperatorSidebar from '@/components/operator/OperatorSidebar'

const cards = [
  { uuid: 'a3f8c2d1-9e4b-4c1a-b8d3', business: "Spindler's Barbers", customer: 'James T.', status: 'active', activated: '15 Jan 2026' },
  { uuid: 'b7e2d4f6-1a3c-4e8b-9f2d', business: "Spindler's Barbers", customer: 'Sipho M.', status: 'active', activated: '18 Jan 2026' },
  { uuid: 'c9f1e3a5-2b4d-4f7c-8e1f', business: "Spindler's Barbers", customer: 'Brad S.', status: 'active', activated: '20 Jan 2026' },
  { uuid: 'd4a8b6c2-3e5f-4a9d-7b2e', business: "Spindler's Barbers", customer: 'Thabo K.', status: 'active', activated: '22 Jan 2026' },
  { uuid: 'e1c5d9f3-4b6a-4c8e-2d7f', business: "Spindler's Barbers", customer: 'Liam R.', status: 'active', activated: '25 Jan 2026' },
  { uuid: 'f8d2e6b4-5c7a-4d1f-3e9b', business: "Spindler's Barbers", customer: null, status: 'unactivated', activated: null },
  { uuid: 'a2f9c3d7-6e1b-4f8a-4c5d', business: "Spindler's Barbers", customer: null, status: 'unactivated', activated: null },
  { uuid: 'b6e4f1c8-7d2a-4e3b-5f9c', business: "Spindler's Barbers", customer: 'Ahmed K.', status: 'blacklisted', activated: '1 Feb 2026' },
]

const statusStyles: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  unactivated: 'bg-[#F7F7F5] text-[#A7A3A8]',
  blacklisted: 'bg-red-50 text-red-700',
  replaced: 'bg-purple-50 text-purple-700',
}

export default function CardsPage() {
  const counts = {
    total: cards.length,
    active: cards.filter(c => c.status === 'active').length,
    unactivated: cards.filter(c => c.status === 'unactivated').length,
    blacklisted: cards.filter(c => c.status === 'blacklisted').length,
  }

  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Cards" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Cards</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">All NFC cards across the platform</p>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Cards', value: counts.total, color: '#16181D' },
              { label: 'Active', value: counts.active, color: '#22C55E' },
              { label: 'Unactivated', value: counts.unactivated, color: '#A7A3A8' },
              { label: 'Blacklisted', value: counts.blacklisted, color: '#EF4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">{label}</p>
                <p className="text-3xl font-black" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Cards table */}
          <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4]">
            <div className="p-6 border-b border-[#E7E5E4] flex items-center justify-between">
              <h2 className="font-bold text-[#16181D]">Card Registry</h2>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs font-semibold text-[#A7A3A8] focus:outline-none">
                  <option>All Businesses</option>
                  <option>Spindler's Barbers</option>
                </select>
                <select className="rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs font-semibold text-[#A7A3A8] focus:outline-none">
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>Unactivated</option>
                  <option>Blacklisted</option>
                </select>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  {['Card UUID', 'Business', 'Customer', 'Status', 'Activated', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#A7A3A8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {cards.map((card) => (
                  <tr key={card.uuid} className="hover:bg-[#F7F7F5]">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-[#16181D]">{card.uuid}…</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#A7A3A8]">{card.business}</td>
                    <td className="px-6 py-4 text-sm text-[#16181D]">{card.customer ?? <span className="text-[#A7A3A8]">Unregistered</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[card.status]}`}>
                        {card.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#A7A3A8]">{card.activated ?? '—'}</td>
                    <td className="px-6 py-4">
                      {card.status === 'active' && (
                        <button className="text-xs font-semibold text-red-500 hover:underline">Blacklist</button>
                      )}
                      {card.status === 'blacklisted' && (
                        <button className="text-xs font-semibold text-[#6D28F5] hover:underline">Reinstate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
