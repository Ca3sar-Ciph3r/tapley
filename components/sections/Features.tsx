'use client'

import { motion } from 'framer-motion'
import {
  Shuffle, Wifi, Pencil, LayoutDashboard, BarChart2, Contact, Shield,
} from 'lucide-react'
import { BentoGrid, BentoCard } from '@/components/magic/BentoGrid'
import { FadeUp } from '@/components/shared/FadeUp'

const ICON_MAP: Record<string, React.ElementType> = {
  Shuffle, Wifi, Pencil, LayoutDashboard, BarChart2, Contact, Shield,
}

const features = [
  {
    id: 'reassignment',
    icon: 'Shuffle',
    title: 'Instant Profile Reassignment',
    description: 'Tap any card to any profile. Works in real-time. No reprint. No delay. No waste.',
    badge: 'Core feature',
    colSpan: 2 as const,
    visual: (
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#C8FF00]/20 bg-[#C8FF00]/5 p-3">
        <div className="rounded-md border border-[#222222] bg-[#111111] px-3 py-1.5 text-xs text-[#888888] line-through">
          Sarah K.
        </div>
        <motion.div
          animate={{ x: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-[#C8FF00]"
        >
          →
        </motion.div>
        <div className="rounded-md border border-[#C8FF00]/30 bg-[#C8FF00]/10 px-3 py-1.5 text-xs text-[#C8FF00]">
          Jake M.
        </div>
        <span className="ml-auto rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-xs text-[#22c55e]">
          30s
        </span>
      </div>
    ),
  },
  {
    id: 'nfc-qr',
    icon: 'Wifi',
    title: 'NFC + QR Dual Mode',
    description: '100% phone compatibility. Tap or scan — your choice.',
    colSpan: 1 as const,
    visual: (
      <div className="mt-4 flex gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-[#1a1a1a] p-3">
          <Wifi size={20} className="text-[#C8FF00]" />
          <span className="text-xs text-[#888888]">NFC Tap</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-lg bg-[#1a1a1a] p-3">
          <div className="grid grid-cols-3 gap-0.5">
            {Array(9).fill(0).map((_, i) => (
              <div key={i} className={`h-2 w-2 rounded-sm ${i % 3 === 0 || i === 4 ? 'bg-[#C8FF00]' : 'bg-[#333]'}`} />
            ))}
          </div>
          <span className="text-xs text-[#888888]">QR Scan</span>
        </div>
      </div>
    ),
  },
  {
    id: 'profile-editor',
    icon: 'Pencil',
    title: 'Live Profile Editor',
    description: 'Update phone, title, links — instantly live on every linked card.',
    colSpan: 1 as const,
  },
  {
    id: 'dashboard',
    icon: 'LayoutDashboard',
    title: 'Team Dashboard',
    description: 'All cards, all profiles, all assignments in one view.',
    colSpan: 1 as const,
  },
  {
    id: 'analytics',
    icon: 'BarChart2',
    title: 'Analytics & Tap Tracking',
    description: 'Know who\'s getting tapped, when, and from where.',
    colSpan: 1 as const,
  },
  {
    id: 'vcf',
    icon: 'Contact',
    title: 'vCard / Contact Save',
    description: 'One tap and they\'re saved to the recipient\'s phone. No app needed.',
    colSpan: 1 as const,
  },
  {
    id: 'popia',
    icon: 'Shield',
    title: 'POPIA-Compliant',
    description: 'Built for South Africa. Data handling, consent flows, and storage designed to POPIA standards.',
    badge: 'South Africa ✓',
    colSpan: 2 as const,
  },
]

export function Features() {
  return (
    <section id="features" className="bg-[#080808] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Features
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              Everything your team needs.
              <br />
              <span className="text-[#888888]">Nothing they don&apos;t.</span>
            </h2>
          </FadeUp>
        </div>

        <BentoGrid>
          {features.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon]
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ scale: 1.02 }}
                className={feature.colSpan === 2 ? 'lg:col-span-2' : ''}
              >
                <BentoCard className="h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8FF00]/10">
                      <Icon size={18} className="text-[#C8FF00]" />
                    </div>
                    {feature.badge && (
                      <span className="rounded-full border border-[#C8FF00]/20 bg-[#C8FF00]/5 px-2.5 py-0.5 text-xs text-[#C8FF00]">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 font-syne text-base font-semibold text-[#F5F5F5]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#888888]">{feature.description}</p>
                  {feature.visual && feature.visual}
                </BentoCard>
              </motion.div>
            )
          })}
        </BentoGrid>
      </div>
    </section>
  )
}
