'use client'

import { useEffect, useRef } from 'react'
import { useMotionValue, useSpring, useInView } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  prefix?: string
  suffix?: string
  className?: string
  delay?: number
}

export function AnimatedNumber({ value, prefix = '', suffix = '', className, delay = 0 }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { stiffness: 60, damping: 20 })
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    if (isInView) {
      setTimeout(() => motionValue.set(value), delay * 1000)
    }
  }, [isInView, motionValue, value, delay])

  useEffect(() =>
    springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${Math.round(latest).toLocaleString()}${suffix}`
      }
    })
  )

  return <span ref={ref} className={className}>{prefix}0{suffix}</span>
}
