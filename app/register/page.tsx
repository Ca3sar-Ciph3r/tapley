import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase-server'
import BusinessTheme from '@/components/ui/BusinessTheme'
import RegisterForm from './RegisterForm'

async function getRegisterData(cardUuid: string) {
  const supabase = createServiceClient()

  const { data: card } = await supabase
    .from('cards')
    .select('*, businesses(*)')
    .eq('card_uuid', cardUuid)
    .single()

  if (!card || card.customer_id) return null

  const business = card.businesses
  if (!business) return null

  const { data: tiers } = await supabase
    .from('tiers')
    .select('*')
    .eq('business_id', business.id)
    .order('level', { ascending: true })

  return {
    card,
    business,
    firstTier: tiers?.[0] ?? null,
  }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { card?: string }
}) {
  const cardUuid = searchParams.card

  if (!cardUuid) notFound()

  const registerData = await getRegisterData(cardUuid)

  if (!registerData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F5] px-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm max-w-sm w-full">
          <p className="text-lg font-bold text-[#16181D]">Card already registered</p>
          <p className="mt-2 text-sm text-[#A7A3A8]">
            This card is already linked to an account.
          </p>
        </div>
      </div>
    )
  }

  const { business, firstTier } = registerData

  return (
    <BusinessTheme brandColor={business.brand_color} className="min-h-screen">
      <RegisterForm
        cardUuid={cardUuid}
        business={business}
        firstTier={firstTier}
      />
    </BusinessTheme>
  )
}
