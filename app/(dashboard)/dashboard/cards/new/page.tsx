'use client'

// app/(dashboard)/dashboard/cards/new/page.tsx
//
// Rendering:  Client component — form state and interactivity.
// Auth:       Company Admin only.
//
// On submit:
//   1. Validate fields (full_name + job_title required)
//   2. Normalise phone numbers to E.164 on blur (SA format: 0821234567 → +27821234567)
//   3. Call createStaffCard server action
//   4. If send_invite is on: action also calls supabaseAdmin.inviteUserByEmail()
//   5. On success: redirect to /dashboard/cards/[newId] for further editing
//
// Department field uses a browser-native <datalist> populated from existing
// departments in the company's staff_cards (fetched on mount).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  createStaffCard,
  type CreateStaffCardInput,
} from '@/lib/actions/cards'
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormValues = {
  full_name: string
  job_title: string
  department: string
  email: string
  phone: string
  whatsapp_number: string
  send_invite: boolean
}

type FormErrors = Partial<Record<keyof FormValues, string>>

const EMPTY_FORM: FormValues = {
  full_name: '',
  job_title: '',
  department: '',
  email: '',
  phone: '',
  whatsapp_number: '',
  send_invite: false,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.full_name.trim()) {
    errors.full_name = 'Full name is required.'
  } else if (values.full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters.'
  }

  if (!values.job_title.trim()) {
    errors.job_title = 'Job title is required.'
  }

  if (values.email.trim() && !isValidEmail(values.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (values.send_invite && !values.email.trim()) {
    errors.email = 'An email address is required to send a login invite.'
  }

  return errors
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewCardPage() {
  const router = useRouter()
  const [values, setValues] = useState<FormValues>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [departments, setDepartments] = useState<string[]>([])

  // Load existing departments for the datalist autocomplete
  useEffect(() => {
    async function loadDepartments() {
      const supabase = createClient()
      const { data } = await supabase
        .from('staff_cards')
        .select('department')
        .eq('is_active', true)
        .not('department', 'is', null)

      if (data) {
        const unique = [...new Set(data.map(r => r.department as string))].sort()
        setDepartments(unique)
      }
    }
    loadDepartments()
  }, [])

  function set(field: keyof FormValues, value: string | boolean) {
    setValues(prev => ({ ...prev, [field]: value }))
    // Clear the error for this field as the user edits it
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Normalise phone number fields to E.164 on blur
  function handlePhoneBlur(field: 'phone' | 'whatsapp_number') {
    const raw = values[field].trim()
    if (!raw) return
    try {
      const normalised = normalisePhoneNumber(raw)
      setValues(prev => ({ ...prev, [field]: normalised }))
    } catch {
      // Leave as-is; server action will also normalise
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validation = validateForm(values)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      return
    }

    setSubmitting(true)

    const input: CreateStaffCardInput = {
      full_name: values.full_name,
      job_title: values.job_title,
      department: values.department,
      email: values.email,
      phone: values.phone,
      whatsapp_number: values.whatsapp_number,
      send_invite: values.send_invite,
    }

    const result = await createStaffCard(input)

    if (result.error) {
      setSubmitError(result.error)
      setSubmitting(false)
      return
    }

    // Redirect to edit page for the new card
    router.push(`/dashboard/cards/${result.id}`)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/cards"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Back to Team Cards"
        >
          <span className="material-symbols-outlined text-[22px] leading-none">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Add Staff Member</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Fill in the details below. You can add a photo and social links after saving.
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="glass-panel rounded-2xl border border-slate-200/50 p-8 space-y-6">
          {/* Row 1: Full name + Job title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="Full Name"
              required
              error={errors.full_name}
            >
              <input
                type="text"
                value={values.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="e.g. Sifiso Radebe"
                autoComplete="name"
                className={inputClass(!!errors.full_name)}
              />
            </Field>

            <Field
              label="Job Title"
              required
              error={errors.job_title}
            >
              <input
                type="text"
                value={values.job_title}
                onChange={e => set('job_title', e.target.value)}
                placeholder="e.g. Safety Officer"
                className={inputClass(!!errors.job_title)}
              />
            </Field>
          </div>

          {/* Row 2: Department */}
          <Field
            label="Department"
            hint="Optional — select an existing department or type a new one"
          >
            <input
              type="text"
              list="departments-list"
              value={values.department}
              onChange={e => set('department', e.target.value)}
              placeholder="e.g. Operations"
              className={inputClass(false)}
            />
            <datalist id="departments-list">
              {departments.map(dept => (
                <option key={dept} value={dept} />
              ))}
            </datalist>
          </Field>

          <hr className="border-slate-100" />

          {/* Row 3: Work email + Work phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="Work Email"
              hint="Required if sending a login invite"
              error={errors.email}
            >
              <input
                type="email"
                value={values.email}
                onChange={e => set('email', e.target.value)}
                placeholder="sifiso@company.co.za"
                autoComplete="email"
                className={inputClass(!!errors.email)}
              />
            </Field>

            <Field
              label="Work Phone"
              hint="SA format: 0821234567"
            >
              <input
                type="tel"
                value={values.phone}
                onChange={e => set('phone', e.target.value)}
                onBlur={() => handlePhoneBlur('phone')}
                placeholder="0821234567"
                autoComplete="tel"
                className={inputClass(false)}
              />
            </Field>
          </div>

          {/* Row 4: WhatsApp number */}
          <Field
            label="WhatsApp Number"
            hint="Leave blank to use the work phone number for WhatsApp"
          >
            <input
              type="tel"
              value={values.whatsapp_number}
              onChange={e => set('whatsapp_number', e.target.value)}
              onBlur={() => handlePhoneBlur('whatsapp_number')}
              placeholder="0821234567 (defaults to work phone)"
              className={inputClass(false)}
            />
          </Field>

          <hr className="border-slate-100" />

          {/* Send login invite toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Send Login Invite</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Sends an email invite so this staff member can log in and manage their own card.
                Requires a work email above.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values.send_invite}
              onClick={() => set('send_invite', !values.send_invite)}
              className={[
                'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/40',
                values.send_invite ? 'bg-teal-600' : 'bg-slate-200',
              ].join(' ')}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                  values.send_invite ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
          </div>

          {/* Server-side error */}
          {submitError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <span className="material-symbols-outlined text-[18px] leading-5 flex-shrink-0">error</span>
              {submitError}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Link
            href="/dashboard/cards"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none animate-spin">
                  progress_activity
                </span>
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px] leading-none">
                  person_add
                </span>
                Create Staff Member
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Field wrapper — label, hint, error, children
// ---------------------------------------------------------------------------

function inputClass(hasError: boolean): string {
  return [
    'w-full px-4 py-2.5 rounded-xl border text-sm bg-white/70 placeholder-slate-400 transition-shadow',
    'focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400',
    hasError
      ? 'border-red-300 focus:ring-red-300/30 focus:border-red-400'
      : 'border-slate-200',
  ].join(' ')
}

interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}

function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px] leading-none">error</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}
