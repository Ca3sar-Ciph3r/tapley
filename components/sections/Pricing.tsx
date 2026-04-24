'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { FadeUp } from '@/components/shared/FadeUp'
import { BorderBeam } from '@/components/magic/BorderBeam'
import { PRICING_PLANS } from '@/lib/constants'
import Link from 'next/link'

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="bg-[#111111] py-24 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16 text-center">
          <FadeUp>
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Pricing
            </span>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="mt-4 font-syne text-[32px] font-bold leading-tight tracking-tight text-[#F5F5F5] lg:text-[48px]">
              Straightforward pricing.
              <br />
              <span className="text-[#888888]">No surprises.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="mx-auto mt-4 max-w-md text-[#888888]">
              Cards ordered separately. Platform pricing is per-company, not per-card.
            </p>
          </FadeUp>

          {/* Billing toggle */}
          <FadeUp delay={0.25} className="mt-8 flex items-center justify-center gap-4">
            <span className={`text-sm ${!annual ? 'text-[#F5F5F5]' : 'text-[#888888]'}`}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative h-7 w-14 rounded-full border transition-colors ${
                annual ? 'border-[#C8FF00]/30 bg-[#C8FF00]/10' : 'border-[#222222] bg-[#1a1a1a]'
              }`}
            >
              <motion.div
                animate={{ x: annual ? 28 : 4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute top-1 h-5 w-5 rounded-full bg-[#C8FF00]"
              />
            </button>
            <span className={`flex items-center gap-2 text-sm ${annual ? 'text-[#F5F5F5]' : 'text-[#888888]'}`}>
              Annual
              <span className="rounded-full bg-[#C8FF00]/10 px-2 py-0.5 text-xs font-medium text-[#C8FF00]">
                Save 20%
              </span>
            </span>
          </FadeUp>
        </div>

        {/* Pricing cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 lg:p-8 ${
                plan.featured
                  ? 'border-[#C8FF00]/40 bg-[#1a1a1a] shadow-[0_0_60px_rgba(200,255,0,0.08)]'
                  : 'border-[#222222] bg-[#111111]'
              }`}
            >
              {plan.featured && <BorderBeam size={300} duration={10} />}

              {/* Badge */}
              {plan.badge && (
                <div className="absolute right-4 top-4 rounded-full bg-[#C8FF00] px-3 py-1 font-syne text-xs font-bold text-black">
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <div className="font-syne text-sm font-medium uppercase tracking-widest text-[#555555]">
                {plan.name}
              </div>

              {/* Price */}
              <div className="mt-4">
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="font-syne text-4xl font-black text-[#F5F5F5]">
                      R {annual ? plan.annualPrice?.toLocaleString() : plan.monthlyPrice?.toLocaleString()}
                    </span>
                    <span className="mb-1 text-sm text-[#888888]">/ month</span>
                  </div>
                ) : (
                  <div className="font-syne text-4xl font-black text-[#F5F5F5]">Custom</div>
                )}
                <p className="mt-1 text-sm text-[#888888]">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    {feature.included ? (
                      <Check size={16} className="mt-0.5 shrink-0 text-[#C8FF00]" />
                    ) : (
                      <X size={16} className="mt-0.5 shrink-0 text-[#555555]" />
                    )}
                    <span
                      className={`text-sm ${feature.included ? 'text-[#F5F5F5]' : 'text-[#555555]'}`}
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/login"
                className={`mt-8 flex w-full items-center justify-center rounded-full py-3.5 font-syne text-sm font-bold transition ${
                  plan.featured
                    ? 'bg-[#C8FF00] text-black hover:bg-[#9DC400] hover:shadow-[0_0_30px_rgba(200,255,0,0.3)]'
                    : 'border border-[#222222] text-[#F5F5F5] hover:border-[#2e2e2e] hover:bg-[#1a1a1a]'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Risk reversal strip */}
        <FadeUp delay={0.4} className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-[#222222] bg-[#1a1a1a] px-6 py-4 text-sm text-[#888888]">
            <span>🔒 30-day money-back guarantee</span>
            <span className="hidden text-[#333] sm:block">|</span>
            <span>No lock-in contracts</span>
            <span className="hidden text-[#333] sm:block">|</span>
            <span>Cancel anytime</span>
            <span className="hidden text-[#333] sm:block">|</span>
            <span>🇿🇦 SA-based support</span>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
