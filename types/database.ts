export type BusinessStatus = 'pipeline' | 'live' | 'suspended'
export type CardStatus = 'unactivated' | 'active' | 'blacklisted' | 'replaced'
export type VisitStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'
export type FraudAlertStatus = 'open' | 'investigating' | 'dismissed' | 'resolved'
export type WhatsAppMessageStatus = 'queued' | 'sent' | 'failed'

export type AuditAction =
  | 'STAMP_ADDED'
  | 'STAMP_REMOVED'
  | 'CARD_BLACKLISTED'
  | 'CARD_REPLACED'
  | 'BUSINESS_CREATED'
  | 'TIER_UPDATED'
  | 'REDEMPTION_CONFIRMED'

export interface Business {
  id: string
  slug: string
  name: string
  type: string | null
  brand_color: string
  logo_url: string | null
  hero_image_url: string | null
  whatsapp_phone: string | null
  owner_email: string | null
  monthly_subscription: number
  status: BusinessStatus
  booking_url: string | null
  created_at: string
}

export interface Tier {
  id: string
  business_id: string
  name: string
  level: number
  visit_threshold: number
  reward_description: string | null
  stamp_cooldown_hours: number
  daily_stamp_limit: number
  created_at: string
}

export interface Card {
  id: string
  business_id: string
  card_uuid: string
  customer_id: string | null
  status: CardStatus
  activated_at: string | null
  created_at: string
}

export interface Customer {
  id: string
  business_id: string
  first_name: string | null
  whatsapp_number: string | null
  whatsapp_opt_in: boolean
  opt_in_at: string | null
  created_at: string
}

export interface CustomerCard {
  id: string
  customer_id: string
  card_id: string
  is_primary: boolean
  linked_at: string
}

export interface Visit {
  id: string
  customer_id: string
  business_id: string
  card_id: string
  status: VisitStatus
  confirmed_at: string | null
  expires_at: string
  staff_device_id: string | null
  created_at: string
}

export interface Redemption {
  id: string
  customer_id: string
  business_id: string
  tier_id: string
  reward_description: string | null
  redeemed_at: string
  confirmed_by: string | null
}

export interface WhatsAppMessage {
  id: string
  customer_id: string
  business_id: string
  template_name: string
  payload: Record<string, unknown>
  status: WhatsAppMessageStatus
  sent_at: string | null
  created_at: string
}

export interface FraudAlert {
  id: string
  business_id: string
  card_id: string
  customer_id: string
  alert_type: string
  description: string | null
  status: FraudAlertStatus
  created_at: string
}

export interface AuditLog {
  id: string
  business_id: string
  actor: string
  action: AuditAction
  entity_type: string
  entity_id: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

// ─── Tap state machine return types ─────────────────────────────────────────
export type TapState =
  | 'not_found'
  | 'blacklisted'
  | 'register'
  | 'cooldown'
  | 'reward'
  | 'pending'

export interface TapResult {
  state: TapState
  card_uuid?: string
  visit_id?: string
  customer_name?: string
  tier?: Tier
  tiers?: Tier[]
  reward_cycle_stamps?: number
  lifetime_visits?: number
  next_eligible_at?: string
  business?: Business
  customer?: Customer
  reward_description?: string
}
