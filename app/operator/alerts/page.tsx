import OperatorSidebar from '@/components/operator/OperatorSidebar'

const alerts = [
  {
    id: 'fa-001', card: 'a3f8c2d1-9e4b', business: "Spindler's Barbers",
    customer: 'James T.', type: 'Rapid Succession', description: '3 taps within 8 minutes on the same card.',
    status: 'open', time: '2h ago', date: '9 Mar 2026, 08:14',
  },
  {
    id: 'fa-002', card: 'b7e2d4f6-1a3c', business: "Spindler's Barbers",
    customer: 'Ahmed K.', type: 'Daily Limit Exceeded', description: 'Card tapped 3 times in one day.',
    status: 'investigating', time: '1d ago', date: '8 Mar 2026, 14:30',
  },
  {
    id: 'fa-003', card: 'c9f1e3a5-2b4d', business: "Spindler's Barbers",
    customer: 'Unknown', type: 'Blacklisted Card', description: 'Blacklisted card attempted a tap.',
    status: 'resolved', time: '3d ago', date: '6 Mar 2026, 11:05',
  },
]

const statusStyles: Record<string, string> = {
  open: 'bg-red-50 text-red-700',
  investigating: 'bg-amber-50 text-amber-700',
  dismissed: 'bg-[#F7F7F5] text-[#A7A3A8]',
  resolved: 'bg-green-50 text-green-700',
}

export default function AlertsPage() {
  const open = alerts.filter(a => a.status === 'open').length

  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Fraud Alerts" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Fraud Alerts</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">{open} open alert{open !== 1 ? 's' : ''} requiring attention</p>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Open', value: alerts.filter(a => a.status === 'open').length, color: '#EF4444' },
              { label: 'Investigating', value: alerts.filter(a => a.status === 'investigating').length, color: '#F59608' },
              { label: 'Resolved', value: alerts.filter(a => a.status === 'resolved').length, color: '#22C55E' },
              { label: 'Total', value: alerts.length, color: '#16181D' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl bg-white p-5 shadow-sm border border-[#E7E5E4]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">{label}</p>
                <p className="text-3xl font-black" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Alerts list */}
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div key={alert.id} className={`rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6 ${alert.status === 'open' ? 'border-l-4 border-l-red-500' : alert.status === 'investigating' ? 'border-l-4 border-l-amber-500' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono text-[#A7A3A8]">{alert.card}…</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${statusStyles[alert.status]}`}>
                        {alert.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-[#16181D]">{alert.type}</h3>
                  </div>
                  <span className="text-xs text-[#A7A3A8]">{alert.date}</span>
                </div>

                <p className="text-sm text-[#A7A3A8] mb-4">{alert.description}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-[#A7A3A8]">
                    <span><strong className="text-[#16181D]">Business:</strong> {alert.business}</span>
                    <span><strong className="text-[#16181D]">Customer:</strong> {alert.customer}</span>
                  </div>
                  {alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                    <div className="flex items-center gap-3">
                      <button className="rounded-lg border border-[#E7E5E4] px-4 py-2 text-xs font-bold text-[#A7A3A8] hover:bg-[#F7F7F5]">
                        Dismiss
                      </button>
                      <button className="rounded-lg bg-[#16181D] px-4 py-2 text-xs font-bold text-white hover:bg-black">
                        {alert.status === 'open' ? 'Investigate' : 'Mark Resolved'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
