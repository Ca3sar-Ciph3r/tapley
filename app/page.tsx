// app/page.tsx
// Rendering: Server component — immediate redirect
// Purpose: Root URL redirects to /login. No marketing site in MVP.

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}
