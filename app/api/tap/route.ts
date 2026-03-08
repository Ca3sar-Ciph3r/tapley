import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import {
  calculateTier,
  calculateRewardCycleStamps,
  checkCooldown,
  isRewardAvailable,
  checkDailyLimit,
  getNextTier,
  getLowestTier,
} from '@/lib/business-rules'
import { checkRapidSuccession, createFraudAlert } from '@/lib/fraud'
import type { TapResult } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cardUuid = searchParams.get('card')

  if (!cardUuid) {
    return NextResponse.json<TapResult>({ state: 'not_found' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    // 1. Look up card by card_uuid
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*, businesses(*)')
      .eq('card_uuid', cardUuid)
      .single()

    if (cardError || !card) {
      return NextResponse.json<TapResult>({ state: 'not_found' })
    }

    // 2. Blacklisted card
    if (card.status === 'blacklisted') {
      return NextResponse.json<TapResult>({ state: 'blacklisted' })
    }

    // 3. New card — no customer linked yet
    if (!card.customer_id) {
      return NextResponse.json<TapResult>({ state: 'register', card_uuid: cardUuid })
    }

    const business = card.businesses
    if (!business) {
      return NextResponse.json<TapResult>({ state: 'not_found' })
    }

    // 4. Load customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', card.customer_id)
      .single()

    if (!customer) {
      return NextResponse.json<TapResult>({ state: 'not_found' })
    }

    // 5. Load tiers for this business (sorted by level)
    const { data: tiers } = await supabase
      .from('tiers')
      .select('*')
      .eq('business_id', business.id)
      .order('level', { ascending: true })

    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ state: 'not_found' }, { status: 500 })
    }

    // 6. Load all confirmed visits for this customer at this business
    const { data: confirmedVisits } = await supabase
      .from('visits')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('business_id', business.id)
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: true })

    const visits = confirmedVisits ?? []

    // 7. Load last redemption
    const { data: redemptions } = await supabase
      .from('redemptions')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('business_id', business.id)
      .order('redeemed_at', { ascending: false })
      .limit(1)

    const lastRedemption = redemptions?.[0] ?? null

    // 8. Calculate tier and reward cycle
    const lifetimeVisits = visits.length
    const currentTier = calculateTier(lifetimeVisits, tiers)
    const rewardCycleStamps = calculateRewardCycleStamps(visits, lastRedemption)
    const nextTier = getNextTier(currentTier, tiers)
    const lowestTier = getLowestTier(tiers)

    // Use the lowest tier's cooldown as the default fraud config
    const cooldownHours = lowestTier?.stamp_cooldown_hours ?? 12
    const dailyLimit = lowestTier?.daily_stamp_limit ?? 1

    // 9. Check daily limit
    if (checkDailyLimit(visits, dailyLimit)) {
      const lastConfirmed = visits[visits.length - 1] ?? null
      const nextEligibleAt = lastConfirmed?.confirmed_at
        ? new Date(new Date(lastConfirmed.confirmed_at).getTime() + cooldownHours * 3_600_000)
        : null

      return NextResponse.json<TapResult>({
        state: 'cooldown',
        customer_name: customer.first_name ?? undefined,
        tier: currentTier ?? undefined,
        tiers,
        reward_cycle_stamps: rewardCycleStamps,
        lifetime_visits: lifetimeVisits,
        next_eligible_at: nextEligibleAt?.toISOString(),
        business,
        customer,
      })
    }

    // 10. Check cooldown (most recent confirmed visit)
    const lastConfirmedVisit = visits[visits.length - 1] ?? null
    const { onCooldown, nextEligibleAt } = checkCooldown(lastConfirmedVisit, cooldownHours)

    if (onCooldown && nextEligibleAt) {
      return NextResponse.json<TapResult>({
        state: 'cooldown',
        customer_name: customer.first_name ?? undefined,
        tier: currentTier ?? undefined,
        tiers,
        reward_cycle_stamps: rewardCycleStamps,
        lifetime_visits: lifetimeVisits,
        next_eligible_at: nextEligibleAt.toISOString(),
        business,
        customer,
      })
    }

    // 11. Check reward availability
    const activeTier = currentTier ?? lowestTier
    if (activeTier && isRewardAvailable(rewardCycleStamps, activeTier)) {
      return NextResponse.json<TapResult>({
        state: 'reward',
        customer_name: customer.first_name ?? undefined,
        tier: activeTier,
        tiers,
        reward_cycle_stamps: rewardCycleStamps,
        lifetime_visits: lifetimeVisits,
        reward_description: activeTier.reward_description ?? undefined,
        business,
        customer,
      })
    }

    // 12. Rapid succession check (all recent visits including pending)
    const { data: allRecentVisits } = await supabase
      .from('visits')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('business_id', business.id)
      .gte('created_at', new Date(Date.now() - 3_600_000).toISOString())

    if (checkRapidSuccession(allRecentVisits ?? [])) {
      await createFraudAlert(supabase, {
        businessId: business.id,
        cardId: card.id,
        customerId: customer.id,
        alertType: 'rapid_succession',
        description: `3+ taps in 60 minutes for card ${cardUuid.slice(0, 14)}…`,
      })
      // Do NOT block — just alert
    }

    // 13. Create pending visit
    const { data: pendingVisit, error: visitError } = await supabase
      .from('visits')
      .insert({
        customer_id: customer.id,
        business_id: business.id,
        card_id: card.id,
        status: 'pending',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single()

    if (visitError || !pendingVisit) {
      console.error('Failed to create pending visit:', visitError)
      return NextResponse.json({ state: 'not_found' }, { status: 500 })
    }

    return NextResponse.json<TapResult>({
      state: 'pending',
      visit_id: pendingVisit.id,
      customer_name: customer.first_name ?? undefined,
      tier: activeTier ?? undefined,
      tiers,
      reward_cycle_stamps: rewardCycleStamps,
      lifetime_visits: lifetimeVisits,
      business,
      customer,
    })
  } catch (err) {
    console.error('Tap route error:', err)
    return NextResponse.json({ state: 'not_found' }, { status: 500 })
  }
}
