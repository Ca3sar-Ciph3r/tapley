import OperatorSidebar from '@/components/operator/OperatorSidebar'
import Link from 'next/link'

export default function NewBusinessPage() {
  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Businesses" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/operator/businesses" className="text-[#A7A3A8] hover:text-[#16181D]">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">New Business</h1>
              <p className="text-sm text-[#A7A3A8]">Onboard a new client to the platform</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Business Details */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-5">Business Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Business Name</label>
                    <input type="text" placeholder="e.g. Spindler's Barbers" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Business Type</label>
                    <select className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]">
                      <option value="">Select type...</option>
                      <option>Barber</option>
                      <option>Cafe</option>
                      <option>Fitness</option>
                      <option>Restaurant</option>
                      <option>Retail</option>
                      <option>Salon</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">URL Slug</label>
                    <div className="flex items-center rounded-xl border border-[#E7E5E4] overflow-hidden">
                      <span className="px-3 py-3 text-sm text-[#A7A3A8] bg-[#F7F7F5] border-r border-[#E7E5E4]">tapley.co.za/</span>
                      <input type="text" placeholder="spindlers" className="flex-1 px-3 py-3 text-sm font-semibold text-[#16181D] focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Brand Color</label>
                    <div className="flex items-center gap-3 rounded-xl border border-[#E7E5E4] px-4 py-2">
                      <input type="color" defaultValue="#1A1A1A" className="h-8 w-8 rounded cursor-pointer border-0" />
                      <span className="text-sm font-semibold text-[#16181D]">#1A1A1A</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Booking URL (optional)</label>
                  <input type="url" placeholder="https://booksy.com/..." className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
              </div>
            </div>

            {/* Owner Details */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-5">Owner Details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Owner Email</label>
                    <input type="email" placeholder="brad@spindlers.co.za" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">WhatsApp Number</label>
                    <input type="tel" placeholder="+27 82 000 0000" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-5">Subscription</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Monthly Fee (ZAR)</label>
                  <input type="number" defaultValue={800} className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Initial Status</label>
                  <select className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]">
                    <option value="pipeline">Pipeline</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button className="flex-1 rounded-xl bg-[#6D28F5] py-4 text-sm font-bold text-white hover:bg-[#5b21b6] transition-colors">
                Create Business
              </button>
              <Link href="/operator/businesses" className="flex-1 rounded-xl border border-[#E7E5E4] bg-white py-4 text-center text-sm font-bold text-[#A7A3A8] hover:bg-[#F7F7F5] transition-colors">
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
