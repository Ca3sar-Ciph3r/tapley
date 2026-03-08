'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * BottomNav — 4-tab sticky bottom navigation for customer pages.
 * Home | Loyalty | Book | Profile
 */
export default function BottomNav({
  bookingUrl,
  cardUuid,
}: {
  bookingUrl?: string | null
  cardUuid: string
}) {
  const pathname = usePathname()

  const tabs = [
    {
      label: 'Home',
      icon: 'home',
      href: `/status?card=${cardUuid}`,
      active: pathname === '/status',
    },
    {
      label: 'Loyalty',
      icon: 'star',
      href: `/status?card=${cardUuid}`,
      active: pathname === '/status',
    },
    {
      label: 'Book',
      icon: 'calendar_today',
      href: bookingUrl ?? '#',
      external: !!bookingUrl,
      active: false,
    },
    {
      label: 'Profile',
      icon: 'person',
      href: `#profile`,
      active: false,
    },
  ]

  // Determine which tab is actually active
  const isLoyaltyActive = pathname === '/status' || pathname === '/redeem'
  const updatedTabs = tabs.map((tab, i) => {
    if (i === 0) return { ...tab, active: false } // Home — not distinctly active in this design
    if (i === 1) return { ...tab, active: isLoyaltyActive }
    return tab
  })

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] border-t border-[#E7E5E4] bg-white z-50">
      <div className="flex items-center">
        {updatedTabs.map((tab) => {
          const content = (
            <div
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
                tab.active ? 'text-[var(--brand-color)]' : 'text-[#A7A3A8]'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: '22px',
                  fontVariationSettings: tab.active ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </div>
          )

          if ('external' in tab && tab.external) {
            return (
              <a
                key={tab.label}
                href={tab.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1"
              >
                {content}
              </a>
            )
          }

          return (
            <Link key={tab.label} href={tab.href} className="flex flex-1">
              {content}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
