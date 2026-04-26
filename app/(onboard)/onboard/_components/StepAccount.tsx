'use client'

// app/(onboard)/onboard/_components/StepAccount.tsx
//
// Step 3: Create admin account.
// Calls supabase.auth.signUp() then createPendingCompany() server action.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createPendingCompany } from '@/lib/actions/self-service-onboarding'
import { normalisePhoneNumber } from '@/lib/utils/whatsapp'
import type { WizardAccount, WizardCompany, WizardPlan } from '../_types'

interface StepAccountProps {
  initial: WizardAccount | null
  plan:    WizardPlan
  company: WizardCompany
  onNext:  (account: WizardAccount, companyId: string) => void
  onBack:  () => void
}

type AccountState = 'form' | 'confirm_email' | 'submitting'

export function StepAccount({ initial, plan, company, onNext, onBack }: StepAccountProps) {
  const [firstName,  setFirstName]  = useState(initial?.firstName ?? '')
  const [lastName,   setLastName]   = useState(initial?.lastName ?? '')
  const [email,      setEmail]      = useState(initial?.email ?? '')
  const [password,   setPassword]   = useState('')
  const [phone,      setPhone]      = useState(initial?.phone ?? '')
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const [state,      setState]      = useState<AccountState>('form')
  const [serverErr,  setServerErr]  = useState<string | null>(null)

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!firstName.trim()) errs.firstName = 'First name is required.'
    if (!lastName.trim())  errs.lastName  = 'Last name is required.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Enter a valid email address.'
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handlePhoneBlur() {
    if (!phone.trim()) return
    try { setPhone(normalisePhoneNumber(phone)) } catch { /* leave as-is */ }
  }

  async function handleSubmit() {
    if (!validate()) return
    setState('submitting')
    setServerErr(null)

    const supabase = createClient()
    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: { full_name: fullName, phone: phone.trim() || undefined },
      },
    })

    if (signUpError) {
      setServerErr(signUpError.message)
      setState('form')
      return
    }

    // If email confirmation is required, session will be null
    if (!signUpData.session) {
      setState('confirm_email')
      return
    }

    await finishAccountCreation(fullName)
  }

  async function handleEmailConfirmed() {
    setState('submitting')
    setServerErr(null)

    const supabase = createClient()
    const { error: sessionError } = await supabase.auth.getSession()
    if (sessionError) {
      setServerErr('Could not verify session. Please try again.')
      setState('confirm_email')
      return
    }

    await finishAccountCreation(`${firstName.trim()} ${lastName.trim()}`)
  }

  async function finishAccountCreation(fullName: string) {
    const result = await createPendingCompany({
      companyName:    company.name,
      industry:       company.industry,
      website:        company.website,
      tagline:        company.tagline,
      tierName:       plan.tierName,
      cardCount:      plan.cardCount,
      isQrDigital:    plan.isQrDigital,
      billingCycle:   plan.billingCycle,
      monthlyTotalZar: plan.monthlyTotalZar,
    })

    if (result.error || !result.companyId) {
      setServerErr(result.error ?? 'Failed to create company. Please try again.')
      setState('form')
      return
    }

    onNext(
      { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim() },
      result.companyId,
    )
  }

  if (state === 'confirm_email') {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px] text-teal-600">mark_email_unread</span>
        </div>
        <h2 className="text-xl font-bold font-jakarta text-slate-900 mb-2">Check your inbox</h2>
        <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
          We sent a confirmation link to <strong>{email}</strong>. Click the link in the email, then come back here.
        </p>
        {serverErr && <p className="text-sm text-red-600 mb-4">{serverErr}</p>}
        <button
          type="button"
          onClick={handleEmailConfirmed}
          disabled={state === 'submitting'}
          className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          I've confirmed my email →
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold font-jakarta text-slate-900 mb-1">Create your account</h2>
      <p className="text-slate-500 text-sm mb-8">
        This will be the admin account for <strong>{company.name}</strong>.
      </p>

      <div className="space-y-5">
        {/* First + Last name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              First name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: '' })) }}
              autoComplete="given-name"
              className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.firstName ? 'border-red-300' : 'border-slate-200'}`}
            />
            {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Last name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: '' })) }}
              autoComplete="family-name"
              className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.lastName ? 'border-red-300' : 'border-slate-200'}`}
            />
            {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Work email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
            placeholder="you@company.co.za"
            autoComplete="email"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.email ? 'border-red-300' : 'border-slate-200'}`}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.password ? 'border-red-300' : 'border-slate-200'}`}
          />
          {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Phone / WhatsApp <span className="text-slate-400 font-normal normal-case">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={handlePhoneBlur}
            placeholder="0821234567"
            autoComplete="tel"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
          />
        </div>
      </div>

      {serverErr && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          {serverErr}
        </div>
      )}

      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          disabled={state === 'submitting'}
          className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={state === 'submitting'}
          className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          {state === 'submitting' ? 'Creating account…' : 'Create account →'}
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center mt-4">
        By creating an account you agree to our{' '}
        <a href="/terms" className="underline text-slate-500">Terms</a> and{' '}
        <a href="/privacy" className="underline text-slate-500">Privacy Policy</a>.
        Your data is protected under POPIA.
      </p>
    </div>
  )
}
