'use client'

// app/(admin)/admin/requests/page.tsx
//
// Luke and Ethan's work queue: every open change request, oldest first, across
// all companies.
//
// Oldest first is deliberate. Newest-first queues quietly starve the requests
// that have been waiting longest, which are exactly the ones a client is
// getting annoyed about.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CHANGE_REQUEST_TYPES,
  listOpenRequestsForAllCompanies,
  resolveChangeRequest,
  type ChangeRequest,
} from '@/lib/actions/change-requests'

const TYPE_LABELS = new Map<string, string>(
  CHANGE_REQUEST_TYPES.map(t => [t.value, t.label])
)

type Row = ChangeRequest & { company_name: string }

function daysWaiting(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default function AdminRequestsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRows(await listOpenRequestsForAllCompanies())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleResolve(id: string) {
    setBusyId(id)
    setError(null)
    const result = await resolveChangeRequest(id, notes[id] ?? '')
    setBusyId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    await load()
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">
            Client Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading
              ? 'Loading…'
              : rows.length === 0
                ? 'Nothing outstanding.'
                : `${rows.length} open · oldest first`}
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          ← Companies
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-10 text-center">
          <span className="material-symbols-outlined text-[36px] text-slate-300">
            inbox
          </span>
          <p className="mt-2 text-sm text-slate-500">
            No open requests. Everything clients have asked for is done.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map(r => {
          const waiting = daysWaiting(r.created_at)
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {r.company_name}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {TYPE_LABELS.get(r.type) ?? 'Request'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    waiting >= 2
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {waiting === 0 ? 'Today' : `${waiting}d waiting`}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {r.details}
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={notes[r.id] ?? ''}
                  onChange={e =>
                    setNotes(prev => ({ ...prev, [r.id]: e.target.value }))
                  }
                  placeholder="What you did (the client sees this)"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
                <button
                  type="button"
                  onClick={() => handleResolve(r.id)}
                  disabled={busyId === r.id}
                  className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {busyId === r.id ? 'Saving…' : 'Mark done'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
