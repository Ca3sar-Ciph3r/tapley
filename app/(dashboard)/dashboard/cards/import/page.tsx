'use client'

// app/(dashboard)/dashboard/cards/import/page.tsx
//
// Rendering:  Client component — file reading, CSV parsing, and step transitions
//             are all browser-side. The server action fires on the final confirm step.
// Auth:       Company Admin only. RLS on staff_cards scopes the insert.
// Supabase:   No direct Supabase calls here — all DB work is in the server action.
//
// Three-step wizard:
//   Step 1 — Upload:  Drop zone or file picker. Parse CSV in the browser.
//   Step 2 — Preview: Validation table. Admin reviews errors. Confirms import.
//   Step 3 — Done:    Results summary. Links back to cards list.
//
// CSV format (flexible header matching):
//   full_name*, job_title*, department, email, phone, whatsapp_number
//   (* required)
//   See lib/utils/csv.ts for all header aliases.

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { parseStaffCSV, buildCSVTemplate, type ParsedStaffRow } from '@/lib/utils/csv'
import { bulkImportStaffCards, type ImportRow, type ImportResult } from '@/lib/actions/bulk-import'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'upload' | 'preview' | 'done'

// ---------------------------------------------------------------------------
// Step 1 — Upload
// ---------------------------------------------------------------------------

interface UploadStepProps {
  onParsed: (rows: ParsedStaffRow[], fileName: string) => void
  onError: (msg: string) => void
}

function UploadStep({ onParsed, onError }: UploadStepProps) {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function downloadTemplate() {
    const csv = buildCSVTemplate()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tapley-staff-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      onError('Please upload a .csv file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('File is too large. Maximum size is 5MB.')
      return
    }

    setParsing(true)
    try {
      const text = await file.text()
      const { rows, missingRequired, unknownHeaders } = parseStaffCSV(text)

      if (missingRequired.length > 0) {
        onError(
          `Required column(s) missing from your CSV: ${missingRequired.join(', ')}. ` +
          `Download the template to see the correct format.`
        )
        setParsing(false)
        return
      }

      if (rows.length === 0) {
        onError('The file has no data rows. Add staff records below the header row.')
        setParsing(false)
        return
      }

      if (unknownHeaders.length > 0) {
        // Informational only — don't block
        console.info('[CSV import] Unknown headers (ignored):', unknownHeaders)
      }

      onParsed(rows, file.name)
    } catch {
      onError('Could not read the file. Make sure it is a valid CSV.')
    }
    setParsing(false)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          'relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed cursor-pointer transition-all p-16',
          dragging
            ? 'border-teal-400 bg-teal-50'
            : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) processFile(file)
            e.target.value = '' // reset so the same file can be picked again
          }}
        />

        {parsing ? (
          <>
            <span className="material-symbols-outlined text-[48px] text-teal-500 animate-spin">
              progress_activity
            </span>
            <p className="text-sm font-semibold text-slate-600">Parsing CSV…</p>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[48px] text-slate-300">
              upload_file
            </span>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-700">
                Drop your CSV here, or click to browse
              </p>
              <p className="text-sm text-slate-400 mt-1">
                .csv only · max 5MB · up to 999 rows
              </p>
            </div>
          </>
        )}
      </div>

      {/* Template download */}
      <div className="glass-panel rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Need a template?</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Download a pre-formatted CSV with an example row
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">download</span>
          Download Template
        </button>
      </div>

      {/* Column guide */}
      <div className="glass-panel rounded-2xl p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Expected Columns
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            { col: 'full_name', required: true, note: 'e.g. Jane Smith' },
            { col: 'job_title', required: true, note: 'e.g. Sales Manager' },
            { col: 'department', required: false, note: 'e.g. Sales' },
            { col: 'email', required: false, note: 'Work email address' },
            { col: 'phone', required: false, note: '0821234567 or +27…' },
            { col: 'whatsapp_number', required: false, note: 'Defaults to phone' },
          ].map(({ col, required, note }) => (
            <div key={col} className="flex items-start gap-2">
              <span
                className={[
                  'mt-0.5 inline-block w-2 h-2 rounded-full flex-shrink-0',
                  required ? 'bg-teal-500' : 'bg-slate-300',
                ].join(' ')}
              />
              <div>
                <p className="font-mono text-xs font-semibold text-slate-700">{col}</p>
                <p className="text-[11px] text-slate-400">{note}</p>
                {required && (
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Required</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Preview / Validation
// ---------------------------------------------------------------------------

interface PreviewStepProps {
  rows: ParsedStaffRow[]
  fileName: string
  onConfirm: (validRows: ImportRow[]) => Promise<void>
  onReset: () => void
  importing: boolean
}

function PreviewStep({ rows, fileName, onConfirm, onReset, importing }: PreviewStepProps) {
  const validRows = rows.filter(r => r.errors.length === 0)
  const errorRows = rows.filter(r => r.errors.length > 0)
  const [showErrors, setShowErrors] = useState(true)

  function buildImportRows(): ImportRow[] {
    return validRows.map(r => ({
      full_name: r.full_name,
      job_title: r.job_title,
      department: r.department,
      email: r.email,
      phone: r.phone,
      whatsapp_number: r.whatsapp_number,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="glass-panel rounded-2xl p-6 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">File</p>
          <p className="text-sm font-semibold text-slate-700 font-mono">{fileName}</p>
        </div>
        <div className="h-8 w-px bg-slate-200 hidden md:block" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Rows</p>
          <p className="text-2xl font-bold font-jakarta text-slate-900">{rows.length}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Ready to Import</p>
          <p className="text-2xl font-bold font-jakarta text-emerald-600">{validRows.length}</p>
        </div>
        {errorRows.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Has Errors</p>
            <p className="text-2xl font-bold font-jakarta text-red-500">{errorRows.length}</p>
          </div>
        )}
      </div>

      {/* Error rows callout */}
      {errorRows.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600">
              <span className="material-symbols-outlined text-[18px] leading-none">warning</span>
              <span className="text-sm font-semibold">
                {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} will be skipped due to errors
              </span>
            </div>
            <button
              onClick={() => setShowErrors(v => !v)}
              className="text-xs text-red-400 hover:text-red-600 font-semibold"
            >
              {showErrors ? 'Hide' : 'Show'}
            </button>
          </div>
          {showErrors && (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {errorRows.map(r => (
                <li key={r.rowIndex} className="text-xs text-red-700 flex items-start gap-2">
                  <span className="font-bold flex-shrink-0">Row {r.rowIndex}:</span>
                  <span>
                    {r.full_name ? `"${r.full_name}" — ` : ''}
                    {r.errors.join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Preview table */}
      {validRows.length > 0 && (
        <div className="glass-panel rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900">
              Preview — {validRows.length} valid row{validRows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Title</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Dept</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Phone</th>
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 50).map(row => (
                  <tr key={row.rowIndex} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-semibold text-slate-900">{row.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.job_title}</td>
                    <td className="px-4 py-3 text-slate-500">{row.department ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{row.email ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{row.phone ?? '—'}</td>
                  </tr>
                ))}
                {validRows.length > 50 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-3 text-xs text-slate-400 text-center">
                      … and {validRows.length - 50} more rows not shown
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {validRows.length > 0 ? (
          <button
            onClick={() => onConfirm(buildImportRows())}
            disabled={importing}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {importing ? (
              <span className="material-symbols-outlined text-[16px] leading-none animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[16px] leading-none">upload</span>
            )}
            {importing
              ? `Importing ${validRows.length} staff cards…`
              : `Import ${validRows.length} staff card${validRows.length !== 1 ? 's' : ''}`}
          </button>
        ) : (
          <p className="text-sm text-red-600 font-semibold">
            No valid rows to import — fix the errors in your CSV and try again.
          </p>
        )}
        <button
          onClick={onReset}
          disabled={importing}
          className="px-5 py-2.5 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Upload a different file
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Done
// ---------------------------------------------------------------------------

interface DoneStepProps {
  result: ImportResult
  onReset: () => void
}

function DoneStep({ result, onReset }: DoneStepProps) {
  return (
    <div className="space-y-6">
      {/* Result summary */}
      <div className="glass-panel rounded-3xl p-10 flex flex-col items-center gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <span className="material-symbols-outlined text-[36px] text-emerald-500">check_circle</span>
        </div>
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-slate-900 mb-1">Import Complete</h2>
          <p className="text-sm text-slate-500">
            {result.created} staff card{result.created !== 1 ? 's' : ''} created
            {result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold font-jakarta text-emerald-600">{result.created}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">Created</p>
          </div>
          {result.skipped > 0 && (
            <>
              <div className="h-10 w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-3xl font-bold font-jakarta text-slate-400">{result.skipped}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">Skipped</p>
              </div>
            </>
          )}
        </div>

        {result.cappedByPlanLimit && (
          <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-4 text-left">
            <div className="flex items-start gap-2 text-amber-700">
              <span className="material-symbols-outlined text-[18px] leading-none flex-shrink-0 mt-0.5">info</span>
              <p className="text-sm">
                <strong>{result.cappedCount} row{result.cappedCount !== 1 ? 's' : ''}</strong> were not imported
                because you reached your plan's staff card limit.
                Contact Tapley Connect to upgrade your plan.
              </p>
            </div>
          </div>
        )}

        {result.errors.length > 0 && (
          <div className="w-full bg-red-50 border border-red-100 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold text-red-700">
              {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} failed to insert:
            </p>
            <ul className="space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-600">
                  <strong>{e.name}</strong> — {e.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.skipped > 0 && !result.cappedByPlanLimit && (
          <p className="text-xs text-slate-400 text-center">
            Skipped rows had an email that already exists for a staff card in your company.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/cards"
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px] leading-none">groups</span>
          View Team Cards
        </Link>
        <button
          onClick={onReset}
          className="px-5 py-2.5 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors"
        >
          Import another file
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'upload', label: 'Upload' },
    { key: 'preview', label: 'Preview' },
    { key: 'done', label: 'Done' },
  ]

  const currentIndex = steps.findIndex(s => s.key === step)

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                active ? 'bg-teal-100 text-teal-700' :
                done ? 'bg-slate-100 text-emerald-600' :
                'text-slate-400',
              ].join(' ')}
            >
              {done ? (
                <span className="material-symbols-outlined text-[14px] leading-none">check</span>
              ) : (
                <span className="text-[11px]">{i + 1}</span>
              )}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <span className="material-symbols-outlined text-[16px] text-slate-200">
                chevron_right
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BulkImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedStaffRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  function handleParsed(parsedRows: ParsedStaffRow[], name: string) {
    setRows(parsedRows)
    setFileName(name)
    setParseError(null)
    setStep('preview')
  }

  function handleReset() {
    setStep('upload')
    setRows([])
    setFileName('')
    setParseError(null)
    setImportResult(null)
    setImportError(null)
  }

  async function handleConfirm(validRows: ImportRow[]) {
    setImporting(true)
    setImportError(null)

    const { result, error } = await bulkImportStaffCards(validRows)

    if (error || !result) {
      setImportError(error ?? 'An unexpected error occurred. Please try again.')
      setImporting(false)
      return
    }

    setImportResult(result)
    setImporting(false)
    setStep('done')
  }

  return (
    <div className="px-12 py-12 max-w-4xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/cards"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] leading-none">arrow_back</span>
              Team Cards
            </Link>
          </div>
          <h1 className="font-jakarta text-2xl font-bold text-slate-900">Bulk Import Staff</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload a CSV to add multiple staff cards at once
          </p>
        </div>
        <StepIndicator step={step} />
      </div>

      {/* Parse error */}
      {parseError && (
        <div className="mb-6 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
          <span className="material-symbols-outlined text-[18px] leading-none flex-shrink-0 mt-0.5">error</span>
          <div>
            <p className="font-semibold">Could not parse CSV</p>
            <p className="mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div className="mb-6 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
          <span className="material-symbols-outlined text-[18px] leading-none flex-shrink-0 mt-0.5">error</span>
          <div>
            <p className="font-semibold">Import failed</p>
            <p className="mt-0.5">{importError}</p>
          </div>
        </div>
      )}

      {/* Step content */}
      {step === 'upload' && (
        <UploadStep
          onParsed={handleParsed}
          onError={msg => { setParseError(msg) }}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          rows={rows}
          fileName={fileName}
          onConfirm={handleConfirm}
          onReset={handleReset}
          importing={importing}
        />
      )}

      {step === 'done' && importResult && (
        <DoneStep result={importResult} onReset={handleReset} />
      )}
    </div>
  )
}
