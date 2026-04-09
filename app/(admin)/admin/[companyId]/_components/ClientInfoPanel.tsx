'use client'

// app/(admin)/admin/[companyId]/_components/ClientInfoPanel.tsx
//
// Displays primary contact details captured at onboarding.
// Luke can edit any field inline — no navigation required.
// Calls updateCompanyClientInfo server action on save.

import { useState } from 'react'
import { updateCompanyClientInfo } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientInfo = {
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  primary_contact_whatsapp: string | null
  website: string | null
  tagline: string | null
  internal_notes: string | null
}

type Props = {
  companyId: string
  info: ClientInfo
  onSaved: () => void
}

type FormState = {
  primaryContactName: string
  primaryContactEmail: string
  primaryContactPhone: string
  primaryContactWhatsapp: string
  website: string
  tagline: string
  internalNotes: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function infoToForm(info: ClientInfo): FormState {
  return {
    primaryContactName: info.primary_contact_name ?? '',
    primaryContactEmail: info.primary_contact_email ?? '',
    primaryContactPhone: info.primary_contact_phone ?? '',
    primaryContactWhatsapp: info.primary_contact_whatsapp ?? '',
    website: info.website ?? '',
    tagline: info.tagline ?? '',
    internalNotes: info.internal_notes ?? '',
  }
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-slate-800">{value || <span className="text-slate-400 italic">—</span>}</p>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClientInfoPanel({ companyId, info, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(infoToForm(info))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function set(field: keyof FormState) {
    return (value: string) => setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleEdit() {
    setForm(infoToForm(info))
    setSaveError(null)
    setEditing(true)
  }

  function handleCancel() {
    setEditing(false)
    setSaveError(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    const result = await updateCompanyClientInfo(companyId, {
      primaryContactName: form.primaryContactName || null,
      primaryContactEmail: form.primaryContactEmail || null,
      primaryContactPhone: form.primaryContactPhone || null,
      primaryContactWhatsapp: form.primaryContactWhatsapp || null,
      website: form.website || null,
      tagline: form.tagline || null,
      internalNotes: form.internalNotes || null,
    })

    setSaving(false)

    if (result.error) {
      setSaveError(result.error)
      return
    }

    setEditing(false)
    onSaved()
  }

  return (
    <div className="glass-panel rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-jakarta text-base font-bold text-slate-900">Client Info</h2>
          <p className="text-xs text-slate-400 mt-0.5">Primary contact and account details captured at onboarding</p>
        </div>
        {!editing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">edit</span>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        /* Edit mode */
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <InputField
              label="Primary Contact Name"
              value={form.primaryContactName}
              onChange={set('primaryContactName')}
              placeholder="e.g. Jamie Lee"
            />
            <InputField
              label="Contact Email"
              value={form.primaryContactEmail}
              onChange={set('primaryContactEmail')}
              type="email"
              placeholder="e.g. jamie@karamafrica.co.za"
            />
            <InputField
              label="Contact Phone"
              value={form.primaryContactPhone}
              onChange={set('primaryContactPhone')}
              placeholder="e.g. +27821234567"
            />
            <InputField
              label="WhatsApp Number"
              value={form.primaryContactWhatsapp}
              onChange={set('primaryContactWhatsapp')}
              placeholder="e.g. +27821234567"
            />
            <InputField
              label="Website"
              value={form.website}
              onChange={set('website')}
              placeholder="e.g. https://karamafrica.co.za"
            />
            <InputField
              label="Tagline"
              value={form.tagline}
              onChange={set('tagline')}
              placeholder="e.g. Safety you can rely on"
            />
          </div>

          {/* Internal notes — full width */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Internal Notes <span className="text-slate-300 font-normal normal-case">(super admin only)</span>
            </label>
            <textarea
              value={form.internalNotes}
              onChange={e => set('internalNotes')(e.target.value)}
              rows={3}
              placeholder="Anything worth remembering about this account…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white resize-none"
            />
          </div>

          {/* Action row */}
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{saveError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {saving && (
                <span className="material-symbols-outlined text-[16px] leading-none animate-spin">
                  progress_activity
                </span>
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Read mode */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Primary Contact" value={info.primary_contact_name} />
          <Field label="Contact Email" value={info.primary_contact_email} />
          <Field label="Contact Phone" value={info.primary_contact_phone} />
          <Field label="WhatsApp Number" value={info.primary_contact_whatsapp} />
          <Field label="Website" value={info.website} />
          <Field label="Tagline" value={info.tagline} />
          {info.internal_notes && (
            <div className="md:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Internal Notes</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                {info.internal_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
