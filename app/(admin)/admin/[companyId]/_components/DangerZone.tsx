'use client'

// app/(admin)/admin/[companyId]/_components/DangerZone.tsx
//
// Super admin Danger Zone with two actions:
//   1. Schedule Data Deletion — sets deletion_scheduled_at = now + 30 days, logs to data_deletion_log
//   2. Delete Company — permanent deletion, requires name confirmation

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompany } from '@/lib/actions/admin'
import { scheduleDataDeletion } from '@/lib/actions/onboarding'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  companyId: string
  companyName: string
  /** ISO string if deletion is already scheduled */
  deletionScheduledAt?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DangerZone({ companyId, companyName, deletionScheduledAt }: Props) {
  const router = useRouter()

  // Delete company state
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Schedule deletion state
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState<string | null>(deletionScheduledAt ?? null)

  const confirmed = confirmText.trim() === companyName

  async function handleDelete() {
    if (!confirmed) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteCompany(companyId)
    if (result.error) {
      setDeleteError(result.error)
      setDeleting(false)
      return
    }
    router.push('/admin')
  }

  async function handleScheduleDeletion() {
    setScheduling(true)
    setScheduleError(null)
    const result = await scheduleDataDeletion(companyId)
    if (result.error) {
      setScheduleError(result.error)
      setScheduling(false)
      return
    }
    setScheduledAt(result.scheduledAt?.toISOString() ?? null)
    setScheduling(false)
  }

  return (
    <div className="rounded-3xl border-2 border-red-100 bg-red-50/40 p-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-[22px] text-red-500 leading-none">
            warning
          </span>
          <h2 className="font-jakarta text-base font-bold text-red-700">Danger Zone</h2>
        </div>
        <p className="text-sm text-red-500 leading-relaxed">
          These actions affect live data. Proceed with care.
        </p>
      </div>

      {/* ── Action 1: Schedule Data Deletion ── */}
      <div className="pb-6 border-b border-red-100">
        <h3 className="text-sm font-bold text-red-700 mb-1">Schedule Data Deletion</h3>
        <p className="text-sm text-red-600 mb-4 leading-relaxed">
          Schedules <strong>{companyName}</strong> and all associated data for deletion in 30 days.
          This is logged and reversible before the 30-day window expires.
        </p>

        {scheduledAt ? (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
            <span className="material-symbols-outlined text-[18px] leading-none">schedule</span>
            Deletion scheduled for <strong>{formatDate(scheduledAt)}</strong>. Contact engineering to reverse.
          </div>
        ) : (
          <>
            {scheduleError && (
              <p className="text-sm text-red-700 bg-red-100 rounded-xl px-4 py-2 mb-3">{scheduleError}</p>
            )}
            <button
              onClick={handleScheduleDeletion}
              disabled={scheduling}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              {scheduling ? (
                <span className="material-symbols-outlined text-[16px] leading-none animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px] leading-none">event_busy</span>
              )}
              {scheduling ? 'Scheduling…' : 'Schedule deletion in 30 days'}
            </button>
          </>
        )}
      </div>

      {/* ── Action 2: Permanently Delete ── */}
      <div>
        <h3 className="text-sm font-bold text-red-700 mb-1">Permanently Delete Company</h3>
        <p className="text-sm text-red-600 mb-4 leading-relaxed">
          Permanently deletes <strong>{companyName}</strong> and all associated data — staff cards,
          NFC cards, card views, contacts, and analytics. <strong>This cannot be undone.</strong>
        </p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">delete_forever</span>
            Delete company
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-red-700 mb-2">
                Type <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-800">{companyName}</span> to confirm deletion
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmed) handleDelete() }}
                placeholder={companyName}
                autoFocus
                className="w-full max-w-sm px-4 py-2.5 rounded-xl border-2 border-red-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent bg-white"
              />
            </div>

            {deleteError && (
              <p className="text-sm text-red-700 bg-red-100 rounded-xl px-4 py-2">{deleteError}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={!confirmed || deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <span className="material-symbols-outlined text-[16px] leading-none animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px] leading-none">delete_forever</span>
                )}
                {deleting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); setDeleteError(null) }}
                disabled={deleting}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
