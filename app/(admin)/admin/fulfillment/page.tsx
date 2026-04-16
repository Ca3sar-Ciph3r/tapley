'use client'

// app/(admin)/admin/fulfillment/page.tsx
//
// Rendering:  Client component — live data + update actions.
// Auth:       Super Admin only. AdminLayout enforces this.
// Supabase:   supabaseAdmin via server actions.
//             Browser client for data fetch (super_admin_all RLS policy).
//
// Views:
//   - By Status (default): card_orders grouped by status, overdue highlighted.
//   - By Company: all orders for a single company, most-recent first (log view).
//
// Edit: clicking the pencil on any order opens an inline edit panel.
// "Mark as delivered" is a fast-path button (no edit panel needed).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markOrderDelivered, updateCardOrder, type UpdateCardOrderInput, type CardOrderStatus } from '@/lib/actions/admin'

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
  total_cost: number | null
  notes: string | null
  status: OrderStatus
  actual_delivery: string | null
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
    day: '2-digit', month: '2-digit', year: 'numeric',
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

// ISO date string → YYYY-MM-DD for <input type="date">
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

// ---------------------------------------------------------------------------
// EditPanel — inline slide-down form
// ---------------------------------------------------------------------------

function EditPanel({
  order,
  onSave,
  onCancel,
}: {
  order: CardOrder
  onSave: (id: string, updates: UpdateCardOrderInput) => Promise<void>
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    status: order.status as string,
    quantity: String(order.quantity),
    order_date: toDateInput(order.order_date),
    estimated_delivery: toDateInput(order.estimated_delivery),
    tracking_number: order.tracking_number ?? '',
    total_cost: order.total_cost !== null ? String(order.total_cost) : '',
    notes: order.notes ?? '',
    actual_delivery: toDateInput(order.actual_delivery),
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const updates: UpdateCardOrderInput = {
      status: form.status as CardOrderStatus,
      quantity: parseInt(form.quantity, 10) || order.quantity,
      order_date: form.order_date || null,
      estimated_delivery: form.estimated_delivery || null,
      tracking_number: form.tracking_number || null,
      total_cost: form.total_cost !== '' ? parseFloat(form.total_cost) : null,
      notes: form.notes || null,
      actual_delivery: form.actual_delivery || null,
    }
    await onSave(order.id, updates)
    setSaving(false)
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400'
  const labelCls = 'block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'

  return (
    <tr>
      <td colSpan={8} className="px-6 py-5 bg-slate-50/80 border-b border-slate-100">
        <div className="space-y-4">
          <p className="text-xs font-semibold text-slate-500">
            Editing order for <span className="text-slate-900">{order.company_name}</span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min="1" value={form.quantity}
                onChange={e => set('quantity', e.target.value)} className={inputCls} />
            </div>

            {/* Order Date */}
            <div>
              <label className={labelCls}>Order Date</label>
              <input type="date" value={form.order_date}
                onChange={e => set('order_date', e.target.value)} className={inputCls} />
            </div>

            {/* Est. Delivery */}
            <div>
              <label className={labelCls}>Est. Delivery</label>
              <input type="date" value={form.estimated_delivery}
                onChange={e => set('estimated_delivery', e.target.value)} className={inputCls} />
            </div>

            {/* Tracking */}
            <div>
              <label className={labelCls}>Tracking Number</label>
              <input type="text" placeholder="e.g. DHL-123456" value={form.tracking_number}
                onChange={e => set('tracking_number', e.target.value)} className={inputCls} />
            </div>

            {/* Cost */}
            <div>
              <label className={labelCls}>Cost (ZAR)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={form.total_cost}
                onChange={e => set('total_cost', e.target.value)} className={inputCls} />
            </div>

            {/* Actual Delivery */}
            <div>
              <label className={labelCls}>Actual Delivery</label>
              <input type="date" value={form.actual_delivery}
                onChange={e => set('actual_delivery', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any notes about this order…"
              className={`${inputCls} resize-none`} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[14px] leading-none">save</span>
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// OrderRow
// ---------------------------------------------------------------------------

function OrderRow({
  order,
  delivering,
  editingId,
  onDeliver,
  onEdit,
  onCancelEdit,
  onSave,
}: {
  order: CardOrder
  delivering: boolean
  editingId: string | null
  onDeliver: (id: string) => void
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, updates: UpdateCardOrderInput) => Promise<void>
}) {
  const overdue = isOverdue(order)
  const isEditing = editingId === order.id

  return (
    <>
      <tr
        className={[
          'border-b border-slate-50 last:border-0 transition-colors',
          isEditing ? 'bg-slate-50/80' : overdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50/60',
        ].join(' ')}
      >
        {/* Company */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            {overdue && (
              <span className="material-symbols-outlined text-[16px] text-red-500 leading-none flex-shrink-0" title="Overdue">
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
          <span className="text-xs text-slate-600 tabular-nums">{formatZar(order.total_cost)}</span>
        </td>

        {/* Notes */}
        <td className="px-4 py-4 max-w-[160px]">
          <span className="text-xs text-slate-400 truncate block">{order.notes ?? '—'}</span>
        </td>

        {/* Actions */}
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {/* Edit button — always visible */}
            <button
              onClick={() => isEditing ? onCancelEdit() : onEdit(order.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                isEditing
                  ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                  : 'text-slate-500 bg-slate-50 hover:bg-slate-100'
              }`}
              title={isEditing ? 'Cancel edit' : 'Edit order'}
            >
              <span className="material-symbols-outlined text-[14px] leading-none">
                {isEditing ? 'close' : 'edit'}
              </span>
            </button>

            {/* Mark delivered — only for non-delivered */}
            {order.status !== 'delivered' && (
              <button
                onClick={() => onDeliver(order.id)}
                disabled={delivering}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {delivering ? (
                  <span className="material-symbols-outlined text-[14px] leading-none animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px] leading-none">check_circle</span>
                )}
                {delivering ? 'Saving…' : 'Delivered'}
              </button>
            )}

            {order.status === 'delivered' && (
              <span className="text-xs text-slate-400">{formatDate(order.actual_delivery)}</span>
            )}
          </div>
        </td>
      </tr>

      {isEditing && (
        <EditPanel
          order={order}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// OrderSection — used in "By Status" view
// ---------------------------------------------------------------------------

function OrderSection({
  status,
  orders,
  delivering,
  editingId,
  onDeliver,
  onEdit,
  onCancelEdit,
  onSave,
}: {
  status: OrderStatus
  orders: CardOrder[]
  delivering: string | null
  editingId: string | null
  onDeliver: (id: string) => void
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, updates: UpdateCardOrderInput) => Promise<void>
}) {
  return (
    <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
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
      <OrderTable
        orders={orders}
        delivering={delivering}
        editingId={editingId}
        onDeliver={onDeliver}
        onEdit={onEdit}
        onCancelEdit={onCancelEdit}
        onSave={onSave}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// OrderTable — shared table used by both views
// ---------------------------------------------------------------------------

function OrderTable({
  orders,
  delivering,
  editingId,
  onDeliver,
  onEdit,
  onCancelEdit,
  onSave,
}: {
  orders: CardOrder[]
  delivering: string | null
  editingId: string | null
  onDeliver: (id: string) => void
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, updates: UpdateCardOrderInput) => Promise<void>
}) {
  return (
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
          <th className="px-6 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(order => (
          <OrderRow
            key={order.id}
            order={order}
            delivering={delivering === order.id}
            editingId={editingId}
            onDeliver={onDeliver}
            onEdit={onEdit}
            onCancelEdit={onCancelEdit}
            onSave={onSave}
          />
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// CompanyLog — "By Company" view: one card per company, all their orders
// ---------------------------------------------------------------------------

function CompanyLog({
  orders,
  delivering,
  editingId,
  onDeliver,
  onEdit,
  onCancelEdit,
  onSave,
}: {
  orders: CardOrder[]
  delivering: string | null
  editingId: string | null
  onDeliver: (id: string) => void
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onSave: (id: string, updates: UpdateCardOrderInput) => Promise<void>
}) {
  // Group by company_id
  const companies = Array.from(
    orders.reduce((map, o) => {
      if (!map.has(o.company_id)) map.set(o.company_id, { name: o.company_name, orders: [] })
      map.get(o.company_id)!.orders.push(o)
      return map
    }, new Map<string, { name: string; orders: CardOrder[] }>())
  ).sort((a, b) => a[1].name.localeCompare(b[1].name))

  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <span className="material-symbols-outlined text-[48px]">local_shipping</span>
        <p className="text-sm font-medium">No orders yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {companies.map(([companyId, { name, orders: compOrders }]) => {
        const totalCards = compOrders.reduce((s, o) => s + o.quantity, 0)
        const totalCost = compOrders.reduce((s, o) => s + (o.total_cost ?? 0), 0)
        const hasOverdue = compOrders.some(isOverdue)
        return (
          <div key={companyId} className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-900">{name}</span>
              <span className="text-xs text-slate-400">{compOrders.length} order{compOrders.length !== 1 ? 's' : ''}</span>
              <span className="text-xs text-slate-400">{totalCards} cards</span>
              <span className="text-xs text-slate-500 font-medium">{formatZar(totalCost)} total</span>
              {hasOverdue && (
                <span className="ml-auto text-xs font-semibold text-red-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
                  overdue
                </span>
              )}
            </div>
            <OrderTable
              orders={compOrders}
              delivering={delivering}
              editingId={editingId}
              onDeliver={onDeliver}
              onEdit={onEdit}
              onCancelEdit={onCancelEdit}
              onSave={onSave}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type ViewMode = 'by-status' | 'by-company'

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<CardOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [delivering, setDelivering] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('by-status')

  async function loadOrders() {
    setLoading(true)
    setLoadError(null)

    const supabase = createClient()
    const supabaseAny = supabase as any

    const { data, error } = await supabaseAny
      .from('card_orders')
      .select('id, company_id, quantity, order_date, estimated_delivery, tracking_number, total_cost, notes, status, actual_delivery, created_at, companies(name)')
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
      total_cost: row.total_cost,
      notes: row.notes,
      status: row.status as OrderStatus,
      actual_delivery: row.actual_delivery,
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
      setEditingId(null)
    }
    setDelivering(null)
  }

  async function handleSave(orderId: string, updates: UpdateCardOrderInput) {
    const { error } = await updateCardOrder(orderId, updates)
    if (error) {
      alert(`Could not save changes: ${error}`)
    } else {
      await loadOrders()
      setEditingId(null)
    }
  }

  // Group by status (for by-status view)
  const grouped = STATUS_ORDER.reduce<Record<OrderStatus, CardOrder[]>>((acc, status) => {
    acc[status] = orders.filter(o => o.status === status)
    return acc
  }, { pending: [], ordered: [], printing: [], shipped: [], delivered: [] })

  // Monthly cost summary (current calendar month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthlyCost = orders
    .filter(o => o.created_at >= monthStart && o.total_cost !== null)
    .reduce((sum, o) => sum + (o.total_cost ?? 0), 0)

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
              <span className="material-symbols-outlined text-[18px] text-red-500 leading-none">warning</span>
              <span className="text-sm font-semibold text-red-700">{overdueCount} overdue</span>
            </div>
          )}
          <div className="glass-panel px-5 py-3 rounded-xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">This month</p>
            <p className="text-lg font-bold font-jakarta text-slate-900">{formatZar(monthlyCost)}</p>
          </div>
        </div>
      </div>

      {/* View toggle */}
      {!loading && !loadError && orders.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {([
            { key: 'by-status', label: 'By Status', icon: 'view_kanban' },
            { key: 'by-company', label: 'By Company', icon: 'business' },
          ] as { key: ViewMode; label: string; icon: string }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => { setViewMode(key); setEditingId(null) }}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                viewMode === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
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

      {/* By Status view */}
      {!loading && !loadError && orders.length > 0 && viewMode === 'by-status' && (
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
                editingId={editingId}
                onDeliver={handleDeliver}
                onEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSave={handleSave}
              />
            )
          })}
          {grouped.delivered.length > 0 && (
            <OrderSection
              key="delivered"
              status="delivered"
              orders={grouped.delivered}
              delivering={delivering}
              editingId={editingId}
              onDeliver={handleDeliver}
              onEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSave={handleSave}
            />
          )}
        </div>
      )}

      {/* By Company view */}
      {!loading && !loadError && orders.length > 0 && viewMode === 'by-company' && (
        <CompanyLog
          orders={orders}
          delivering={delivering}
          editingId={editingId}
          onDeliver={handleDeliver}
          onEdit={setEditingId}
          onCancelEdit={() => setEditingId(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
