import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import {
  calculateTier,
  calculateRewardCycleStamps,
  isRewardAvailable,
  getLowestTier,
} from '@/lib/business-rules'
import { queueAndSend, Templates } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_uuid, confirmed_by } = body

    if (!card_uuid) {
      return NextResponse.json({ data: null, error: 'card_uuid is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 1. Look up card → customer → business
    const { data: card } = await supabase
      .from('cards')
      .select('*, businesses(*)')
      .eq('card_uuid', card_uuid)
      .single()

    if (!card?.customer_id) {
      return NextResponse.json({ data: null, error: 'Card not found or not registered' }, { status: 404 })
    }

    const business = card.businesses

    // 2. Load customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', card.customer_id)
      .single()

    if (!customer) {
      return NextResponse.json({ data: null, error: 'Customer not found' }, { status: 404 })
    }

    // 3. Load tiers + confirmed visits + last redemption
    const [{ data: tiers }, { data: confirmedVisits }, { data: redemptions }] = await Promise.all([
      supabase.from('tiers').select('*').eq('business_id', business.id).order('level', { ascending: true }),
      supabase
        .from('visits')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('business_id', business.id)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: true }),
      supabase
        .from('redemptions')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('business_id', business.id)
        .order('redeemed_at', { ascending: false })
        .limit(1),
    ])

    const visits = confirmedVisits ?? []
    const lastRedemption = redemptions?.[0] ?? null
    const allTiers = tiers ?? []

    const lifetimeVisits = visits.length
    const currentTier = calculateTier(lifetimeVisits, allTiers)
    const rewardCycleStamps = calculateRewardCycleStamps(visits, lastRedemption)
    const activeTier = currentTier ?? getLowestTier(allTiers)

    // 4. Verify reward is available
    if (!activeTier || !isRewardAvailable(rewardCycleStamps, activeTier)) {
      return NextResponse.json(
        { data: null, error: 'No reward available to redeem' },
        { status: 400 }
      )
    }

    // 5. Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from('redemptions')
      .insert({
        customer_id: customer.id,
        business_id: business.id,
        tier_id: activeTier.id,
        reward_description: activeTier.reward_description,
        confirmed_by: confirmed_by ?? 'customer',
      })
      .select('id')
      .single()

    if (redemptionError || !redemption) {
      console.error('Failed to create redemption:', redemptionError)
      return NextResponse.json({ data: null, error: 'Failed to process redemption' }, { status: 500 })
    }

    // 6. Write audit log
    await supabase.from('audit_log').insert({
      business_id: business.id,
      actor: confirmed_by ?? 'customer',
      action: 'REDEMPTION_CONFIRMED',
      entity_type: 'redemption',
      entity_id: redemption.id,
      after_state: {
        customer_id: customer.id,
        tier: activeTier.name,
        reward: activeTier.reward_description,
        reward_cycle_stamps: rewardCycleStamps,
      },
      reason: 'Customer redeemed reward',
    })

    // 7. Queue WhatsApp confirmation
    if (customer.whatsapp_opt_in && customer.whatsapp_number) {
      const [templateName, params] = Templates.redemptionConfirmed(
        customer.first_name ?? 'there',
        activeTier.reward_description ?? 'your reward',
        business.name
      )
      await queueAndSend(
        supabase,
        customer.id,
        business.id,
        customer.whatsapp_number,
        templateName,
        params
      )
    }

    return NextResponse.json({
      data: {
        state: 'redeemed',
        reward_description: activeTier.reward_description,
        tier_name: activeTier.name,
      },
      error: null,
    })
  } catch (err) {
    console.error('Redeem route error:', err)
    return NextResponse.json({ data: null, error: 'Redemption failed' }, { status: 500 })
  }
}
