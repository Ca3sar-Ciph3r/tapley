'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart, UserCheck, RefreshCw } from 'lucide-react'
import { FadeUp } from '@/components/shared/FadeUp'
import { BorderBeam } from '@/components/magic/BorderBeam'
import Link from 'next/link'

const steps = [
  {
    number: '01',
    icon: ShoppingCart,
    title: 'Order your branded cards',
    description:
      'Your company logo, brand colours, and NFC chip. No names. No titles. No reprint triggers.',
    illustration: <CardOrderIllustration />,
  },
  {
    number: '02',
    icon: UserCheck,
    title: 'Assign a profile to each card',
    description:
      'From your Tapley dashboard, link any team member\'s profile to any physical card in seconds.',
    illustration: <DashboardIllustration />,
  },
  {
    number: '03',
    icon: RefreshCw,
    title: 'Staff change? Reassign in 30 seconds',
    description:
      'Sarah leaves. New hire Jake starts. Tap 3 buttons. Same physical card, new person. Done.',
    illustration: <ReassignIllustration />,
  },
]

function CardOrderIllustration() {
  return (
    <div className="flex items-center justify-center p-6">
      <div className="relative">
        <motion.div
          className="h-32 w-52 rounded-xl border border-[#2e2e2e] bg-gradient-to-br from-[#1a1a1a] to-[#111111] shadow-xl"
          animate={{ rotateY: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div className="flex items-center gap-2">
              <motion.div
                className="h-7 w-7 rounded-lg bg-[#C8FF00]"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              />
              <motion.div
                className="h-2 w-20 rounded-full bg-[#F5F5F5]/70"
                initial={{ width: 0 }}
                animate={{ width: '5rem' }}
                transition={{ delay: 0.5, duration: 0.4 }}
              />
            </div>
            <motion.div
              className="h-1.5 w-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #C8FF00, transparent)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
          <BorderBeam size={150} duration={6} />
        </motion.div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#C8FF00]/20 bg-[#C8FF00]/10 px-3 py-1 text-xs text-[#C8FF00]">
          NFC + QR ready
        </div>
      </div>
    </div>
  )
}

function DashboardIllustration() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-[#222222] bg-[#0f0f0f] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-[#555555]">Card #004</span>
          <span className="rounded-full bg-[#C8FF00]/10 px-2 py-0.5 text-xs text-[#C8FF00]">Active</span>
        </div>
        <div className="space-y-2">
          {['Card #001 — Alex M.', 'Card #002 — Priya S.', 'Card #003 — Tom W.'].map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-[#1a1a1a] px-3 py-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-[#888888]">{item}</span>
            </div>
          ))}
          <motion.div
            animate={{ borderColor: ['#222222', '#C8FF00', '#222222'] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-[#C8FF00]" />
            <span className="text-xs text-[#C8FF00]">Card #004 — Sarah K. ←</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function ReassignIllustration() {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex items-center justify-center p-6">
      <div className="relative h-24 w-52">
        <AnimatePresence mode="wait">
          {!showNew ? (
            <motion.div
              key="sarah"
              initial={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex items-center justify-center rounded-xl border border-[#222222] bg-[#111111]"
              onClick={() => setShowNew(true)}
              style={{ cursor: 'pointer' }}
            >
              <div className="text-center">
                <div className="font-syne text-sm font-semibold text-[#888888] line-through">
                  Sarah K.
                </div>
                <div className="mt-0.5 text-xs text-[#555555]">Marketing Director</div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="jake"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute inset-0 flex items-center justify-center rounded-xl border border-[#C8FF00]/30 bg-[#C8FF00]/5"
              onClick={() => setShowNew(false)}
              style={{ cursor: 'pointer' }}
            >
              <div className="text-center">
                <div className="font-syne text-sm font-semibold text-[#C8FF00]">Jake M.</div>
                <div className="mt-0.5 text-xs text-[#888888]">Marketing Director</div>
              </div>
              <BorderBeam size={120} duration={6} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-2 text-center text-xs text-[#555555]">Click to toggle</p>
    </div>
  )
}

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <section id="how-it-works" className="bg-[#111111] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              How It Works
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              One card. Any person.
              <br />
              <span className="text-[#C8FF00]">Forever.</span>
            </h2>
          </FadeUp>
        </div>

        {/* Steps + illustration */}
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Steps */}
          <div className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <motion.button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`group w-full rounded-xl border p-5 text-left transition-all duration-300 ${
                  activeStep === i
                    ? 'border-[#C8FF00]/30 bg-[#1a1a1a] pl-6'
                    : 'border-[#222222] bg-transparent hover:border-[#2e2e2e]'
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      activeStep === i ? 'bg-[#C8FF00]' : 'bg-[#1a1a1a] border border-[#222222]'
                    }`}
                  >
                    <step.icon
                      size={16}
                      className={activeStep === i ? 'text-black' : 'text-[#555555]'}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium uppercase tracking-widest ${
                          activeStep === i ? 'text-[#C8FF00]' : 'text-[#555555]'
                        }`}
                      >
                        Step {step.number}
                      </span>
                    </div>
                    <h3
                      className={`mt-1 font-syne text-base font-semibold ${
                        activeStep === i ? 'text-[#F5F5F5]' : 'text-[#888888]'
                      }`}
                    >
                      {step.title}
                    </h3>
                    <AnimatePresence>
                      {activeStep === i && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 text-sm text-[#888888] overflow-hidden"
                        >
                          {step.description}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Illustration panel */}
          <FadeUp delay={0.2} className="flex items-center">
            <div className="relative w-full overflow-hidden rounded-2xl border border-[#222222] bg-[#1a1a1a]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  {steps[activeStep].illustration}
                </motion.div>
              </AnimatePresence>
            </div>
          </FadeUp>
        </div>

        {/* Differentiator callout */}
        <FadeUp delay={0.3} className="mt-16">
          <div className="relative overflow-hidden rounded-2xl border border-[#222222] bg-[#1a1a1a] p-8 text-center">
            <BorderBeam size={300} duration={12} />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8FF00]/10">
              <RefreshCw size={20} className="text-[#C8FF00]" />
            </div>
            <p className="mt-4 font-syne text-lg font-semibold text-[#F5F5F5]">
              This is the part traditional card providers can&apos;t do.
            </p>
            <p className="mt-2 text-[#888888]">
              Every other solution ties the card to the person.
              <br />
              We tie the card to your brand. The person is just a profile.
            </p>
            <Link
              href="#demo"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#222222] px-5 py-2.5 text-sm text-[#F5F5F5] transition hover:border-[#2e2e2e] hover:bg-[#222222]"
            >
              See a live demo →
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
