import Link from 'next/link'
import { Link2, ExternalLink, MessageCircle } from 'lucide-react'

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#222222] bg-[#080808]">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-0">
              <span className="font-syne text-xl font-bold text-[#F5F5F5]">tapley</span>
              <span className="font-syne text-xl font-bold text-[#C8FF00]">.connect</span>
            </Link>
            <p className="mt-3 text-sm text-[#888888]">Your brand on every card.</p>
            <p className="mt-1 text-xs text-[#555555]">Built in South Africa 🇿🇦</p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-[#555555]">
              Product
            </h4>
            <ul className="space-y-3">
              {[
                { href: '#how-it-works', label: 'How It Works' },
                { href: '#features', label: 'Features' },
                { href: '#pricing', label: 'Pricing' },
                { href: '#demo', label: 'Demo' },
                { href: '/login', label: 'Dashboard Login' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-[#888888] transition hover:text-[#F5F5F5]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-[#555555]">
              Company
            </h4>
            <ul className="space-y-3">
              {[
                { href: '#', label: 'About' },
                { href: '#', label: 'Contact' },
                { href: '/privacy', label: 'Privacy Policy' },
                { href: '#', label: 'Terms of Service' },
                { href: '/legal/dpa', label: 'POPIA Compliance' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-[#888888] transition hover:text-[#F5F5F5]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-xs font-medium uppercase tracking-widest text-[#555555]">
              Contact
            </h4>
            <a
              href="mailto:hello@tapleys.co.za"
              className="text-sm text-[#888888] transition hover:text-[#F5F5F5]"
            >
              hello@tapleys.co.za
            </a>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href="https://wa.me/27000000000"
                className="flex items-center gap-2 rounded-full border border-[#222222] px-4 py-2 text-sm text-[#F5F5F5] transition hover:border-[#2e2e2e] hover:bg-[#111111]"
              >
                <MessageCircle size={14} />
                WhatsApp us
              </a>
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#222222] text-[#888888] transition hover:border-[#2e2e2e] hover:text-[#F5F5F5]"
              >
                <Link2 size={16} />
              </a>
              <a
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#222222] text-[#888888] transition hover:border-[#2e2e2e] hover:text-[#F5F5F5]"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#222222] pt-8 sm:flex-row">
          <p className="text-xs text-[#555555]">
            © {new Date().getFullYear()} Tapley Connect (Pty) Ltd. All rights reserved.
          </p>
          <p className="text-xs text-[#555555]">Made by Digital Native Agency</p>
        </div>
      </div>
    </footer>
  )
}
