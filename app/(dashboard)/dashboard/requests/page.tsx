'use client'

// app/(dashboard)/dashboard/requests/page.tsx
//
// Where a client asks for a change and watches it happen.
//
// The dashboard is read-mostly by design — Tapley builds and maintains the
// cards. This page is what stops that being a dead end: the client still says
// what they want, sees that it was received, and sees when it was done.

import { useCallback, useEffect, useState } from 'react'
import {
  createChangeRequest,
  listChangeRequests,
} from '@/lib/actions/change-requests'
// Constants come from the plain module, not the 'use server' one — see the
// note in lib/constants/change-requests.ts.
import {
  CHANGE_REQUEST_TYPES,
  type ChangeRequest,
} from '@/lib/constants/change-requests'
import { getEffectiveCompanyId } from '@/lib/actions/admin'
import { NoCompanySelected } from '@/components/dashboard/no-company-selected'

const TYPE_LABELS = new Map<string, string>(
  CHANGE_REQUEST_TYPES.map(t => [t.value, t.label])
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function RequestsPage() {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)

  const [type, setType] = useState<string>(CHANGE_REQUEST_TYPES[0].value)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const load = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false)
      return
    }
    setRequests(await listChangeRequests())
    setLoading(false)
  }, [activeCompanyId])

  useEffect(() => {
    getEffectiveCompanyId().then(setActiveCompanyId)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await createChangeRequest({ type, details })
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setDetails('')
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    await load()
  }

  if (!activeCompanyId) return <NoCompanySelected what="requests" />

  const open = requests.filter(r => r.status === 'open')
  const done = requests.filter(r => r.status !== 'open')

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <h1 className="font-jakarta text-2xl font-bold text-slate-900">Requests</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Tell us what you need changed and we will take care of it — usually the
          same day. Your team keeps working while we do.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-panel mb-8 rounded-2xl border border-slate-200/60 p-6 shadow-sm"
      >
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
          What do you need?
        </label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        >
          {CHANGE_REQUEST_TYPES.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Details
        </label>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={4}
          placeholder="e.g. Sarah Mokoena has left. Please move her card to James Nkosi, james@example.co.za, 082 123 4567."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !details.trim()}
            className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
          {sent && (
            <span className="text-sm font-medium text-emerald-600">
              Sent — we will be in touch.
            </span>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <Section title="In progress" empty="Nothing outstanding." items={open} />
          {done.length > 0 && <Section title="Completed" empty="" items={done} />}
        </>
      )}
    </div>
  )
}

function Section({
  title,
  empty,
  items,
}: {
  title: string
  empty: string
  items: ChangeRequest[]
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map(r => {
            const isDone = r.status !== 'open'
            return (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200/70 bg-white/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {TYPE_LABELS.get(r.type) ?? 'Request'}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isDone
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {isDone ? 'Done' : 'In progress'}
                  </span>
                </div>

                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {r.details}
                </p>

                <p className="mt-2 text-[11px] text-slate-400">
                  Sent {formatDate(r.created_at)}
                  {r.resolved_at && ` · Completed ${formatDate(r.resolved_at)}`}
                </p>

                {r.resolution_note && (
                  <p className="mt-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-[13px] text-emerald-800">
                    {r.resolution_note}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
