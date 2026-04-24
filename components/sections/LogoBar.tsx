import { Marquee } from '@/components/magic/Marquee'

const logos = [
  { name: 'Karam Africa', abbr: 'KA' },
  { name: 'Redacted Client', abbr: '●●●' },
  { name: 'Redacted Client', abbr: '●●●' },
  { name: 'Redacted Client', abbr: '●●●' },
  { name: 'Redacted Client', abbr: '●●●' },
]

function LogoItem({ name, abbr }: { name: string; abbr: string }) {
  return (
    <div className="group mx-8 flex items-center gap-3 opacity-60 transition-opacity duration-300 hover:opacity-100">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#222222]">
        <span className="font-syne text-xs font-bold text-[#F5F5F5]">{abbr.charAt(0)}</span>
      </div>
      <span className="whitespace-nowrap font-syne text-sm font-semibold text-[#F5F5F5]">
        {name}
      </span>
    </div>
  )
}

export function LogoBar() {
  return (
    <section className="border-y border-[#222222] bg-[#111111]">
      <div className="relative flex h-20 items-center overflow-hidden">
        {/* Left fade */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[#111111] to-transparent" />
        {/* Right fade */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[#111111] to-transparent" />

        <div className="flex w-full items-center">
          <div className="mr-8 shrink-0 px-6">
            <span className="text-xs font-medium uppercase tracking-widest text-[#555555]">
              Trusted by
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <Marquee pauseOnHover duration={40} repeat={4}>
              {logos.map((logo, i) => (
                <LogoItem key={i} {...logo} />
              ))}
            </Marquee>
          </div>
        </div>
      </div>
    </section>
  )
}
