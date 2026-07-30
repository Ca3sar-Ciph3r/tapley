'use client'

// components/dashboard/no-company-selected.tsx
//
// Rendered when the active-company resolver returns null — most often a super
// admin who has landed on a dashboard route without picking a company to
// impersonate.
//
// This is the fail-closed branch. Showing this is always correct; falling
// through to an unscoped query would mix every tenant's data together.

import Link from 'next/link'

export function NoCompanySelected({
  what = 'this page',
}: {
  what?: string
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
        <span className="material-symbols-outlined text-2xl text-amber-500">
          business
        </span>
      </div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        No company selected
      </h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Pick a company to view {what}. Open it from the admin panel and choose
        “Impersonate” to manage it as its admin.
      </p>
      <Link
        href="/admin"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Go to admin panel
      </Link>
    </div>
  )
}
