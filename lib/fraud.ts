import type { SupabaseClient } from '@supabase/supabase-js'
import type { Visit } from '@/types/database'

/**
 * Check if a customer has exceeded the daily stamp limit for today (SAST).
 */
export function checkDailyLimit(confirmedVisits: Visit[], dailyLimit = 1): boolean {
  const sastOffset = 2 * 60 * 60 * 1000
  const nowSAST = new Date(Date.now() + sastOffset)
  const todayStr = nowSAST.toISOString().slice(0, 10)

  const todayConfirmed = confirmedVisits.filter((v) => {
    if (!v.confirmed_at) return false
    const visitSAST = new Date(new Date(v.confirmed_at).getTime() + sastOffset)
    return visitSAST.toISOString().slice(0, 10) === todayStr
  })

  return todayConfirmed.length >= dailyLimit
}

/**
 * Check if 3+ visits exist in the last 60 minutes (rapid succession pattern).
 * Returns true if fraud pattern detected. Does NOT block — only alerts.
 */
export function checkRapidSuccession(visits: Visit[]): boolean {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = visits.filter((v) => new Date(v.created_at) > oneHourAgo)
  return recent.length >= 3
}

/**
 * Create a fraud alert record in the database.
 * Alerts are visible to operators at /operator/alerts — they do NOT block stamps.
 */
export async function createFraudAlert(
  supabase: SupabaseClient,
  data: {
    businessId: string
    cardId: string
    customerId: string
    alertType: string
    description: string
  }
): Promise<void> {
  const { error } = await supabase.from('fraud_alerts').insert({
    business_id: data.businessId,
    card_id: data.cardId,
    customer_id: data.customerId,
    alert_type: data.alertType,
    description: data.description,
    status: 'open',
  })

  if (error) {
    console.error('Failed to create fraud alert:', error)
  }
}
