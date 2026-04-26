'use client'

// app/(onboard)/onboard/_components/StepCompany.tsx
//
// Step 2: Company details form.

import { useState } from 'react'
import type { WizardCompany } from '../_types'

const INDUSTRIES = [
  'Construction & Engineering',
  'Education',
  'Finance & Insurance',
  'Government',
  'Healthcare & Medical',
  'Hospitality & Tourism',
  'Legal',
  'Logistics & Transport',
  'Manufacturing',
  'Mining & Resources',
  'Non-profit',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Safety & PPE',
  'Technology',
  'Other',
]

interface StepCompanyProps {
  initial: WizardCompany | null
  onNext: (company: WizardCompany) => void
  onBack: () => void
}

export function StepCompany({ initial, onNext, onBack }: StepCompanyProps) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [industry, setIndustry] = useState(initial?.industry ?? '')
  const [website, setWebsite]   = useState(initial?.website ?? '')
  const [tagline, setTagline]   = useState(initial?.tagline ?? '')
  const [errors, setErrors]     = useState<Record<string, string>>({})

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim() || name.trim().length < 2) errs.name = 'Company name is required (min 2 characters).'
    if (!industry) errs.industry = 'Please select an industry.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (!validate()) return
    onNext({ name: name.trim(), industry, website: website.trim(), tagline: tagline.trim() })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold font-jakarta text-slate-900 mb-1">Your company</h2>
      <p className="text-slate-500 text-sm mb-8">
        This information will appear on your team's digital business cards.
      </p>

      <div className="space-y-5">
        {/* Company name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Company name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(prev => ({ ...prev, name: '' })) }}
            placeholder="e.g. Karam Africa"
            className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.name ? 'border-red-300' : 'border-slate-200'}`}
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        {/* Industry */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            value={industry}
            onChange={e => { setIndustry(e.target.value); setErrors(prev => ({ ...prev, industry: '' })) }}
            className={`w-full px-4 py-3 rounded-xl border text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white ${errors.industry ? 'border-red-300' : 'border-slate-200'}`}
          >
            <option value="">Select industry…</option>
            {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          {errors.industry && <p className="text-xs text-red-600 mt-1">{errors.industry}</p>}
        </div>

        {/* Website */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Website <span className="text-slate-400 font-normal normal-case">(optional)</span>
          </label>
          <input
            type="url"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder="https://your-company.co.za"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
          />
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Tagline <span className="text-slate-400 font-normal normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="e.g. Protecting people, empowering teams"
            maxLength={100}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
          />
          <p className="text-xs text-slate-400 mt-1">{tagline.length}/100</p>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm"
        >
          Continue to Account →
        </button>
      </div>
    </div>
  )
}
