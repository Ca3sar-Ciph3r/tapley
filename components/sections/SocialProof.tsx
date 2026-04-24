'use client'

import { motion } from 'framer-motion'
import { FadeUp } from '@/components/shared/FadeUp'
import { NumberTicker } from '@/components/magic/NumberTicker'

const stats = [
  { value: 100, suffix: '%', label: 'Card reuse rate across all clients' },
  { value: 30, suffix: 's', label: 'Average time to reassign a card profile' },
  { value: 3, suffix: 'x', label: 'More profile views vs paper cards' },
]

const trustBadges = [
  { icon: '🔒', label: 'POPIA Compliant' },
  { icon: '🇿🇦', label: 'SA-Based Support' },
  { icon: '⚡', label: 'NFC + QR Dual Mode' },
  { icon: '🔄', label: 'Real-Time Updates' },
]

export function SocialProof() {
  return (
    <section id="social-proof" className="bg-[#111111] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <FadeUp>
          <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
            Why Teams Choose Tapley
          </span>
        </FadeUp>

        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Large decorative quote */}
            <div className="font-syne text-[80px] font-black leading-none text-[#C8FF00]">&ldquo;</div>

            <blockquote className="-mt-6 font-syne text-xl font-semibold leading-relaxed text-[#F5F5F5] lg:text-2xl">
              We had three staff changes in our first month.
              With Tapley, not one card needed reprinting.
              The dashboard is genuinely effortless.
            </blockquote>

            <div className="mt-8 flex items-center gap-4">
              {/* Avatar placeholder */}
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#C8FF00]/20 bg-gradient-to-br from-[#C8FF00]/20 to-[#C8FF00]/5">
                <span className="font-syne font-bold text-[#C8FF00]">KS</span>
              </div>
              <div>
                <div className="font-syne text-sm font-semibold text-[#F5F5F5]">Karam Sader</div>
                <div className="text-sm text-[#888888]">Director, Karam Africa</div>
              </div>
              <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8FF00]">
                <span className="font-syne text-xs font-black text-black">K</span>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="flex flex-col justify-center gap-10">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="border-b border-[#222222] pb-8 last:border-0 last:pb-0"
              >
                <div className="font-syne text-5xl font-black text-[#C8FF00]">
                  <NumberTicker
                    value={stat.value}
                    suffix={stat.suffix}
                    delay={i * 0.2}
                    className="text-[#C8FF00]"
                  />
                </div>
                <p className="mt-1 text-[#888888]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <FadeUp delay={0.4} className="mt-16">
          <div className="flex flex-wrap justify-center gap-3">
            {trustBadges.map((badge, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full border border-[#222222] bg-[#1a1a1a] px-4 py-2 text-sm text-[#888888]"
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
