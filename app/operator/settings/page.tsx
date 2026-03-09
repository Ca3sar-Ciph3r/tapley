import OperatorSidebar from '@/components/operator/OperatorSidebar'

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-[#F7F7F5]">
      <OperatorSidebar active="Settings" />

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-extrabold text-[#16181D] mb-1">Settings</h1>
          <p className="text-sm text-[#A7A3A8] mb-8">Platform configuration and account</p>

          <div className="space-y-6">
            {/* Platform */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-5">Platform</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Platform Name</label>
                  <input type="text" defaultValue="Tapley" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Support Email</label>
                  <input type="email" defaultValue="luke@tapley.co.za" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Base URL</label>
                  <input type="url" defaultValue="https://tapley.co.za" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-1">WhatsApp API</h2>
              <p className="text-xs text-[#A7A3A8] mb-5">Meta Cloud API credentials for sending customer messages</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Access Token</label>
                  <input type="password" placeholder="••••••••••••••••" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Phone Number ID</label>
                    <input type="text" placeholder="e.g. 123456789" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Business Account ID</label>
                    <input type="text" placeholder="e.g. 987654321" className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Send Window (SAST)</label>
                  <div className="flex items-center gap-3">
                    <input type="number" defaultValue={8} min={0} max={23} className="w-24 rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                    <span className="text-sm text-[#A7A3A8]">to</span>
                    <input type="number" defaultValue={20} min={0} max={23} className="w-24 rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                    <span className="text-sm text-[#A7A3A8]">:00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fraud Rules */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-1">Fraud Detection</h2>
              <p className="text-xs text-[#A7A3A8] mb-5">Thresholds for automatic fraud alerts (alerts only — never blocks)</p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Rapid Succession (minutes)</label>
                    <input type="number" defaultValue={10} className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#A7A3A8] mb-2">Daily Stamp Limit</label>
                    <input type="number" defaultValue={1} className="w-full rounded-xl border border-[#E7E5E4] px-4 py-3 text-sm font-semibold text-[#16181D] focus:outline-none focus:ring-2 focus:ring-[#6D28F5]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="rounded-2xl bg-white shadow-sm border border-[#E7E5E4] p-6">
              <h2 className="font-bold text-[#16181D] mb-5">Operator Account</h2>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F7F5]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6D28F5] text-white font-black">L</div>
                <div>
                  <p className="font-semibold text-[#16181D]">Luke Gunn</p>
                  <p className="text-sm text-[#A7A3A8]">lukegunn90@gmail.com</p>
                </div>
                <span className="ml-auto rounded-full bg-[#6D28F5]/10 px-3 py-1 text-xs font-bold text-[#6D28F5] uppercase tracking-widest">Operator</span>
              </div>
            </div>

            <button className="w-full rounded-xl bg-[#6D28F5] py-4 text-sm font-bold text-white hover:bg-[#5b21b6] transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
