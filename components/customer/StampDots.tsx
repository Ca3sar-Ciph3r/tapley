/**
 * StampDots — renders the loyalty stamp progress dots.
 *
 * Three states per dot:
 * - filled:   brand-color bg, white check icon ✓
 * - current:  pulsing border (brand-color), visit number inside
 * - empty:    mist border, no fill
 *
 * Sizes:
 * - mobile (default): w-10 h-10 (40px)
 * - staff tablet:     w-12 h-12 (48px) via size="lg"
 */
export default function StampDots({
  total,
  filled,
  size = 'md',
}: {
  total: number
  filled: number
  size?: 'md' | 'lg'
}) {
  const dotSize = size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const stampNum = i + 1
        const isFilled = stampNum <= filled
        const isCurrent = stampNum === filled + 1

        if (isFilled) {
          return (
            <div
              key={i}
              className={`${dotSize} flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-color)] text-white`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: size === 'lg' ? '22px' : '18px', fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                check
              </span>
            </div>
          )
        }

        if (isCurrent) {
          return (
            <div
              key={i}
              className={`${dotSize} relative flex shrink-0 items-center justify-center rounded-full border-4 border-[var(--brand-color)] bg-white stamp-dot-current`}
            >
              <span className="font-black text-[var(--brand-color)]">{stampNum}</span>
            </div>
          )
        }

        return (
          <div
            key={i}
            className={`${dotSize} flex shrink-0 items-center justify-center rounded-full border-2 border-[#E7E5E4] bg-white`}
          />
        )
      })}
    </div>
  )
}
