'use client'

// app/(dashboard)/dashboard/refer/page.tsx
//
// Rendering:  Client component — clipboard interaction + live data.
// Auth:       Company Admin only. Dashboard layout enforces this.
// Supabase:   Browser client — RLS scopes companies query to the current user's company.
//             referrals table queried with explicit company_id filter.
//
// Shows:
//   - The company's unique referral code (from companies.referral_code)
//   - Shareable link with ?ref= parameter
//   - Copy link button (Clipboard API)
//   - Pre-composed WhatsApp share message
//   - List of referrals made by this company
//   - Reward explanation: 1 month free per referred company that goes live

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Referral = {
  id: string
  status: string
  credited_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   'bg-slate-100 text-slate-600',
    live:      'bg-emerald-50 text-emerald-700',
    credited:  'bg-teal-50 text-teal-700',
    cancelled: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ReferPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copyType, setCopyType] = useState<'code' | 'link' | 'wa' | null>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const shareLink = referralCode ? `${appUrl}/?ref=${referralCode}` : ''
  const waMessage = referralCode
    ? `Hey! We use Tapley Connect for our digital business cards — tap the link to get set up: ${shareLink}`
    : ''
  const waLink = `https://wa.me/?text=${encodeURIComponent(waMessage)}`

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const supabaseAny = supabase as any

    // Fetch this company's referral code
    const { data: companyData } = await (supabase as any)
      .from('companies')
      .select('id, referral_code')
      .single()

    const cId: string | null = companyData?.id ?? null
    const code: string | null = companyData?.referral_code ?? null

    setCompanyId(cId)
    setReferralCode(code)

    // Fetch referrals made by this company
    if (cId) {
      const { data: referralData } = await supabaseAny
        .from('referrals')
        .select('id, status, credited_at, created_at')
        .eq('referrer_company_id', cId)
        .order('created_at', { ascending: false })

      setReferrals((referralData ?? []) as Referral[])
    }

    setLoading(false)
  }

  async function copyToClipboard(text: string, type: 'code' | 'link' | 'wa') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setCopyType(type)
      setTimeout(() => { setCopied(false); setCopyType(null) }, 2000)
    } catch {
      // Fallback — noop
    }
  }

  const creditedCount = referrals.filter(r => r.status === 'credited').length
  const pendingCount = referrals.filter(r => r.status === 'pending' || r.status === 'live').length

  return (
    <div className="px-10 py-10 space-y-8 max-w-3xl">
      {/* Page header */}
      <div>
        <h1 className="font-jakarta text-3xl font-extrabold text-slate-900 leading-tight">
          Refer &amp; Earn
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Earn 1 month free for every company you refer that goes live
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
          <span className="material-symbols-outlined text-[28px] animate-spin">
            progress_activity
          </span>
          <span className="text-sm">Loading…</span>
        </div>
      ) : (
        <>
          {/* Referral code + share */}
          <div className="glass-panel rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-jakarta text-base font-bold text-slate-900">
                  Your Referral Code
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Share this with other businesses</p>
              </div>
              {creditedCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-xl">
                  <span className="material-symbols-outlined text-[18px] text-teal-600 leading-none">
                    card_giftcard
                  </span>
                  <span className="text-sm font-bold text-teal-700">
                    {creditedCount} month{creditedCount !== 1 ? 's' : ''} earned
                  </span>
                </div>
              )}
            </div>

            {/* Code display */}
            {referralCode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
                    <span className="font-mono text-xl font-bold tracking-[0.15em] text-slate-900">
                      {referralCode}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(referralCode, 'code')}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">
                      {copied && copyType === 'code' ? 'check' : 'content_copy'}
                    </span>
                    {copied && copyType === 'code' ? 'Copied!' : 'Copy code'}
                  </button>
                </div>

                {/* Share link */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Shareable link
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 overflow-hidden">
                      <span className="text-sm text-slate-500 truncate font-mono">{shareLink}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(shareLink, 'link')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {copied && copyType === 'link' ? 'check' : 'link'}
                      </span>
                      {copied && copyType === 'link' ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </div>

                {/* WhatsApp share */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    WhatsApp message
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-slate-600 leading-relaxed">{waMessage}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        whatsapp
                      </span>
                      Share on WhatsApp
                    </a>
                    <button
                      onClick={() => copyToClipboard(waMessage, 'wa')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none">
                        {copied && copyType === 'wa' ? 'check' : 'content_copy'}
                      </span>
                      {copied && copyType === 'wa' ? 'Copied!' : 'Copy message'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">
                No referral code assigned yet. Contact support to get your code.
              </p>
            )}
          </div>

          {/* Reward explanation */}
          <div className="glass-panel rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[20px] text-teal-600 leading-none">
                  emoji_events
                </span>
              </div>
              <div>
                <h3 className="font-jakarta font-bold text-slate-900 text-sm">
                  How the reward works
                </h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  For every company you refer that signs up and goes live with Tapley Connect,
                  you earn <strong className="text-slate-700">1 month free</strong> on your subscription.
                  Credits are applied automatically once the referred company activates their first card.
                  There&apos;s no limit to how many companies you can refer.
                </p>
              </div>
            </div>
          </div>

          {/* Referrals list */}
          {referrals.length > 0 && (
            <div className="glass-panel rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                <div>
                  <h2 className="font-jakarta text-base font-bold text-slate-900">
                    Your Referrals
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {referrals.length} total · {pendingCount} pending
                  </p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Referred
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Credit Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {referrals.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3">
                        <span className="text-sm font-medium text-slate-700">
                          Referral #{referrals.length - i}
                        </span>
                        <p className="text-xs text-slate-400">{formatDate(r.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="text-xs text-slate-500">{formatDate(r.credited_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {referrals.length === 0 && referralCode && (
            <div className="glass-panel rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-center">
              <span className="material-symbols-outlined text-[40px] text-slate-300 block mb-3">
                group_add
              </span>
              <p className="text-sm font-medium text-slate-500">No referrals yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Share your referral code above and start earning free months.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
