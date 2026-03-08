'use client'

/**
 * TapLoader — the animated NFC loading screen shown while the tap state machine runs.
 * Dark background, 3 concentric rings, contactless icon, progress bar.
 * Based on the UI\Client\src\components\TapScreen.tsx prototype.
 */
export default function TapLoader({
  businessName,
  customerName,
}: {
  businessName?: string
  customerName?: string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#111111] px-6 py-8">
      {/* Header — business name (shown only if we have it) */}
      <div className="flex w-full items-center justify-center pt-2">
        {businessName && (
          <p className="text-sm font-semibold text-white/50 uppercase tracking-widest">
            {businessName}
          </p>
        )}
      </div>

      {/* Centre — NFC animation */}
      <div className="flex flex-col items-center gap-8">
        {/* Concentric rings */}
        <div className="relative flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute rounded-full border border-white/10 nfc-ring-outer"
            style={{ width: 192, height: 192 }}
          />
          {/* Middle ring */}
          <div
            className="absolute rounded-full border border-white/25 nfc-ring-mid"
            style={{ width: 144, height: 144 }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full border border-white/60 nfc-ring-inner"
            style={{ width: 96, height: 96 }}
          />

          {/* Contactless icon in white circle */}
          <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: '36px', fontVariationSettings: "'FILL' 1" }}
            >
              contactless
            </span>
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          <h2 className="text-[28px] font-bold text-white leading-tight">
            {customerName ? `Welcome back, ${customerName}` : 'Checking your card...'}
          </h2>
          <p className="mt-1 text-sm text-[#A7A3A8]">
            Loading your loyalty status…
          </p>
        </div>

        {/* Progress bar */}
        <div className="relative h-[2px] w-60 overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white progress-fill" />
        </div>
      </div>

      {/* Footer — Tapley wordmark */}
      <div className="flex items-center gap-1.5 opacity-20">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F59608]">
          <span className="text-[10px] font-black text-white">T</span>
        </div>
        <span className="text-sm font-black tracking-tight text-white">tapley</span>
      </div>
    </div>
  )
}
