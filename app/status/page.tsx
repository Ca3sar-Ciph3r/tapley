import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import {
  calculateTier,
  calculateRewardCycleStamps,
  checkCooldown,
  isRewardAvailable,
  getNextTier,
  getLowestTier,
} from '@/lib/business-rules'
import BusinessTheme from '@/components/ui/BusinessTheme'
import Badge from '@/components/ui/Badge'
import StampDots from '@/components/customer/StampDots'
import TierCard from '@/components/customer/TierCard'
import CooldownCard from '@/components/customer/CooldownCard'
import RewardCard from '@/components/customer/RewardCard'
import BottomNav from '@/components/customer/BottomNav'

async function getStatusData(cardUuid: string) {
  const supabase = createServiceClient()

  const { data: card } = await supabase
    .from('cards')
    .select('*, businesses(*)')
    .eq('card_uuid', cardUuid)
    .single()

  if (!card) return null

  const business = card.businesses
  if (!business) return null

  if (!card.customer_id) return { card, business, customer: null, tiers: [], visits: [], redemptions: [] }

  const [
    { data: customer },
    { data: tiers },
    { data: visits },
    { data: redemptions },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', card.customer_id).single(),
    supabase.from('tiers').select('*').eq('business_id', business.id).order('level', { ascending: true }),
    supabase.from('visits').select('*').eq('customer_id', card.customer_id).eq('business_id', business.id).eq('status', 'confirmed').order('confirmed_at', { ascending: false }),
    supabase.from('redemptions').select('*').eq('customer_id', card.customer_id).eq('business_id', business.id).order('redeemed_at', { ascending: false }).limit(1),
  ])

  return {
    card,
    business,
    customer: customer ?? null,
    tiers: tiers ?? [],
    visits: visits ?? [],
    redemptions: redemptions ?? [],
  }
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: { card?: string; state?: string; visit?: string }
}) {
  const cardUuid = searchParams.card
  const stateParam = searchParams.state

  if (!cardUuid) notFound()

  const data = await getStatusData(cardUuid)

  if (!data) {
    return <StatusError message="Card not found" />
  }

  const { business, customer, tiers, visits, redemptions } = data

  // Error states
  if (stateParam === 'not_found') {
    return <StatusError message="Card not found" detail="This card hasn't been activated yet." />
  }
  if (stateParam === 'blacklisted') {
    return <StatusError message="Card suspended" detail="This card has been suspended. Please speak to a staff member." />
  }

  // No customer yet — shouldn't happen but handle gracefully
  if (!customer) {
    redirect(`/register?card=${cardUuid}`)
  }

  const lifetimeVisits = visits.length
  const lastRedemption = redemptions[0] ?? null
  const currentTier = calculateTier(lifetimeVisits, tiers)
  const rewardCycleStamps = calculateRewardCycleStamps(visits, lastRedemption)
  const nextTier = getNextTier(currentTier, tiers)
  const lowestTier = getLowestTier(tiers)
  const activeTier = currentTier ?? lowestTier

  // Check if reward is available
  if (activeTier && isRewardAvailable(rewardCycleStamps, activeTier) && stateParam !== 'stamped') {
    // Don't auto-redirect from status page — show reward card instead
  }

  // Cooldown state
  if (stateParam === 'cooldown') {
    const cooldownHours = lowestTier?.stamp_cooldown_hours ?? 12
    const lastConfirmed = visits[0] ?? null
    const { nextEligibleAt } = checkCooldown(lastConfirmed, cooldownHours)

    return (
      <BusinessTheme brandColor={business.brand_color}>
        <div className="min-h-screen bg-[#F7F7F5] pb-28 max-w-[390px] mx-auto">
          <StatusHeader business={business} customer={customer} currentTier={currentTier} />

          <div className="px-5 py-3 space-y-4">
            <p className="text-xl font-bold text-[#16181D]">
              Welcome back, {customer.first_name}
            </p>

            <CooldownCard
              nextEligibleAt={nextEligibleAt ?? new Date(Date.now() + 12 * 3600000)}
              currentTier={currentTier}
              nextTier={nextTier}
              rewardCycleStamps={rewardCycleStamps}
            />

            <TierCard
              currentTier={currentTier}
              allTiers={tiers}
              lifetimeVisits={lifetimeVisits}
            />

            <LifetimeStats
              lifetimeVisits={lifetimeVisits}
              redemptionsCount={redemptions.length}
              memberSince={customer.created_at}
            />
          </div>

          <BottomNav bookingUrl={business.booking_url} cardUuid={cardUuid} />
        </div>
      </BusinessTheme>
    )
  }

  // Normal status view (new / pending / stamped / default)
  const threshold = activeTier?.visit_threshold ?? 7
  const progressPercent = Math.min(100, Math.round((rewardCycleStamps / threshold) * 100))
  const stampsRemaining = Math.max(0, threshold - rewardCycleStamps)
  const rewardReady = activeTier ? isRewardAvailable(rewardCycleStamps, activeTier) : false

  return (
    <BusinessTheme brandColor={business.brand_color}>
      <div className="min-h-screen bg-[#F7F7F5] pb-28 max-w-[390px] mx-auto">
        <StatusHeader business={business} customer={customer} currentTier={currentTier} />

        <div className="px-5 py-3 space-y-4">
          <p className="text-xl font-bold text-[#16181D]">
            Welcome back, {customer.first_name}
          </p>

          {/* Reward available banner */}
          {rewardReady && activeTier && (
            <RewardCard tier={activeTier} cardUuid={cardUuid} />
          )}

          {/* Progress card */}
          {!rewardReady && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              {/* Count + percent */}
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-3xl font-black text-[#16181D]">
                  {rewardCycleStamps} / {threshold}{' '}
                  <span className="text-sm font-semibold text-[#A7A3A8]">VISITS</span>
                </span>
                <span className="text-xl font-black text-[#A7A3A8]">{progressPercent}%</span>
              </div>

              {/* Stamp dots */}
              <div className="mb-4">
                <StampDots total={Math.min(threshold, 10)} filled={Math.min(rewardCycleStamps, threshold)} />
              </div>

              {/* Progress bar */}
              <div className="h-[1.5px] w-full rounded-full bg-[#E7E5E4] mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--brand-color)',
                  }}
                />
              </div>

              {/* Reward info */}
              {activeTier && (
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontSize: '16px', color: 'var(--brand-color)', fontVariationSettings: "'FILL' 1" }}
                  >
                    redeem
                  </span>
                  <p className="text-sm font-medium text-[#A7A3A8]">
                    {stampsRemaining === 0
                      ? `${activeTier.reward_description} — Ready to claim!`
                      : `${stampsRemaining} more visit${stampsRemaining !== 1 ? 's' : ''} to unlock ${activeTier.reward_description}`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tier card */}
          <TierCard
            currentTier={currentTier}
            allTiers={tiers}
            lifetimeVisits={lifetimeVisits}
          />

          {/* Lifetime stats */}
          <LifetimeStats
            lifetimeVisits={lifetimeVisits}
            redemptionsCount={redemptions.length}
            memberSince={customer.created_at}
          />

          {/* Recent visits */}
          {visits.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#A7A3A8] mb-3">
                Recent Visits
              </h3>
              <div className="space-y-3">
                {visits.slice(0, 5).map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#16181D]">
                        {visit.confirmed_at
                          ? new Date(visit.confirmed_at).toLocaleDateString('en-ZA', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </p>
                      <p className="text-xs text-[#A7A3A8]">Visit</p>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                      <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      CONFIRMED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-[#A7A3A8] pb-4">
            Lost your card?{' '}
            <a className="underline font-semibold" href={`mailto:support@tapley.co.za?subject=Lost card - ${cardUuid}`}>
              Contact Support
            </a>
          </p>
        </div>

        <BottomNav bookingUrl={business.booking_url} cardUuid={cardUuid} />
      </div>
    </BusinessTheme>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function StatusHeader({
  business,
  customer,
  currentTier,
}: {
  business: { name: string; logo_url: string | null; brand_color: string }
  customer: { first_name: string | null }
  currentTier: { name: string } | null
}) {
  return (
    <header className="flex items-center justify-between px-5 pt-6 pb-4">
      <div className="flex items-center gap-3">
        {/* Business logo */}
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-black text-lg"
          style={{ backgroundColor: 'var(--brand-color)' }}
        >
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt={business.name} className="h-8 w-8 object-contain" />
          ) : (
            business.name.charAt(0)
          )}
        </div>
        <span className="text-xs font-black uppercase tracking-widest text-[#16181D]">
          {business.name}
        </span>
      </div>

      {currentTier && <Badge tier={currentTier.name} />}
    </header>
  )
}

function LifetimeStats({
  lifetimeVisits,
  redemptionsCount,
  memberSince,
}: {
  lifetimeVisits: number
  redemptionsCount: number
  memberSince: string
}) {
  const memberDate = new Date(memberSince).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Visits', value: lifetimeVisits },
        { label: 'Rewards', value: redemptionsCount },
        { label: 'Member Since', value: memberDate },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl bg-white p-3 text-center shadow-sm">
          <p className="text-lg font-black text-[#16181D]">{value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A7A3A8]">
            {label}
          </p>
        </div>
      ))}
    </div>
  )
}

function StatusError({
  message,
  detail,
}: {
  message: string
  detail?: string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-6">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm max-w-sm w-full">
        <span className="material-symbols-outlined text-[48px] text-[#A7A3A8]">
          credit_card_off
        </span>
        <p className="mt-3 text-lg font-bold text-[#16181D]">{message}</p>
        {detail && <p className="mt-2 text-sm text-[#A7A3A8]">{detail}</p>}
      </div>
    </div>
  )
}
