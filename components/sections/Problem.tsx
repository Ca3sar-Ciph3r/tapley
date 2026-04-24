'use client'

import { motion } from 'framer-motion'
import { Printer, UserMinus, Clock } from 'lucide-react'
import { MagicCard } from '@/components/magic/MagicCard'
import { CostCalculator } from '@/components/shared/CostCalculator'
import { FadeUp } from '@/components/shared/FadeUp'

const problems = [
  {
    icon: Printer,
    stat: 'R8,500',
    desc: 'Average annual spend on business card reprints for a 20-person team',
  },
  {
    icon: UserMinus,
    stat: '40%',
    desc: 'Of business cards are thrown away within a week of receipt',
  },
  {
    icon: Clock,
    stat: '3–5 days',
    desc: 'Average turnaround time to get new cards after a staff change',
  },
]

export function Problem() {
  return (
    <section id="problem" className="bg-[#080808] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          {/* Left — problem statements */}
          <div>
            <FadeUp>
              <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
                The Problem
              </span>
            </FadeUp>

            <FadeUp delay={0.1}>
              <h2 className="mt-4 font-syne text-[32px] font-bold leading-[1.15] tracking-tight text-[#F5F5F5] lg:text-[48px]">
                You&apos;ve been printing money
                <br />
                <span className="text-[#888888]">into the bin.</span>
              </h2>
            </FadeUp>

            <FadeUp delay={0.2}>
              <p className="mt-4 text-[#888888]">
                Every time a staff member leaves, those cards become litter.
                Every time someone changes title or number, you reprint.
                It adds up. Fast.
              </p>
            </FadeUp>

            {/* Problem cards */}
            <div className="mt-10 grid gap-4">
              {problems.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                >
                  <MagicCard className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C8FF00]/10">
                      <item.icon size={18} className="text-[#C8FF00]" />
                    </div>
                    <div>
                      <div className="font-syne text-3xl font-black text-[#C8FF00]">{item.stat}</div>
                      <p className="mt-1 text-sm text-[#888888]">{item.desc}</p>
                    </div>
                  </MagicCard>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — calculator */}
          <FadeUp delay={0.3}>
            <CostCalculator />
          </FadeUp>
        </div>
      </div>
    </section>
  )
}
