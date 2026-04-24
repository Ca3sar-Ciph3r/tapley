'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronDown, Nfc, Wifi } from 'lucide-react'
import { AnimatedGridPattern } from '@/components/magic/AnimatedGridPattern'
import { Particles } from '@/components/magic/Particles'
import { BorderBeam } from '@/components/magic/BorderBeam'

const wordVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

const containerVariant = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

function AnimatedHeadline({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.span
      variants={containerVariant}
      initial="hidden"
      animate="show"
      transition={{ delayChildren: delay }}
      className="inline-flex flex-wrap gap-x-[0.25em]"
    >
      {text.split(' ').map((word, i) => (
        <motion.span key={i} variants={wordVariant}>
          {word}
        </motion.span>
      ))}
    </motion.span>
  )
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#080808]">
      {/* Background layers */}
      <div className="absolute inset-0">
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.03}
          duration={3}
          className="fill-[#C8FF00]/20 stroke-[#C8FF00]/10"
        />
        {/* Hero radial gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,255,0,0.12) 0%, transparent 70%)',
          }}
        />
        <Particles
          className="absolute inset-0"
          quantity={60}
          color="#C8FF00"
          staticity={60}
          ease={60}
          size={0.6}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-32 lg:px-8 lg:py-40">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left — copy */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C8FF00]/20 bg-[#C8FF00]/[0.06] px-4 py-1.5"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8FF00]" />
              <span className="text-xs font-medium uppercase tracking-widest text-[#C8FF00]">
                Now live in South Africa
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="font-syne text-[40px] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#F5F5F5] lg:text-[72px] lg:leading-[1.05]">
              <span className="block">
                <AnimatedHeadline text="Your brand on every card." delay={0.18} />
              </span>
              <span className="block text-[#C8FF00]">
                <AnimatedHeadline text="Any name. Any time." delay={0.36} />
              </span>
            </h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.54, duration: 0.6 }}
              className="mt-6 max-w-lg text-[18px] leading-relaxed text-[#888888]"
            >
              Tapley Connect gives your team NFC-powered digital business cards
              that stay branded to your company — even when staff change.
              No reprints. No wasted cards. Just tap.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.72, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link
                href="/login"
                className="min-h-[48px] rounded-full bg-[#C8FF00] px-8 py-3.5 font-syne text-base font-bold text-black transition hover:bg-[#9DC400] hover:shadow-[0_0_30px_rgba(200,255,0,0.3)]"
              >
                Get your cards →
              </Link>
              <a
                href="#how-it-works"
                className="min-h-[48px] rounded-full border border-[#222222] px-8 py-3.5 text-base text-[#F5F5F5] transition hover:border-[#2e2e2e] hover:bg-[#111111]"
              >
                See how it works
              </a>
            </motion.div>

            {/* Social proof micro */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="mt-5 text-sm text-[#555555]"
            >
              ★★★★★{' '}
              <span className="text-[#888888]">Trusted by forward-thinking SA businesses</span>
            </motion.p>
          </div>

          {/* Right — card + phone visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="text-xs uppercase tracking-widest text-[#555555]">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        >
          <ChevronDown size={16} className="text-[#555555]" />
        </motion.div>
      </motion.div>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative w-full max-w-md">
      {/* Glow behind */}
      <div className="absolute inset-0 -z-10 blur-[80px]" style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(200,255,0,0.15), transparent 70%)' }} />

      {/* Floating container */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="relative"
      >
        {/* Physical card */}
        <div className="relative mx-auto h-48 w-80 overflow-hidden rounded-2xl border border-[#2e2e2e] shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)' }}
        >
          {/* Card inner content */}
          <div className="relative flex h-full flex-col justify-between p-6">
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8FF00]">
                <span className="font-syne text-sm font-black text-black">K</span>
              </div>
              <div>
                <div className="font-syne text-sm font-bold text-[#F5F5F5]">KARAM AFRICA</div>
                <div className="text-xs text-[#555555]">karamafrica.co.za</div>
              </div>
            </div>

            {/* NFC icon with pulse ring */}
            <div className="absolute bottom-6 right-6 flex items-center justify-center">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-[#C8FF00]/40"
                />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[#C8FF00]/30 bg-[#C8FF00]/10">
                  <Wifi size={16} className="text-[#C8FF00]" />
                </div>
              </div>
            </div>

            {/* Horizontal lines — card design */}
            <div className="absolute bottom-0 left-0 right-0">
              <div className="h-px bg-[#C8FF00]/10" />
              <div className="h-6 bg-gradient-to-r from-[#C8FF00]/5 to-transparent" />
            </div>
          </div>
          <BorderBeam size={180} duration={8} colorFrom="#C8FF00" colorTo="transparent" />
        </div>

        {/* Phone screen floating above */}
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
          className="absolute -right-8 -top-16 w-44 overflow-hidden rounded-2xl border border-[#2e2e2e] bg-[#111111] shadow-2xl"
        >
          <BorderBeam size={120} duration={10} colorFrom="#C8FF00" colorTo="transparent" delay={5} />
          {/* Phone screen content */}
          <div className="p-4">
            {/* Profile photo placeholder */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#C8FF00]/30 to-[#C8FF00]/10 ring-2 ring-[#C8FF00]/20" />
              <div>
                <div className="h-2.5 w-20 rounded-full bg-[#F5F5F5]/80" />
                <div className="mt-1.5 h-2 w-14 rounded-full bg-[#888888]/40" />
              </div>
            </div>
            {/* Links */}
            <div className="space-y-2">
              {['WhatsApp', 'LinkedIn', 'Email'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-[#1a1a1a] px-2.5 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#C8FF00]" />
                  <div className="h-2 w-12 rounded-full bg-[#555555]/60" />
                </div>
              ))}
            </div>
            {/* Save button */}
            <div className="mt-3 rounded-full bg-[#C8FF00] py-2 text-center">
              <div className="h-2 w-16 mx-auto rounded-full bg-black/40" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
