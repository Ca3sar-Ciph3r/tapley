'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Building2, Users, CalendarCheck, Briefcase } from 'lucide-react'
import { FadeUp } from '@/components/shared/FadeUp'
import Link from 'next/link'

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp, Building2, Users, CalendarCheck, Briefcase,
}

const useCases = [
  {
    id: 'sales',
    icon: 'TrendingUp',
    title: 'Sales Teams',
    headline: 'Close faster. Never fumble for a card again.',
    body: 'Sales reps tap phones, share profiles, get saved instantly. CRM links, LinkedIn, WhatsApp — all in one tap.',
    cta: 'Built for sales →',
  },
  {
    id: 'franchise',
    icon: 'Building2',
    title: 'Franchises & Multi-Location',
    headline: 'One dashboard. Every location.',
    body: 'Assign and manage cards for every branch from HQ. Staff changes at a franchise don\'t require head office visits.',
    cta: 'Franchise solution →',
    badge: 'Perfect for Karam Africa-style businesses',
  },
  {
    id: 'onboarding',
    icon: 'Users',
    title: 'Corporate Onboarding',
    headline: 'Day 1 ready. Card included.',
    body: 'New hire walks in. Their card is pre-ordered, their profile is ready. Tap. Done.',
    cta: 'Streamline onboarding →',
  },
  {
    id: 'events',
    icon: 'CalendarCheck',
    title: 'Events & Expos',
    headline: 'Every expo. Same cards. Different staff.',
    body: 'Bring 10 cards to any event. Assign whoever\'s attending that day. Collect analytics on who tapped after.',
    cta: 'Event use case →',
  },
  {
    id: 'professional',
    icon: 'Briefcase',
    title: 'Professional Services',
    headline: 'Your brand. Your trust. On every card.',
    body: 'Lawyers, accountants, consultants — your firm card, their profile. Consistent brand no matter who hands it over.',
    cta: 'For professionals →',
  },
]

export function UseCases() {
  const [activeTab, setActiveTab] = useState(0)
  const active = useCases[activeTab]
  const Icon = ICON_MAP[active.icon]

  return (
    <section id="use-cases" className="bg-[#080808] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Use Cases
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              Built for every kind of team.
            </h2>
          </FadeUp>
        </div>

        {/* Tab selector */}
        <FadeUp delay={0.15}>
          <div className="mb-8 flex gap-2 overflow-x-auto pb-2 lg:justify-center">
            {useCases.map((uc, i) => {
              const TabIcon = ICON_MAP[uc.icon]
              return (
                <button
                  key={uc.id}
                  onClick={() => setActiveTab(i)}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm transition-all ${
                    activeTab === i
                      ? 'bg-[#C8FF00] font-semibold text-black'
                      : 'border border-[#222222] text-[#888888] hover:border-[#2e2e2e] hover:text-[#F5F5F5]'
                  }`}
                >
                  <TabIcon size={14} />
                  {uc.title}
                </button>
              )
            })}
          </div>
        </FadeUp>

        {/* Content panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden rounded-2xl border border-[#222222] bg-[#111111]"
          >
            <div className="grid lg:grid-cols-2">
              {/* Text */}
              <div className="p-8 lg:p-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8FF00]/10">
                  <Icon size={22} className="text-[#C8FF00]" />
                </div>

                {active.badge && (
                  <span className="mt-4 inline-block rounded-full border border-[#C8FF00]/20 bg-[#C8FF00]/5 px-3 py-1 text-xs text-[#C8FF00]">
                    {active.badge}
                  </span>
                )}

                <h3 className="mt-4 font-syne text-2xl font-bold text-[#F5F5F5] lg:text-3xl">
                  {active.headline}
                </h3>
                <p className="mt-4 text-[#888888]">{active.body}</p>

                <Link
                  href="/login"
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#C8FF00] px-6 py-3 font-syne text-sm font-bold text-black transition hover:bg-[#9DC400]"
                >
                  {active.cta}
                </Link>
              </div>

              {/* Visual mockup */}
              <div className="flex items-center justify-center border-t border-[#222222] bg-[#1a1a1a] p-8 lg:border-l lg:border-t-0">
                <UseCaseMockup useCase={active} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

function UseCaseMockup({ useCase }: { useCase: typeof useCases[number] }) {
  const Icon = ICON_MAP[useCase.icon]
  return (
    <div className="w-full max-w-xs">
      <div className="rounded-xl border border-[#222222] bg-[#111111] p-5">
        <div className="flex items-center gap-3 border-b border-[#222222] pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8FF00]/10">
            <Icon size={14} className="text-[#C8FF00]" />
          </div>
          <div>
            <div className="h-2 w-24 rounded-full bg-[#F5F5F5]/60" />
            <div className="mt-1.5 h-1.5 w-16 rounded-full bg-[#555555]/60" />
          </div>
          <span className="ml-auto rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-xs text-[#22c55e]">
            Live
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-[#1a1a1a] p-2.5">
              <div className="h-7 w-7 rounded-full bg-[#C8FF00]/10" />
              <div>
                <div className="h-2 w-20 rounded-full bg-[#888888]/40" />
                <div className="mt-1 h-1.5 w-14 rounded-full bg-[#555555]/40" />
              </div>
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C8FF00]" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-full bg-[#C8FF00] py-2.5 text-center font-syne text-xs font-bold text-black">
          Tap to share →
        </div>
      </div>
    </div>
  )
}
