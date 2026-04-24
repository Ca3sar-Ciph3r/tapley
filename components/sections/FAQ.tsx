'use client'

import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDown, MessageCircle, CalendarDays } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeUp } from '@/components/shared/FadeUp'
import { FAQ_ITEMS } from '@/lib/constants'
import Link from 'next/link'

export function FAQ() {
  return (
    <section id="faq" className="bg-[#080808] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Common Questions
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              We&apos;ve heard every concern.
            </h2>
          </FadeUp>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-20">
          {/* FAQ accordion */}
          <FadeUp delay={0.15}>
            <Accordion.Root type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <Accordion.Item
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-[#222222] last:border-0"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="group flex w-full items-center justify-between py-5 text-left font-syne text-base font-semibold text-[#F5F5F5] transition hover:text-[#C8FF00] [&[data-state=open]]:text-[#C8FF00]">
                      {item.q}
                      <ChevronDown
                        size={18}
                        className="shrink-0 text-[#555555] transition-transform duration-300 group-data-[state=open]:rotate-180"
                      />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=closed]:animate-none data-[state=open]:animate-none">
                    <motion.div
                      initial={false}
                      className="border-l-2 border-[#C8FF00] pl-4 pb-5 text-sm leading-relaxed text-[#888888]"
                    >
                      {item.a}
                    </motion.div>
                  </Accordion.Content>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </FadeUp>

          {/* Sticky support widget */}
          <div className="lg:sticky lg:top-24">
            <FadeUp delay={0.3}>
              <div className="rounded-2xl border border-[#222222] bg-[#111111] p-6">
                {/* Avatars */}
                <div className="flex items-center gap-2">
                  {['T', 'S'].map((initial, i) => (
                    <div
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#080808] bg-gradient-to-br from-[#C8FF00]/20 to-[#C8FF00]/5 font-syne text-sm font-bold text-[#C8FF00]"
                      style={{ marginLeft: i > 0 ? '-8px' : 0 }}
                    >
                      {initial}
                    </div>
                  ))}
                  <div className="ml-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                      <span className="text-xs text-[#22c55e]">Online now</span>
                    </div>
                  </div>
                </div>

                <h3 className="mt-4 font-syne text-lg font-semibold text-[#F5F5F5]">
                  Still have questions?
                </h3>
                <p className="mt-1.5 text-sm text-[#888888]">
                  Talk to a real person. We&apos;re based in Port Elizabeth.
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <a
                    href="https://wa.me/27000000000"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#C8FF00] py-3 font-syne text-sm font-bold text-black transition hover:bg-[#9DC400]"
                  >
                    <MessageCircle size={14} />
                    Chat with us on WhatsApp
                  </a>
                  <Link
                    href="/login"
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-[#222222] py-3 text-sm text-[#F5F5F5] transition hover:border-[#2e2e2e] hover:bg-[#111111]"
                  >
                    <CalendarDays size={14} />
                    Book a 15-min demo call
                  </Link>
                </div>

                <p className="mt-4 text-center text-xs text-[#555555]">
                  No sales pressure. Just answers.
                </p>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  )
}
