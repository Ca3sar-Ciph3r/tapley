'use client'

import { useState, useCallback } from 'react'
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion'
import * as Slider from '@radix-ui/react-slider'
import Link from 'next/link'

export function CostCalculator() {
  const [staffCount, setStaffCount] = useState(20)
  const [turnover, setTurnover] = useState(25)
  const [cardCost, setCardCost] = useState(45)

  const calculate = useCallback(() => {
    const annualTurnoverCount = Math.round((staffCount * turnover) / 100)
    const totalCards = staffCount + annualTurnoverCount
    const waste = annualTurnoverCount * cardCost
    const totalSpend = totalCards * cardCost
    const monthsToROI = Math.ceil(490 / (waste / 12))
    return { waste, totalSpend, monthsToROI }
  }, [staffCount, turnover, cardCost])

  const { waste, monthsToROI } = calculate()

  return (
    <div className="rounded-xl border border-[#222222] bg-[#111111] p-6 lg:p-8">
      <h3 className="mb-6 font-syne text-2xl font-semibold text-[#F5F5F5]">
        Calculate your card bleed
      </h3>

      <div className="space-y-6">
        {/* Staff count */}
        <div>
          <div className="mb-2 flex justify-between">
            <label className="text-sm font-medium uppercase tracking-widest text-[#888888]">
              How many staff?
            </label>
            <span className="font-syne text-lg font-bold text-[#C8FF00]">{staffCount}</span>
          </div>
          <Slider.Root
            className="relative flex h-5 w-full touch-none select-none items-center"
            value={[staffCount]}
            onValueChange={([v]) => setStaffCount(v)}
            min={5}
            max={200}
            step={5}
          >
            <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-[#222222]">
              <Slider.Range className="absolute h-full rounded-full bg-[#C8FF00]" />
            </Slider.Track>
            <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-[#C8FF00] bg-[#080808] shadow-md transition-transform focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:ring-offset-1 hover:scale-110" />
          </Slider.Root>
        </div>

        {/* Turnover */}
        <div>
          <div className="mb-2 flex justify-between">
            <label className="text-sm font-medium uppercase tracking-widest text-[#888888]">
              Staff turnover / year
            </label>
            <span className="font-syne text-lg font-bold text-[#C8FF00]">{turnover}%</span>
          </div>
          <Slider.Root
            className="relative flex h-5 w-full touch-none select-none items-center"
            value={[turnover]}
            onValueChange={([v]) => setTurnover(v)}
            min={5}
            max={80}
            step={5}
          >
            <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-[#222222]">
              <Slider.Range className="absolute h-full rounded-full bg-[#C8FF00]" />
            </Slider.Track>
            <Slider.Thumb className="block h-5 w-5 rounded-full border-2 border-[#C8FF00] bg-[#080808] shadow-md transition-transform focus:outline-none focus:ring-2 focus:ring-[#C8FF00] focus:ring-offset-1 hover:scale-110" />
          </Slider.Root>
        </div>

        {/* Cost per card */}
        <div>
          <label className="mb-2 block text-sm font-medium uppercase tracking-widest text-[#888888]">
            Cost per card (R)
          </label>
          <input
            type="number"
            value={cardCost}
            onChange={(e) => setCardCost(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-md border border-[#222222] bg-[#1a1a1a] px-4 py-2.5 font-syne text-lg text-[#F5F5F5] outline-none ring-offset-[#080808] transition focus:border-[#C8FF00] focus:ring-2 focus:ring-[#C8FF00]/20"
          />
        </div>
      </div>

      {/* Output */}
      <motion.div
        key={waste}
        initial={{ scale: 0.97, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="mt-8 rounded-lg border border-[#C8FF00]/20 bg-[#C8FF00]/[0.04] p-6 text-center"
      >
        <p className="mb-1 text-sm uppercase tracking-widest text-[#888888]">
          You&apos;re printing approximately
        </p>
        <div className="font-syne text-5xl font-black text-[#C8FF00]">
          R {waste.toLocaleString()}
        </div>
        <p className="mt-1 text-[#888888]">in wasted cards every year</p>

        {monthsToROI > 0 && monthsToROI <= 24 && (
          <p className="mt-4 text-sm text-[#F5F5F5]">
            Tapley Connect pays for itself in{' '}
            <span className="font-bold text-[#C8FF00]">{monthsToROI} months</span>
          </p>
        )}
        <p className="mt-1 text-xs text-[#555555]">Based on your inputs above</p>
      </motion.div>

      <Link
        href="/login"
        className="mt-6 flex w-full items-center justify-center rounded-full bg-[#C8FF00] px-6 py-3.5 font-syne text-sm font-bold text-black transition hover:bg-[#9DC400]"
      >
        Stop the bleed →
      </Link>
    </div>
  )
}
