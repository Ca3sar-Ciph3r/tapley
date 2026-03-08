/**
 * Tier pill badge — "◆ JOURNEYMAN" format.
 * Uses --brand-color CSS variable for background.
 */
export default function Badge({
  tier,
  className = '',
  variant = 'brand',
}: {
  tier: string
  className?: string
  variant?: 'brand' | 'white' | 'muted'
}) {
  const variants = {
    brand: 'bg-[var(--brand-color)] text-white',
    white: 'bg-white text-[var(--brand-color)]',
    muted: 'bg-white/20 text-white/80',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${variants[variant]} ${className}`}
    >
      ◆ {tier}
    </span>
  )
}
