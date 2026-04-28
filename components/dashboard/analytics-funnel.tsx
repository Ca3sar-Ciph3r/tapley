'use client'

import { useEffect, useState } from 'react'

export interface FunnelStep {
  label: string
  count: number
  pct: number
  color: string
}

interface AnalyticsFunnelProps {
  steps: FunnelStep[]
}

export function AnalyticsFunnel({ steps }: AnalyticsFunnelProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div key={step.label}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">
            {step.label}
          </p>

          <div className="relative w-full h-10 bg-slate-100 rounded-lg overflow-hidden">
            <div
              className="h-full rounded-lg flex items-center justify-end pr-3"
              style={{
                width: ready ? `${step.pct}%` : '0%',
                minWidth: ready && step.pct > 0 ? '60px' : '0',
                backgroundColor: step.color,
                transition: 'width 0.6s ease-out',
              }}
            >
              {step.pct > 0 && (
                <span className="text-white text-xs font-bold tabular-nums whitespace-nowrap">
                  {step.count.toLocaleString()} · {step.pct}%
                </span>
              )}
            </div>

            {step.pct === 0 && (
              <span className="absolute inset-0 flex items-center pl-3 text-slate-400 text-xs font-semibold tabular-nums">
                0 · 0%
              </span>
            )}
          </div>

          {i < steps.length - 1 && (
            <div className="flex items-center pl-3 py-1">
              <span className="text-slate-300 text-sm select-none">↓</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
