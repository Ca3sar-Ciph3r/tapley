import { cn } from '@/lib/utils'
import React from 'react'

interface BentoGridProps {
  children: React.ReactNode
  className?: string
}

interface BentoCardProps {
  children: React.ReactNode
  className?: string
  colSpan?: 1 | 2 | 3
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {children}
    </div>
  )
}

export function BentoCard({ children, className, colSpan = 1 }: BentoCardProps) {
  const colSpanClass = {
    1: 'col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
  }[colSpan]

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-[#222222] bg-[#111111] p-6 transition-all duration-300 hover:border-[#2e2e2e] hover:shadow-[0_0_30px_rgba(200,255,0,0.05)]',
        colSpanClass,
        className
      )}
    >
      {children}
    </div>
  )
}
