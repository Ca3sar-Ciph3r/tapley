import { cn } from '@/lib/utils'
import React from 'react'

interface PhoneMockupProps {
  children?: React.ReactNode
  className?: string
}

export function PhoneMockup({ children, className }: PhoneMockupProps) {
  return (
    <div
      className={cn(
        'relative mx-auto flex w-[280px] flex-col overflow-hidden rounded-[40px] border-[8px] border-[#1a1a1a] bg-[#111111] shadow-[0_0_60px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.05)]',
        className
      )}
    >
      {/* Notch */}
      <div className="relative flex h-7 w-full items-center justify-center bg-[#1a1a1a]">
        <div className="h-4 w-20 rounded-full bg-[#080808]" />
      </div>
      {/* Screen */}
      <div className="relative flex-1 overflow-hidden bg-[#080808]">
        {children}
      </div>
      {/* Home indicator */}
      <div className="flex h-6 w-full items-center justify-center bg-[#1a1a1a]">
        <div className="h-1 w-20 rounded-full bg-[#333]" />
      </div>
    </div>
  )
}
