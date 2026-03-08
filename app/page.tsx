import Link from 'next/link'

/**
 * Root page — shown when no card UUID is present.
 * tapley.co.za is always accessed via NFC tap URL (/tap?card=UUID).
 * This page just shows a branded holding screen.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#1A1A1A] px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Tapley wordmark */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59608]">
            <span className="text-xl font-black text-white">T</span>
          </div>
          <span className="text-3xl font-black tracking-tight text-white">tapley</span>
        </div>

        <p className="text-lg font-medium text-white/60">
          Loyalty made simple.
        </p>

        <p className="max-w-xs text-sm text-white/40 leading-relaxed">
          Tap your NFC loyalty card at a participating business to get started.
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Business owner?
          </p>
          <Link
            href="/login"
            className="mt-1 block text-sm font-semibold text-[#F59608] hover:underline"
          >
            Log in to your dashboard →
          </Link>
        </div>
      </div>
    </div>
  )
}
