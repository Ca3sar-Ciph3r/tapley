// lib/constants/change-requests.ts
//
// Shared shape and options for the change request queue.
//
// These live here rather than in lib/actions/change-requests.ts because that
// file is a 'use server' module, and a 'use server' module may only export
// async functions. Exporting a plain const from one type-checks and builds
// cleanly, then arrives as `undefined` in any client component that imports
// it — so `CHANGE_REQUEST_TYPES.map(...)` throws at module scope and the whole
// page dies with a client-side exception. That is exactly what happened to
// /admin/requests and /dashboard/requests in production.
//
// Anything a client component needs to *read* belongs in a plain module like
// this one. Only the actions themselves belong in the 'use server' file.

export const CHANGE_REQUEST_TYPES = [
  { value: 'replace_staff', label: 'Someone has left — replace them on a card' },
  { value: 'new_staff', label: 'Add a new staff member' },
  { value: 'edit_details', label: 'Correct someone’s details' },
  { value: 'branding', label: 'Change our branding' },
  { value: 'order_cards', label: 'Order more cards' },
  { value: 'other', label: 'Something else' },
] as const

export type ChangeRequestType = (typeof CHANGE_REQUEST_TYPES)[number]['value']

export interface ChangeRequest {
  id: string
  company_id: string
  staff_card_id: string | null
  type: string
  details: string
  status: string
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
}
