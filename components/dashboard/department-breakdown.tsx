'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeptStats = {
  department: string
  staffCount: number
  totalViews: number
  waClicks: number
  vcfDownloads: number
  topCard: { name: string; views: number; photo_url: string | null } | null
}

interface DepartmentBreakdownProps {
  deptStats: DeptStats[]
  activeDept: string | null
  onDeptClick: (dept: string | null) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 8

export function DepartmentBreakdown({ deptStats, activeDept, onDeptClick }: DepartmentBreakdownProps) {
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? deptStats : deptStats.slice(0, MAX_VISIBLE)
  const hasMore = deptStats.length > MAX_VISIBLE

  return (
    <div className="glass-panel p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-jakarta text-lg font-bold text-slate-900">By department</h2>
          <p className="text-xs text-slate-500 mt-0.5">Views grouped by team · last 30 days</p>
        </div>
        {activeDept !== null && (
          <button
            onClick={() => onDeptClick(null)}
            className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px] leading-none">close</span>
            All departments
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-3 pr-4 whitespace-nowrap">
                Department
              </th>
              <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-3 px-4 whitespace-nowrap">
                Views
              </th>
              <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-3 px-4 whitespace-nowrap">
                WA Taps
              </th>
              <th className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-3 px-4 whitespace-nowrap">
                Saves
              </th>
              <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 pb-3 pl-4 whitespace-nowrap">
                Top member
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(dept => {
              const isActive = activeDept === dept.department
              return (
                <tr
                  key={dept.department}
                  onClick={() => onDeptClick(isActive ? null : dept.department)}
                  className={[
                    'border-b border-slate-50 last:border-0 cursor-pointer transition-colors',
                    isActive ? 'bg-teal-50/60' : 'hover:bg-slate-50/60',
                  ].join(' ')}
                >
                  {/* Department name + staff count pill */}
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">{dept.department}</span>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full tabular-nums">
                        {dept.staffCount}
                      </span>
                    </div>
                  </td>

                  {/* Views */}
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                    {dept.totalViews}
                  </td>

                  {/* WA Taps */}
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-600 tabular-nums">
                    {dept.waClicks}
                  </td>

                  {/* VCF Saves */}
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-600 tabular-nums">
                    {dept.vcfDownloads}
                  </td>

                  {/* Top member avatar + name */}
                  <td className="py-3.5 pl-4">
                    {dept.topCard ? (
                      <div className="flex items-center gap-2">
                        {dept.topCard.photo_url ? (
                          <img
                            src={dept.topCard.photo_url}
                            alt={dept.topCard.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0 ring-2 ring-white shadow-sm">
                            {initials(dept.topCard.name)}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-slate-700 truncate max-w-[120px]">
                          {dept.topCard.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Show all toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px] leading-none">
            {showAll ? 'expand_less' : 'expand_more'}
          </span>
          {showAll ? 'Show less' : `Show all ${deptStats.length} departments`}
        </button>
      )}
    </div>
  )
}
