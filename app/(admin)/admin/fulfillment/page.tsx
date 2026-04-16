'use client'

// app/(admin)/admin/fulfillment/page.tsx
//
// Rendering:  Client component — live data + update actions.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   supabaseAdmin via markOrderDelivered server action.
//             Browser client for data fetch (super_admin_all RLS policy).
//
// Shows card_orders grouped by status.
// Overdue orders (estimated_delivery < today, status != delivered) are highlighted.
// "Mark as delivered" button per order calls markOrderDelivered server action.
//
// card_orders columns (migration 20260415050000):
//   id, company_id, quantity, order_date, estimated_delivery,
//   tracking_number, cost_zar, notes, status, delivered_at, created_at
// companies join provides company name.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markOrderDelivered } from '@/lib/actions/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus = 'pending' | 'ordered' | 'printing' | 'shipped' | 'delivered'

type CardOrder = {
  id: string
  company_id: string
  company_name: string
  quantity: number
  order_date: string | null
  estimated_delivery: string | null
  tracking_number: string | null
  cost_zar: number | null
  notes: string | null
  status: OrderStatus
  delivered_at: string | null
  created_at: string
}

const STATUS_ORDER: OrderStatus[] = ['pending', 'ordered', 'printing', 'shipped', 'delivered']

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:   'bg-slate-100 text-slate-600',
  ordered:   'bg-sky-50 text-sky-700',
  printing:  'bg-indigo-50 text-indigo-700',
  shipped:   'bg-amber-50 text-amber-700',
  delivered: 'bg-emerald-50 text-emerald-700',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pending',
  ordered:   'Ordered',
  printing:  'Printing',
  shipped:   'Shipped',
  delivered: 'Delivered',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function isOverdue(order: CardOrder): boolean {
  if (order.status === 'delivered') return false
  if (!order.estimated_delivery) return false
  return new Date(order.estimated_delivery) < new Date()
}

function formatZar(amount: number | null): string {
  if (amount === null) return '—'
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// OrderRow
// ---------------------------------------------------------------------------

function OrderRow({
  order,
  delivering,
  onDeliver,
}: {
  order: CardOrder
  delivering: boolean
  onDeliver: (id: string) => void
}) {
  const overdue = isOverdue(order)

  return (
    <tr
      className={[
        'border-b border-slate-50 last:border-0 transition-colors',
        overdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50/60',
      ].join(' ')}
    >
      {/* Company */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {overdue && (
            <span
              className="material-symbols-outlined text-[16px] text-red-500 leading-none flex-shrink-0"
              title="Overdue"
            >
              warning
            </span>
          )}
          <span className="text-sm font-semibold text-slate-900">{order.company_name}</span>
        </div>
      </td>

      {/* Qty */}
      <td className="px-4 py-4 text-center">
        <span className="text-sm font-bold text-slate-900 tabular-nums">{order.quantity}</span>
      </td>

      {/* Order date */}
      <td className="px-4 py-4">
        <span className="text-xs text-slate-500">{formatDate(order.order_date)}</span>
      </td>

      {/* Est. delivery */}
      <td className="px-4 py-4">
        <span className={`text-xs font-medium ${overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
          {formatDate(order.estimated_delivery)}
          {overdue && ' (overdue)'}
        </span>
      </td>

      {/* Tracking */}
      <td className="px-4 py-4">
        <span className="text-xs font-mono text-slate-500">{order.tracking_number ?? '—'}</span>
      </td>

      {/* Cost */}
      <td className="px-4 py-4 text-right">
        <span className="text-xs text-slate-600 tabular-nums">{formatZar(order.cost_zar)}</span>
      </td>

      {/* Notes */}
      <td className="px-4 py-4 max-w-[160px]">
        <span className="text-xs text-slate-400 truncate block">{order.notes ?? '—'}</span>
      </td>

      {/* Action */}
      <td className="px-6 py-4 text-right">
        {order.status !== 'delivered' && (
          <button
            onClick={() => onDeliver(order.id)}
            disabled={delivering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
          >
            {delivering ? (
              <span className="material-symbols-outlined text-[14px] leading-none animate-spin">
                progress_activity
              </span>
            ) : (
              <span className="material-symbols-outlined text-[14px] leading-none">
                check_circle
              </span>
            )}
            {delivering ? 'Saving…' : 'Mark delivered'}
          </button>
        )}
        {order.status === 'delivered' && (
          <span className="text-xs text-slate-400">{formatDate(order.delivered_at)}</span>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<CardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [delivering, setDelivering] = useState<string | null>(null)

  async function loadOrders() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const supabaseAny = supabase as any

    const { data, error } = await supabaseAny
      .from('card_orders')
      .select('id, company_id, quantity, order_date, estimated_delivery, tracking_number, cost_zar, notes, status, delivered_at, created_at, companies(name)')
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Failed to load orders. Please refresh.')
      setLoading(false)
      return
    }

    const rows: CardOrder[] = (data ?? []).map((row: any) => ({
      id: row.id,
      company_id: row.company_id,
      company_name: Array.isArray(row.companies)
        ? (row.companies[0]?.name ?? 'Unknown')
        : (row.companies?.name ?? 'Unknown'),
      quantity: row.quantity,
      order_date: row.order_date,
      estimated_delivery: row.estimated_delivery,
      tracking_number: row.tracking_number,
      cost_zar: row.cost_zar,
      notes: row.notes,
      status: row.status as OrderStatus,
      delivered_at: row.delivered_at,
      created_at: row.created_at,
    }))

    setOrders(rows)
    setLoading(false)
  }

  useEffect(() => {
    loadOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDeliver(orderId: string) {
    setDelivering(orderId)
    const { error } = await markOrderDelivered(orderId)
    if (error) {
      alert(`Could not mark as delivered: ${error}`)
    } else {
      await loadOrders()
    }
    setDelivering(null)
  }

  // Group orders by status
  const grouped = STATUS_ORDER.reduce<Record<OrderStatus, CardOrder[]>>((acc, status) => {
    acc[status] = orders.filter(o => o.status === status)
    return acc
  }, { pending: [], ordered: [], printing: [], shipped: [], delivered: [] })

  // Monthly cost summary (current calendar month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthlyCost = orders
    .filter(o => o.created_at >= monthStart && o.cost_zar !== null)
    .reduce((sum, o) => sum + (o.cost_zar ?? 0), 0)

  const overdueCount = orders.filter(isOverdue).length

  return (
    <div className="px-10 py-10 space-y-8 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
            Fulfillment
          </h1>
          <p className="text-sm text-slate-500 mt-1">NFC card orders — tracking and delivery</p>
        </div>
        <div className="flex items-center gap-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-xl border border-red-100">
              <span className="material-symbols-outlined text-[18px] text-red-500 leading-none">
                warning
              </span>
              <span className="text-sm font-semibold text-red-700">
                {overdueCount} overdue
              </span>
            </div>
          )}
          <div className="glass-panel px-5 py-3 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              This month
            </p>
            <p className="text-lg font-bold font-jakarta text-slate-900">
              {formatZar(monthlyCost)}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">
            progress_activity
          </span>
          <span className="text-sm">Loading orders…</span>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-center gap-2 py-24 text-red-500 text-sm">
          <span className="material-symbols-outlined">error</span>
          {loadError}
        </div>
      )}

      {!loading && !loadError && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <span className="material-symbols-outlined text-[48px]">local_shipping</span>
          <p className="text-sm font-medium">No card orders yet.</p>
          <p className="text-xs">Orders are created automatically when a company is set up with NFC cards.</p>
        </div>
      )}

      {!loading && !loadError && orders.length > 0 && (
        <div className="space-y-6">
          {STATUS_ORDER.filter(status => status !== 'delivered').map(status => {
            const sectionOrders = grouped[status]
            if (sectionOrders.length === 0) return null
            return (
              <OrderSection
                key={status}
                status={status}
                orders={sectionOrders}
                delivering={delivering}
                onDeliver={handleDeliver}
              />
            )
          })}

          {/* Delivered section — collapsed by default if many */}
          {grouped.delivered.length > 0 && (
            <OrderSection
              key="delivered"
              status="delivered"
              orders={grouped.delivered}
              delivering={delivering}
              onDeliver={handleDeliver}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// OrderSection
// ---------------------------------------------------------------------------

function OrderSection({
  status,
  orders,
  delivering,
  onDeliver,
}: {
  status: OrderStatus
  orders: CardOrder[]
  delivering: string | null
  onDeliver: (id: string) => void
}) {
  return (
    <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="text-sm text-slate-400 font-medium">
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
        {orders.some(isOverdue) && (
          <span className="ml-auto text-xs font-semibold text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
            {orders.filter(isOverdue).length} overdue
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/40">
            <th className="px-6 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</th>
            <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Qty</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Order Date</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Est. Delivery</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Tracking</th>
            <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Cost</th>
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</th>
            <th className="px-6 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {status === 'delivered' ? 'Delivered' : 'Action'}
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              delivering={delivering === order.id}
              onDeliver={onDeliver}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
