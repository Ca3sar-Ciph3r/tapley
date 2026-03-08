'use client'

/**
 * BusinessTheme — injects per-business brand color as CSS custom properties.
 * Wrap any page or section that needs dynamic brand color theming.
 *
 * Usage:
 *   <BusinessTheme brandColor={business.brand_color}>
 *     {children}
 *   </BusinessTheme>
 */
export default function BusinessTheme({
  brandColor,
  children,
  className,
}: {
  brandColor: string
  children: React.ReactNode
  className?: string
}) {
  // Derive a light version at 10% opacity for backgrounds
  const lightColor = hexToRgba(brandColor, 0.1)

  return (
    <div
      className={className}
      style={
        {
          '--brand-color': brandColor,
          '--brand-color-light': lightColor,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
