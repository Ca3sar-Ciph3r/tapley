// app/(public)/layout.tsx
//
// Wraps all public-facing pages (card pages, legal pages).
// Renders a slim legal footer with links to Privacy Policy, DPA, and PAIA Manual.
// The card page /c/[slug] is ISR-cached — this layout is statically rendered too.

import Link from 'next/link'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <footer style={{ marginTop: '40px', borderTop: '1px solid #e2e8f0', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
          &copy; {new Date().getFullYear()} Tapley Connect &middot; Digital Business Card Platform &middot; South Africa
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <Link href="/privacy" style={{ color: '#64748b', textDecoration: 'underline' }}>Privacy Policy</Link>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <Link href="/legal/dpa" style={{ color: '#64748b', textDecoration: 'underline' }}>Data Processing Agreement</Link>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <Link href="/legal/paia" style={{ color: '#64748b', textDecoration: 'underline' }}>PAIA Manual</Link>
        </p>
      </footer>
    </>
  )
}
