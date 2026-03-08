import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { queueAndSend, Templates } from '@/lib/whatsapp'

function normalizePhone(raw: string): string {
  // Strip all non-digits
  let digits = raw.replace(/\D/g, '')
  // Convert leading 0 to 27
  if (digits.startsWith('0')) {
    digits = '27' + digits.slice(1)
  }
  // If they typed without country code (9 digits starting with 6/7/8)
  if (digits.length === 9 && /^[678]/.test(digits)) {
    digits = '27' + digits
  }
  return '+' + digits
}

function isValidSAMobile(phone: string): boolean {
  // +27 followed by 6, 7, or 8, then 8 more digits = 11 digits after +
  return /^\+27[678]\d{8}$/.test(phone)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_uuid, first_name, whatsapp_number, whatsapp_opt_in } = body

    if (!card_uuid || !first_name?.trim() || !whatsapp_number) {
      return NextResponse.json(
        { data: null, error: 'Missing required fields: card_uuid, first_name, whatsapp_number' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhone(whatsapp_number)
    if (!isValidSAMobile(normalizedPhone)) {
      return NextResponse.json(
        { data: null, error: 'Please enter a valid South African mobile number' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 1. Look up card → business
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*, businesses(*)')
      .eq('card_uuid', card_uuid)
      .single()

    if (cardError || !card) {
      return NextResponse.json(
        { data: null, error: 'Card not found' },
        { status: 404 }
      )
    }

    if (card.customer_id) {
      return NextResponse.json(
        { data: null, error: 'Card is already registered' },
        { status: 409 }
      )
    }

    const business = card.businesses

    // 2. Load tiers to get the first reward info for welcome message
    const { data: tiers } = await supabase
      .from('tiers')
      .select('*')
      .eq('business_id', business.id)
      .order('level', { ascending: true })

    const firstTier = tiers?.[0]

    // 3. Create customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        business_id: business.id,
        first_name: first_name.trim(),
        whatsapp_number: normalizedPhone,
        whatsapp_opt_in: whatsapp_opt_in ?? true,
        opt_in_at: whatsapp_opt_in ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (customerError || !customer) {
      console.error('Failed to create customer:', customerError)
      return NextResponse.json(
        { data: null, error: 'Failed to create account' },
        { status: 500 }
      )
    }

    // 4. Update card: link customer, activate
    await supabase
      .from('cards')
      .update({
        customer_id: customer.id,
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    // 5. Insert customer_cards junction
    await supabase.from('customer_cards').insert({
      customer_id: customer.id,
      card_id: card.id,
      is_primary: true,
    })

    // 6. Queue welcome WhatsApp message
    if (whatsapp_opt_in && business.whatsapp_phone && firstTier) {
      const [templateName, params] = Templates.welcome(
        first_name.trim(),
        business.name,
        firstTier.reward_description ?? 'your first reward',
        firstTier.visit_threshold
      )
      await queueAndSend(supabase, customer.id, business.id, normalizedPhone, templateName, params)
    }

    return NextResponse.json({
      data: {
        customer_id: customer.id,
        redirect: `/status?card=${card_uuid}&state=new`,
      },
      error: null,
    })
  } catch (err) {
    console.error('Register route error:', err)
    return NextResponse.json(
      { data: null, error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
