import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import {
  calculateTier,
  calculateRewardCycleStamps,
  isRewardAvailable,
  getNextTier,
  getLowestTier,
} from '@/lib/business-rules'
import BusinessTheme from '@/components/ui/BusinessTheme'
import StampDots from '@/components/customer/StampDots'
import RedeemClient from './RedeemClient'

async function getRedeemData(cardUuid: string) {
  const supabase = createServiceClient()

  const { data: card } = await supabase
    .from('cards')
    .select('*, businesses(*)')
    .eq('card_uuid', cardUuid)
    .single()

  if (!card?.customer_id) return null

  const business = card.businesses
  if (!business) return null

  const [{ data: customer }, { data: tiers }, { data: confirmedVisits }, { data: redemptions }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('id', card.customer_id).single(),
      supabase.from('tiers').select('*').eq('business_id', business.id).order('level', { ascending: true }),
      supabase
        .from('visits')
        .select('*')
        .eq('customer_id', card.customer_id)
        .eq('business_id', business.id)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: true }),
      supabase
        .from('redemptions')
        .select('*')
        .eq('customer_id', card.customer_id)
        .eq('business_id', business.id)
        .order('redeemed_at', { ascending: false })
        .limit(1),
    ])

  return {
    business,
    customer: customer ?? null,
    tiers: tiers ?? [],
    visits: confirmedVisits ?? [],
    lastRedemption: redemptions?.[0] ?? null,
  }
}

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: { card?: string }
}) {
  const cardUuid = searchParams.card
  if (!cardUuid) notFound()

  const data = await getRedeemData(cardUuid)
  if (!data || !data.customer) redirect(`/register?card=${cardUuid}`)

  const { business, customer, tiers, visits, lastRedemption } = data

  const lifetimeVisits = visits.length
  const currentTier = calculateTier(lifetimeVisits, tiers)
  const rewardCycleStamps = calculateRewardCycleStamps(visits, lastRedemption)
  const lowestTier = getLowestTier(tiers)
  const activeTier = currentTier ?? lowestTier
  const nextTier = getNextTier(currentTier, tiers)

  // If no reward available, go back to status
  if (!activeTier || !isRewardAvailable(rewardCycleStamps, activeTier)) {
    redirect(`/status?card=${cardUuid}`)
  }

  const threshold = activeTier.visit_threshold

  return (
    <BusinessTheme brandColor={business.brand_color}>
      <div className="min-h-screen bg-[#F7F7F5] pb-8 max-w-[390px] mx-auto">
        {/* Header */}
        <header className="flex items-center px-5 pt-6 pb-4">
          <a
            href={`/status?card=${cardUuid}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-[#E7E5E4]"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-[#1A1A1A]" style={{ fontSize: '20px' }}>
              arrow_back
            </span>
          </a>
          <h2 className="flex-1 text-center text-base font-bold tracking-tight pr-10">
            {business.name}
          </h2>
        </header>

        <div className="px-5 space-y-4 pb-28">
          {/* Reward banner */}
          <div
            className="relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-3xl p-6 reward-glow"
            style={{ backgroundColor: '#22C55E' }}
          >
            {/* Gift watermark */}
            <span
              className="material-symbols-outlined absolute right-4 top-4 opacity-20"
              style={{ fontSize: '180px', color: 'white', fontVariationSettings: "'FILL' 1", lineHeight: 1 }}
            >
              card_giftcard
            </span>

            <div className="relative z-10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/90 mb-1">
                READY TO CLAIM
              </p>
              <p className="text-[28px] font-extrabold leading-tight text-white mb-2">
                {activeTier.reward_description}
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  qr_code
                </span>
                Show this screen to your barber
              </div>
            </div>
          </div>

          {/* Progress section — all filled */}
          <div className="rounded-3xl bg-slate-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-bold italic text-[#16181D]">
                {activeTier.name} reward unlocked ✓
              </p>
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-black text-green-700">
                {threshold}/{threshold} VISITS
              </span>
            </div>

            <StampDots total={Math.min(threshold, 10)} filled={threshold} />

            {/* Progress bar 100% */}
            <div className="mt-3 h-[1.5px] w-full rounded-full bg-green-200">
              <div className="h-full w-full rounded-full bg-[#22C55E]" />
            </div>
          </div>

          {/* Tier row */}
          {nextTier && (
            <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black italic" style={{ color: 'var(--brand-color)' }}>
                  ◆
                </span>
                <div>
                  <p className="font-bold italic text-[#16181D]">{activeTier.name}</p>
                  <p className="text-xs text-[#A7A3A8]">Current tier</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#16181D]">
                  Next: <span className="italic font-bold">{nextTier.name}</span>
                </p>
                <p className="text-xs text-[#A7A3A8]">{nextTier.visit_threshold} visits total</p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky CLAIM REWARD button */}
        <RedeemClient
          cardUuid={cardUuid}
          rewardDescription={activeTier.reward_description ?? 'Reward'}
        />
      </div>
    </BusinessTheme>
  )
}
