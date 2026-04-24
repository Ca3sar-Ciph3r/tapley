'use client'

import { motion } from 'framer-motion'
import { AnimatedGridPattern } from '@/components/magic/AnimatedGridPattern'
import { Meteors } from '@/components/magic/Meteors'
import { FadeUp } from '@/components/shared/FadeUp'
import Link from 'next/link'

const trustItems = [
  { icon: '🔒', label: 'Secure' },
  { icon: '🇿🇦', label: 'SA-Based' },
  { icon: '⚡', label: 'Live in minutes' },
  { icon: '🔄', label: 'No reprints ever' },
]

export function FinalCTA() {
  return (
    <section id="cta" className="relative overflow-hidden bg-[#080808] py-24 lg:py-40">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <AnimatedGridPattern
          numSquares={20}
          maxOpacity={0.02}
          className="fill-[#C8FF00]/10 stroke-[#C8FF00]/5"
        />
        {/* Central glow burst */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(200,255,0,0.1) 0%, transparent 70%)',
          }}
        />
        {/* Meteors */}
        <Meteors number={8} />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center lg:px-8">
        <FadeUp>
          <h2 className="font-syne text-[40px] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#F5F5F5] lg:text-[72px] lg:leading-[1.05]">
            Stop printing cards{' '}
            <span className="text-[#C8FF00]">that end up in the bin.</span>
          </h2>
        </FadeUp>

        <FadeUp delay={0.15}>
          <p className="mx-auto mt-6 max-w-lg text-lg text-[#888888]">
            Get Tapley Connect. One card per person.
            Reassign anytime. Always on-brand.
          </p>
        </FadeUp>

        <FadeUp delay={0.3}>
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="mt-10 inline-block"
          >
            <Link
              href="/login"
              className="inline-flex min-h-[60px] items-center rounded-full bg-[#C8FF00] px-12 py-4 font-syne text-lg font-black text-black shadow-[0_0_40px_rgba(200,255,0,0.3)] transition hover:bg-[#9DC400] hover:shadow-[0_0_60px_rgba(200,255,0,0.4)]"
            >
              Order your cards now →
            </Link>
          </motion.div>
        </FadeUp>

        <FadeUp delay={0.4}>
          <p className="mt-6 text-sm text-[#888888]">
            ★★★★★ Karam Africa and others are already live.
          </p>
          <p className="mt-1 text-sm text-[#555555]">
            Cards typically delivered in 5–7 business days. Setup takes under 10 minutes.
          </p>
        </FadeUp>

        {/* Trust row */}
        <FadeUp delay={0.5} className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[#555555]">
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {i < trustItems.length - 1 && (
                  <span className="ml-2 text-[#222222]">|</span>
                )}
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
