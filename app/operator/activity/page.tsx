import OperatorSidebar from '@/components/operator/OperatorSidebar'

const log = [
  { id: 1, time: '9 Mar 2026, 10:32', actor: 'system', action: 'VISIT_CONFIRMED', entity: 'visit', business: "Spindler's Barbers", detail: 'James T. — visit confirmed by staff' },
  { id: 2, time: '9 Mar 2026, 09:14', actor: 'system', action: 'VISIT_CONFIRMED', entity: 'visit', business: "Spindler's Barbers", detail: 'Sipho M. — visit confirmed by staff' },
  { id: 3, time: '9 Mar 2026, 08:14', actor: 'system', action: 'FRAUD_ALERT_CREATED', entity: 'fraud_alert', business: "Spindler's Barbers", detail: 'Rapid succession detected on card a3f8c2d1…' },
  { id: 4, time: '8 Mar 2026, 16:45', actor: 'brad@spindlers.co.za', action: 'REDEMPTION_CONFIRMED', entity: 'redemption', business: "Spindler's Barbers", detail: 'Brad S. redeemed: Free beard trim' },
  { id: 5, time: '8 Mar 2026, 14:30', actor: 'system', action: 'FRAUD_ALERT_CREATED', entity: 'fraud_alert', business: "Spindler's Barbers", detail: 'Daily limit exceeded on card b7e2d4f6…' },
  { id: 6, time: '8 Mar 2026, 11:00', actor: 'luke@tapley.co.za', action: 'BUSINESS_CREATED', entity: 'business', business: 'Natalie Fitness', detail: 'New business onboarded: Natalie Fitness' },
  { id: 7, time: '7 Mar 2026, 14:22', actor: 'system', action: 'VISIT_CONFIRMED', entity: 'visit', business: "Spindler's Barbers", detail: 'Thabo K. — visit confirmed by staff' },
  { id: 8, time: '7 Mar 2026, 09:00', actor: 'luke@tapley.co.za', action: 'CARD_BLACKLISTED', entity: 'card', business: "Spindler's Barbers", detail: 'Card c9f1e3a5… blacklisted after investigation' },
]

const actionStyles: Record<string, { color: string; icon: string }> = {
  VISIT_CONFIRMED: { color: 'text-green-600', icon: 'check_circle' },
  REDEMPTION_CONFIRMED: { color: 'text-purple-600', icon: 'redeem' },
  FRAUD_ALERT_CREATED: { color: 'text-red-500', icon: 'warning' },
  BUSINESS_CREATED: { color: 'text-blue-600', icon: 'storefront' },
  CARD_BLACKLISTED: { color: 'text-amber-600', icon: 'block' },
}

export default function ActivityPage() {
  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Activity Log" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Activity Log</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">Full audit trail across the platform</p>

          <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4]">
            <div className="p-6 border-b border-[#E7E5E4] flex items-center justify-between">
              <h2 className="font-bold text-[#16181D]">Recent Activity</h2>
              <div className="flex items-center gap-2">
                <select className="rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs font-semibold text-[#A7A3A8] focus:outline-none">
                  <option>All Businesses</option>
                  <option>Spindler's Barbers</option>
                  <option>Jacks Bagels</option>
                  <option>Natalie Fitness</option>
                </select>
                <select className="rounded-lg border border-[#E7E5E4] px-3 py-2 text-xs font-semibold text-[#A7A3A8] focus:outline-none">
                  <option>All Actions</option>
                  <option>Visits</option>
                  <option>Redemptions</option>
                  <option>Fraud Alerts</option>
                  <option>Admin</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#E7E5E4]">
              {log.map((entry) => {
                const style = actionStyles[entry.action] ?? { color: 'text-[#A7A3A8]', icon: 'info' }
                return (
                  <div key={entry.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F7F5]">
                    <span className={`material-symbols-outlined ${style.color}`} style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
                      {style.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-black uppercase tracking-wide text-[#16181D]">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-[#A7A3A8]">· {entry.business}</span>
                      </div>
                      <p className="text-sm text-[#A7A3A8] truncate">{entry.detail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-[#A7A3A8]">{entry.time}</p>
                      <p className="text-xs text-[#A7A3A8] mt-0.5">{entry.actor}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
