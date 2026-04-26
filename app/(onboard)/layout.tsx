// app/(onboard)/layout.tsx
//
// Minimal public layout for the self-service onboarding wizard.
// No auth guard — publicly accessible.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started — Tapley Connect',
  description: 'Set up your company's digital business cards in minutes.',
}

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {children}
    </div>
  )
}
