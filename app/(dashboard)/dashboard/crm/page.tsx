'use client'

// app/(dashboard)/dashboard/crm/page.tsx
//
// Rendering:  Client component — live data + manual add.
// Auth:       Company Admin / Super Admin. Dashboard layout enforces this.
// Supabase:   Browser client — RLS scopes contacts to the current company.
//
// Shows:
//   - Stat row: total contacts, manual, card_tap, import
//   - Search by name / email
//   - Contacts table: name, company, email, phone, source card, date, actions
//   - Manual add contact form (inline drawer)
//   - Notes edit per contact
//   - Export to CSV

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getImpersonationState } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ContactSource = 'card_tap' | 'manual' | 'import'

type Contact = {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  whatsappNumber: string | null
  companyName: string | null
  jobTitle: string | null
  notes: string | null
  source: ContactSource
  createdAt: string
  staffCardId: string | null
  staffCardName: string | null   // full_name from staff_cards join
}

type AddContactForm = {
  fullName: string
  email: string
  phone: string
  whatsappNumber: string
  companyName: string
  jobTitle: string
  notes: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const SOURCE_STYLES: Record<ContactSource, string> = {
  card_tap: 'bg-teal-50 text-teal-700',
  manual:   'bg-slate-100 text-slate-600',
  import:   'bg-indigo-50 text-indigo-700',
}

const SOURCE_LABELS: Record<ContactSource, string> = {
  card_tap: 'Card Tap',
  manual:   'Manual',
  import:   'Import',
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function exportToCsv(contacts: Contact[]) {
  const headers = ['Name', 'Email', 'Phone', 'WhatsApp', 'Company', 'Job Title', 'Source Card', 'Source', 'Date Added', 'Notes']
  const rows = contacts.map(c => [
    c.fullName ?? '',
    c.email ?? '',
    c.phone ?? '',
    c.whatsappNumber ?? '',
    c.companyName ?? '',
    c.jobTitle ?? '',
    c.staffCardName ?? '',
    SOURCE_LABELS[c.source],
    formatDate(c.createdAt),
    c.notes ?? '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const EMPTY_FORM: AddContactForm = {
  fullName: '',
  email: '',
  phone: '',
  whatsappNumber: '',
  companyName: '',
  jobTitle: '',
  notes: '',
}

// ---------------------------------------------------------------------------
// AddContactDrawer
// ---------------------------------------------------------------------------

function AddContactDrawer({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (form: AddContactForm) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<AddContactForm>(EMPTY_FORM)

  function set(field: keyof AddContactForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.fullName.trim() && !form.email.trim()) {
      alert('Please enter at least a name or email.')
      return
    }
    await onSave(form)
    setForm(EMPTY_FORM)
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-teal-100">
      <h3 className="font-jakarta text-base font-bold text-slate-900 mb-4">Add Contact</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Full Name</label>
          <input type="text" placeholder="Jane Smith" value={form.fullName}
            onChange={e => set('fullName', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" placeholder="jane@example.com" value={form.email}
            onChange={e => set('email', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input type="tel" placeholder="+27821234567" value={form.phone}
            onChange={e => set('phone', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>WhatsApp</label>
          <input type="tel" placeholder="+27821234567" value={form.whatsappNumber}
            onChange={e => set('whatsappNumber', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Their Company</label>
          <input type="text" placeholder="Acme Corp" value={form.companyName}
            onChange={e => set('companyName', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Their Job Title</label>
          <input type="text" placeholder="Procurement Manager" value={form.jobTitle}
            onChange={e => set('jobTitle', e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className={labelCls}>Notes</label>
          <textarea rows={2} placeholder="How you met, what to follow up on…"
            value={form.notes} onChange={e => set('notes', e.target.value)}
            className={`${inputCls} resize-none`} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[14px] leading-none">person_add</span>
          )}
          {saving ? 'Saving…' : 'Save Contact'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NotesCell — inline editable notes
// ---------------------------------------------------------------------------

function NotesCell({
  contactId,
  initialNotes,
  onSave,
}: {
  contactId: string
  initialNotes: string | null
  onSave: (id: string, notes: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  async function handleSave() {
    setSaving(true)
    await onSave(contactId, value)
    setSaving(false)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full group"
        title="Click to edit notes"
      >
        <span className={`text-xs ${initialNotes ? 'text-slate-500' : 'text-slate-300 italic'} group-hover:text-teal-600 transition-colors line-clamp-2`}>
          {initialNotes ?? 'Add notes…'}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        rows={3}
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full px-2 py-1.5 text-xs bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => { setValue(initialNotes ?? ''); setEditing(false) }}
          className="text-[11px] text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    initPage()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initPage() {
    setLoading(true)
    setLoadError(null)
    const supabase = createClient()

    // Resolve company_id — impersonation-aware
    const impersonation = await getImpersonationState()
    let resolvedCompanyId: string | null = null

    if (impersonation?.companyId) {
      resolvedCompanyId = impersonation.companyId
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadError('Not authenticated.'); setLoading(false); return }

      const { data: adminRow } = await supabase
        .from('company_admins')
        .select('company_id')
        .eq('user_id', user.id)
        .single()
      resolvedCompanyId = adminRow?.company_id ?? null
    }

    setCompanyId(resolvedCompanyId)
    await loadContacts(resolvedCompanyId)
  }

  async function loadContacts(cid: string | null) {
    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => unknown
    }

    type QueryBuilder = {
      select: (q: string) => QueryBuilder
      eq: (col: string, val: string) => QueryBuilder
      order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
    }

    let query = (supabaseAny.from('contacts') as QueryBuilder)
      .select(`
        id,
        full_name,
        email,
        phone,
        whatsapp_number,
        company_name,
        job_title,
        notes,
        source,
        created_at,
        staff_card_id,
        staff_cards(full_name)
      `)

    if (cid) {
      query = query.eq('company_id', cid)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      setLoadError('Failed to load contacts.')
      setLoading(false)
      return
    }

    const mapped: Contact[] = (data ?? []).map((r: unknown) => {
      const row = r as {
        id: string
        full_name: string | null
        email: string | null
        phone: string | null
        whatsapp_number: string | null
        company_name: string | null
        job_title: string | null
        notes: string | null
        source: string
        created_at: string
        staff_card_id: string | null
        staff_cards: { full_name: string } | { full_name: string }[] | null
      }
      const staffName = Array.isArray(row.staff_cards)
        ? (row.staff_cards[0]?.full_name ?? null)
        : (row.staff_cards?.full_name ?? null)
      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        whatsappNumber: row.whatsapp_number,
        companyName: row.company_name,
        jobTitle: row.job_title,
        notes: row.notes,
        source: row.source as ContactSource,
        createdAt: row.created_at,
        staffCardId: row.staff_card_id,
        staffCardName: staffName,
      }
    })

    setContacts(mapped)
    setLoading(false)
  }

  async function handleAddContact(form: AddContactForm) {
    if (!companyId) return
    setAddSaving(true)
    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
    }

    const { error } = await supabaseAny.from('contacts').insert({
      company_id: companyId,
      full_name: form.fullName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp_number: form.whatsappNumber.trim() || null,
      company_name: form.companyName.trim() || null,
      job_title: form.jobTitle.trim() || null,
      notes: form.notes.trim() || null,
      source: 'manual',
    })

    if (error) {
      alert(`Failed to add contact: ${error.message}`)
    } else {
      setShowAdd(false)
      await loadContacts(companyId)
    }
    setAddSaving(false)
  }

  async function handleSaveNotes(contactId: string, notes: string) {
    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => {
        update: (row: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }

    const { error } = await supabaseAny.from('contacts')
      .update({ notes: notes.trim() || null })
      .eq('id', contactId)

    if (error) {
      alert(`Failed to save notes: ${error.message}`)
      return
    }

    setContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, notes: notes.trim() || null } : c)
    )
  }

  async function handleDelete(contactId: string) {
    if (!confirm('Delete this contact? This cannot be undone.')) return
    const supabase = createClient()
    const supabaseAny = supabase as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }

    const { error } = await supabaseAny.from('contacts').delete().eq('id', contactId)
    if (error) {
      alert(`Failed to delete: ${error.message}`)
    } else {
      setContacts(prev => prev.filter(c => c.id !== contactId))
    }
  }

  const filtered = contacts.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.fullName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.jobTitle?.toLowerCase().includes(q)
    )
  })

  const stats = {
    total: contacts.length,
    manual: contacts.filter(c => c.source === 'manual').length,
    card_tap: contacts.filter(c => c.source === 'card_tap').length,
    import: contacts.filter(c => c.source === 'import').length,
  }

  return (
    <div className="px-8 py-8 space-y-7 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
            Contacts
          </h1>
          <p className="text-sm text-slate-500 mt-1">People who&apos;ve connected with your team</p>
        </div>
        <div className="flex items-center gap-3">
          {contacts.length > 0 && (
            <button
              onClick={() => exportToCsv(filtered)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">download</span>
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowAdd(s => !s)}
            className={[
              'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-sm',
              showAdd
                ? 'text-slate-700 bg-slate-100 border border-slate-200'
                : 'text-white bg-teal-600 hover:bg-teal-700',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">
              {showAdd ? 'close' : 'person_add'}
            </span>
            {showAdd ? 'Cancel' : 'Add Contact'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && contacts.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'Total Contacts', value: stats.total, icon: 'contacts', accent: 'text-teal-600' },
            { label: 'Card Taps', value: stats.card_tap, icon: 'nfc', accent: 'text-indigo-600' },
            { label: 'Manual', value: stats.manual, icon: 'edit_note', accent: 'text-slate-500' },
            { label: 'Imported', value: stats.import, icon: 'upload_file', accent: 'text-sky-600' },
          ]).map(s => (
            <div key={s.label} className="glass-panel rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
              <span className={`material-symbols-outlined text-[22px] leading-none ${s.accent} mb-3 block`}>{s.icon}</span>
              <p className="font-jakarta text-2xl font-extrabold text-slate-900 tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add contact drawer */}
      {showAdd && (
        <AddContactDrawer
          onSave={handleAddContact}
          onCancel={() => setShowAdd(false)}
          saving={addSaving}
        />
      )}

      {/* Search */}
      {!loading && contacts.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 leading-none pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-sm"
          />
        </div>
      )}

      {/* Loading / error / empty */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
          <span className="text-sm">Loading contacts…</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center gap-2 py-24 text-red-500 text-sm">
          <span className="material-symbols-outlined">error</span>
          {loadError}
        </div>
      )}

      {!loading && !loadError && contacts.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <span className="material-symbols-outlined text-[52px]">contacts</span>
          <p className="text-sm font-medium text-slate-500">No contacts yet</p>
          <p className="text-xs text-center max-w-xs text-slate-400">
            Add contacts manually when your team meets someone, or they&apos;ll appear here automatically when someone leaves their details via a card tap (coming soon).
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">person_add</span>
            Add your first contact
          </button>
        </div>
      )}

      {/* Contacts table */}
      {!loading && !loadError && contacts.length > 0 && (
        <>
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              No contacts match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Contact</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Email / Phone</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Their Company</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Source Card</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Added</th>
                    <th className="px-6 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(contact => (
                    <tr
                      key={contact.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/40 transition-colors"
                    >
                      {/* Contact name + source badge */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-teal-700">
                              {getInitials(contact.fullName)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {contact.fullName ?? <span className="text-slate-400 italic">No name</span>}
                            </p>
                            {contact.jobTitle && (
                              <p className="text-xs text-slate-400">{contact.jobTitle}</p>
                            )}
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SOURCE_STYLES[contact.source]}`}>
                              {SOURCE_LABELS[contact.source]}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email / phone */}
                      <td className="px-4 py-4">
                        <div className="space-y-0.5">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-xs text-teal-700 hover:underline block"
                            >
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                          {contact.whatsappNumber ? (
                            <a
                              href={`https://wa.me/${contact.whatsappNumber.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[12px] leading-none">chat</span>
                              {contact.whatsappNumber}
                            </a>
                          ) : contact.phone ? (
                            <span className="text-xs text-slate-500">{contact.phone}</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Their company */}
                      <td className="px-4 py-4">
                        <span className="text-xs text-slate-600">
                          {contact.companyName ?? <span className="text-slate-300">—</span>}
                        </span>
                      </td>

                      {/* Source card */}
                      <td className="px-4 py-4">
                        {contact.staffCardName ? (
                          <span className="text-xs text-slate-600 font-medium">{contact.staffCardName}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* Notes — inline editable */}
                      <td className="px-4 py-4 max-w-[200px]">
                        <NotesCell
                          contactId={contact.id}
                          initialNotes={contact.notes}
                          onSave={handleSaveNotes}
                        />
                      </td>

                      {/* Date added */}
                      <td className="px-4 py-4">
                        <span className="text-xs text-slate-400">{formatDate(contact.createdAt)}</span>
                      </td>

                      {/* Delete */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                          title="Delete contact"
                        >
                          <span className="material-symbols-outlined text-[16px] leading-none">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table footer */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  {filtered.length === contacts.length
                    ? `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`
                    : `${filtered.length} of ${contacts.length} contacts`}
                </p>
                {contacts.length > 0 && (
                  <button
                    onClick={() => exportToCsv(filtered)}
                    className="text-xs text-teal-600 hover:underline font-medium flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none">download</span>
                    Export CSV
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
