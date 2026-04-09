'use client'

// components/layout/impersonation-banner.tsx
//
// Rendering:  Client component — needs the stopImpersonation server action.
// Purpose:    Amber banner shown at the top of every dashboard page when
//             the super admin is impersonating a Company Admin.
//
// Shown by:   DashboardLayout (server component) — it reads the httpOnly
//             impersonation cookie and renders this banner when present,
//             passing companyName and companyId as props.
//
// Exit flow:
//   1. User clicks "Exit Impersonation"
//   2. stopImpersonation() server action fires:
//      a. Updates impersonation_log.ended_at
//      b. Deletes the httpOnly cookie
//      c. Redirects back to /admin/[companyId]

import { useState } from 'react'
import { stopImpersonation } from '@/lib/actions/admin'

interface ImpersonationBannerProps {
  companyName: string
  companyId: string
}

export default function ImpersonationBanner({
  companyName,
  companyId,
}: ImpersonationBannerProps) {
  const [exiting, setExiting] = useState(false)

  async function handleExit() {
    setExiting(true)
    // stopImpersonation calls redirect() internally — page navigates away.
    // The setExiting spinner shows until the redirect fires.
    await stopImpersonation()
  }

  return (
    <div className="w-full bg-amber-500 px-6 py-2.5 flex items-center justify-between z-50 shadow-sm">
      <div className="flex items-center gap-2.5 text-white">
        <span className="material-symbols-outlined text-[18px] leading-none flex-shrink-0">
          person_play
        </span>
        <span className="text-sm font-semibold">
          Impersonating{' '}
          <span className="font-bold">{companyName}</span>
          {' '}as Company Admin
        </span>
        <span className="text-amber-200 text-xs">
          · All actions are being logged
        </span>
      </div>

      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-white hover:bg-amber-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
      >
        {exiting ? (
          <span className="material-symbols-outlined text-[14px] leading-none animate-spin">
            progress_activity
          </span>
        ) : (
          <span className="material-symbols-outlined text-[14px] leading-none">
            logout
          </span>
        )}
        {exiting ? 'Exiting…' : 'Exit Impersonation'}
      </button>
    </div>
  )
}
