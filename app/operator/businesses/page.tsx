import OperatorSidebar from '@/components/operator/OperatorSidebar'
import Link from 'next/link'

const businesses = [
  {
    name: "Spindler's Barbers", type: 'Barber', slug: 'spindlers', color: '#1A1A1A',
    owner: 'brad@spindlers.co.za', customers: 24, cards: 50, mrr: 800,
    status: 'live', joined: 'Jan 2026',
  },
  {
    name: 'Jacks Bagels', type: 'Cafe', slug: 'jacks', color: '#E8840A',
    owner: 'jack@jacksbagels.co.za', customers: 0, cards: 0, mrr: 800,
    status: 'pipeline', joined: 'Feb 2026',
  },
  {
    name: 'Natalie Fitness', type: 'Fitness', slug: 'natalie', color: '#7C3AED',
    owner: 'natalie@nataliefitness.co.za', customers: 0, cards: 0, mrr: 2500,
    status: 'pipeline', joined: 'Mar 2026',
  },
]

export default function BusinessesPage() {
  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Businesses" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Businesses</h1>
              <p className="text-sm text-[#A7A3A8]">{businesses.length} clients on platform</p>
            </div>
            <Link
              href="/operator/businesses/new"
              className="flex items-center gap-2 rounded-xl bg-[#6D28F5] px-5 py-3 text-sm font-bold text-white hover:bg-[#5b21b6] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              New Business
            </Link>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E5E4]">
                  {['Business', 'Owner', 'Customers', 'Cards', 'MRR', 'Status', 'Joined', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#A7A3A8]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4]">
                {businesses.map((b) => (
                  <tr key={b.slug} className="hover:bg-[#F7F7F5]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-black shrink-0" style={{ backgroundColor: b.color }}>
                          {b.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#16181D]">{b.name}</p>
                          <p className="text-xs text-[#A7A3A8]">{b.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#A7A3A8]">{b.owner}</td>
                    <td className="px-6 py-4 text-sm text-[#16181D]">{b.status === 'live' ? b.customers : '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#16181D]">{b.cards > 0 ? b.cards : '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#16181D]">R{b.mrr.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                        b.status === 'live' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${b.status === 'live' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#A7A3A8]">{b.joined}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/dashboard/${b.slug}`} className="text-sm font-semibold text-[#6D28F5] hover:underline">
                          Dashboard
                        </Link>
                        <span className="text-[#E7E5E4]">|</span>
                        <Link href={`/operator/businesses/${b.slug}`} className="text-sm font-semibold text-[#A7A3A8] hover:text-[#16181D]">
                          Edit
                        </Link>
                      </div>
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
