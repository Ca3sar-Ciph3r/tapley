'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
]

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="fixed left-0 right-0 top-0 z-50">
      <motion.div
        initial={{ opacity: 1 }}
        animate={scrolled ? { opacity: 1 } : { opacity: 1 }}
        className="mx-auto max-w-7xl px-6 lg:px-8"
      >
        <motion.nav
          initial={false}
          animate={
            scrolled
              ? {
                  backgroundColor: 'rgba(8,8,8,0.85)',
                  backdropFilter: 'blur(20px)',
                  borderColor: 'rgba(34,34,34,1)',
                  borderWidth: '1px',
                  marginTop: '8px',
                  borderRadius: '16px',
                }
              : {
                  backgroundColor: 'rgba(8,8,8,0)',
                  backdropFilter: 'blur(0px)',
                  borderColor: 'rgba(34,34,34,0)',
                  borderWidth: '1px',
                  marginTop: '0px',
                  borderRadius: '0px',
                }
          }
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex items-center justify-between px-6 py-3.5"
          style={{ borderStyle: 'solid' }}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-0.5">
            <span className="font-syne text-xl font-bold text-[#F5F5F5]">tapley</span>
            <span className="font-syne text-xl font-bold text-[#C8FF00]">.connect</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-[#888888] transition hover:text-[#F5F5F5]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-full border border-[#222222] px-4 py-2 text-sm text-[#F5F5F5] transition hover:border-[#2e2e2e] hover:bg-[#111111]"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#C8FF00] px-4 py-2 font-syne text-sm font-bold text-black transition hover:bg-[#9DC400]"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <Dialog.Trigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#222222] text-[#888888] transition hover:text-[#F5F5F5] md:hidden">
                <Menu size={18} />
              </button>
            </Dialog.Trigger>

            <AnimatePresence>
              {mobileOpen && (
                <Dialog.Portal forceMount>
                  <Dialog.Overlay asChild>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild>
                    <motion.div
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="fixed bottom-0 right-0 top-0 z-50 flex w-[280px] flex-col border-l border-[#222222] bg-[#080808] p-6"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-syne text-lg font-bold text-[#F5F5F5]">
                          tapley<span className="text-[#C8FF00]">.connect</span>
                        </span>
                        <Dialog.Close asChild>
                          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[#888888] hover:text-[#F5F5F5]">
                            <X size={18} />
                          </button>
                        </Dialog.Close>
                      </div>

                      <nav className="mt-8 flex flex-col gap-1">
                        {NAV_LINKS.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setMobileOpen(false)}
                            className="rounded-lg px-3 py-3 text-[#888888] transition hover:bg-[#111111] hover:text-[#F5F5F5]"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </nav>

                      <div className="mt-auto flex flex-col gap-3">
                        <Link
                          href="/login"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-full border border-[#222222] py-3 text-center text-sm text-[#F5F5F5] transition hover:bg-[#111111]"
                        >
                          Log in
                        </Link>
                        <Link
                          href="/login"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-full bg-[#C8FF00] py-3 text-center font-syne text-sm font-bold text-black transition hover:bg-[#9DC400]"
                        >
                          Get Started →
                        </Link>
                      </div>
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
        </motion.nav>
      </motion.div>
    </header>
  )
}
