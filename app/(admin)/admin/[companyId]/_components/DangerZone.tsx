'use client'

// app/(admin)/admin/[companyId]/_components/DangerZone.tsx
//
// Permanent deletion of a company and all associated data.
// Requires the user to type the company name to confirm — prevents accidental clicks.
// Calls deleteCompany server action then redirects to /admin.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompany } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  companyId: string
  companyName: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DangerZone({ companyId, companyName }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  return (
    <div className="rounded-3xl border-2 border-red-100 bg-red-50/40 p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span className="material-symbols-outlined text-[22px] text-red-500 leading-none">
          warning
        </span>
        <h2 className="font-jakarta text-base font-bold text-red-700">Danger Zone</h2>
      </div>
      <p className="text-sm text-red-600 mb-6 leading-relaxed">
        Permanently deletes <strong>{companyName}</strong> and all associated data — staff cards,
        NFC cards, card views, contacts, and analytics. This cannot be undone.
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
                <span className="material-symbols-outlined text-[16px] leading-none animate-spin">
                  progress_activity
                </span>
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
  )
}
