import type { SupabaseClient } from '@supabase/supabase-js'

const WHATSAPP_WINDOW_START = 8  // 08:00 SAST
const WHATSAPP_WINDOW_END = 20   // 20:00 SAST

/**
 * Check if current time is within the WhatsApp sending window (08:00–20:00 SAST).
 */
function isWithinSendWindow(): boolean {
  const now = new Date()
  const sastHour = new Date(
    now.toLocaleString('en', { timeZone: 'Africa/Johannesburg' })
  ).getHours()
  return sastHour >= WHATSAPP_WINDOW_START && sastHour < WHATSAPP_WINDOW_END
}

/**
 * Queue a WhatsApp message in the database.
 * The message will be picked up by the send worker.
 */
export async function queueWhatsApp(
  supabase: SupabaseClient,
  customerId: string,
  businessId: string,
  templateName: string,
  params: string[]
): Promise<void> {
  await supabase.from('whatsapp_messages').insert({
    customer_id: customerId,
    business_id: businessId,
    template_name: templateName,
    payload: { params },
    status: 'queued',
  })
}

/**
 * Send a WhatsApp message immediately via Meta Cloud API.
 * If outside the send window, marks record as queued for later delivery.
 */
export async function sendWhatsApp(
  to: string,
  templateName: string,
  params: string[]
): Promise<{ success: boolean; queued?: boolean; error?: string }> {
  if (!isWithinSendWindow()) {
    return { success: true, queued: true }
  }

  const normalizedPhone = to.replace(/\D/g, '').replace(/^0/, '27')

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_ZA' },
            components: [
              {
                type: 'body',
                parameters: params.map((p) => ({ type: 'text', text: p })),
              },
            ],
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('WhatsApp send failed:', error)
      return { success: false, error }
    }

    return { success: true }
  } catch (err) {
    console.error('WhatsApp send error:', err)
    return { success: false, error: String(err) }
  }
}

/**
 * Queue + attempt to send a message. The DB record is always created first.
 * Actual API call only happens if within send window.
 */
export async function queueAndSend(
  supabase: SupabaseClient,
  customerId: string,
  businessId: string,
  to: string,
  templateName: string,
  params: string[]
): Promise<void> {
  // Always queue first
  const { data: msg } = await supabase
    .from('whatsapp_messages')
    .insert({
      customer_id: customerId,
      business_id: businessId,
      template_name: templateName,
      payload: { params },
      status: 'queued',
    })
    .select('id')
    .single()

  if (!msg) return

  // Attempt immediate send if within window
  const result = await sendWhatsApp(to, templateName, params)

  if (result.success && !result.queued) {
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', msg.id)
  }
}

// ─── Template helpers ───────────────────────────────────────────────────────

export const Templates = {
  /** Customer registers for the first time */
  welcome: (customerName: string, businessName: string, rewardName: string, visitsNeeded: number) =>
    ['welcome', [customerName, businessName, rewardName, String(visitsNeeded)]] as const,

  /** Staff confirms a stamp */
  stampConfirmed: (customerName: string, businessName: string, stampNumber: number, stampsRemaining: number, rewardName: string) =>
    ['stamp_confirmed', [customerName, businessName, String(stampNumber), String(stampsRemaining), rewardName]] as const,

  /** Customer reaches a new tier */
  tierUpgrade: (customerName: string, newTierName: string, rewardDescription: string) =>
    ['tier_upgrade', [customerName, newTierName, rewardDescription]] as const,

  /** Customer has earned a reward (all stamps filled) */
  rewardAvailable: (customerName: string, rewardName: string, businessName: string) =>
    ['reward_available', [customerName, rewardName, businessName]] as const,

  /** Staff confirms a redemption */
  redemptionConfirmed: (customerName: string, rewardName: string, businessName: string) =>
    ['redemption_confirmed', [customerName, rewardName, businessName]] as const,

  /** Win-back for inactive customers (manual trigger) */
  winBack: (customerName: string, businessName: string, tierName: string) =>
    ['win_back', [customerName, businessName, tierName]] as const,
}
