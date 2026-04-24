'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, Mail, Link2, MessageCircle, UserPlus, Eye } from 'lucide-react'
import { PhoneMockup } from '@/components/magic/PhoneMockup'
import { FadeUp } from '@/components/shared/FadeUp'

const profiles = [
  {
    name: 'Karam Sader',
    title: 'Director',
    company: 'KARAM AFRICA',
    initial: 'KS',
    color: '#C8FF00',
    views: 47,
  },
  {
    name: 'Sarah K.',
    title: 'Marketing Lead',
    company: 'KARAM AFRICA',
    initial: 'SK',
    color: '#60a5fa',
    views: 31,
  },
  {
    name: 'Jake M.',
    title: 'Sales Manager',
    company: 'KARAM AFRICA',
    initial: 'JM',
    color: '#a78bfa',
    views: 23,
  },
]

export function Demo() {
  const [activeProfile, setActiveProfile] = useState(0)
  const profile = profiles[activeProfile]

  return (
    <section id="demo" className="bg-[#111111] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Live Preview
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              Tap it yourself.
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="mx-auto mt-4 max-w-md text-[#888888]">
              This is exactly what your contact sees when they tap your team&apos;s card.
            </p>
          </FadeUp>
        </div>

        <div className="mt-16 flex flex-col items-center gap-8">
          {/* Phone mockup */}
          <FadeUp delay={0.3}>
            <div className="relative">
              {/* Glow */}
              <div
                className="pointer-events-none absolute inset-0 -z-10 blur-[60px]"
                style={{ background: `radial-gradient(ellipse at 50% 60%, ${profile.color}22, transparent 70%)` }}
              />

              <PhoneMockup className="h-[560px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeProfile}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
                    className="flex h-full flex-col"
                  >
                    {/* Tap received indicator */}
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center justify-center gap-2 bg-[#C8FF00]/10 px-4 py-2"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: 2, duration: 0.4 }}
                        className="h-1.5 w-1.5 rounded-full bg-[#C8FF00]"
                      />
                      <span className="text-xs text-[#C8FF00]">NFC card tapped</span>
                    </motion.div>

                    {/* Profile content */}
                    <div className="flex flex-1 flex-col overflow-auto">
                      {/* Header */}
                      <div className="relative flex flex-col items-center pb-6 pt-8"
                        style={{ background: `linear-gradient(180deg, ${profile.color}15, transparent)` }}
                      >
                        <div
                          className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-black ring-4 ring-[#1a1a1a]"
                          style={{ background: `${profile.color}20`, color: profile.color }}
                        >
                          {profile.initial}
                        </div>
                        <h3 className="mt-3 font-syne text-lg font-bold text-[#F5F5F5]">
                          {profile.name}
                        </h3>
                        <p className="text-sm text-[#888888]">{profile.title}</p>
                        <span
                          className="mt-2 rounded-full px-3 py-0.5 text-xs font-medium"
                          style={{ background: `${profile.color}15`, color: profile.color }}
                        >
                          {profile.company}
                        </span>

                        {/* View count */}
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-[#555555]">
                          <Eye size={11} />
                          <span>{profile.views} views this week</span>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="flex flex-1 flex-col gap-2.5 px-4 py-4">
                        {[
                          { icon: MessageCircle, label: 'WhatsApp', color: '#22c55e' },
                          { icon: Link2, label: 'LinkedIn', color: '#60a5fa' },
                          { icon: Mail, label: 'Email', color: '#a78bfa' },
                          { icon: Phone, label: 'Call', color: '#f97316' },
                        ].map((link) => (
                          <div
                            key={link.label}
                            className="flex items-center gap-3 rounded-xl border border-[#222222] bg-[#1a1a1a] px-4 py-3"
                          >
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-lg"
                              style={{ background: `${link.color}15` }}
                            >
                              <link.icon size={14} style={{ color: link.color }} />
                            </div>
                            <span className="text-sm text-[#F5F5F5]">{link.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Save contact */}
                      <div className="p-4">
                        <button
                          className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-syne text-sm font-bold text-black"
                          style={{ background: profile.color }}
                        >
                          <UserPlus size={14} />
                          Save Contact
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </PhoneMockup>
            </div>
          </FadeUp>

          {/* Profile switcher */}
          <FadeUp delay={0.4} className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#555555]">Preview another profile →</p>
            <div className="flex gap-3">
              {profiles.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActiveProfile(i)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full font-syne text-sm font-bold ring-2 transition-all ${
                    activeProfile === i
                      ? 'ring-[#C8FF00] scale-110'
                      : 'ring-[#222222] hover:ring-[#2e2e2e]'
                  }`}
                  style={{
                    background: `${p.color}20`,
                    color: p.color,
                  }}
                >
                  {p.initial}
                </button>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
