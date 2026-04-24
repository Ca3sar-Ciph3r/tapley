import { MarketingNav } from '@/components/layout/MarketingNav'
import { MarketingFooter } from '@/components/layout/MarketingFooter'
import { Hero } from '@/components/sections/Hero'
import { LogoBar } from '@/components/sections/LogoBar'
import { Problem } from '@/components/sections/Problem'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { Features } from '@/components/sections/Features'
import { SocialProof } from '@/components/sections/SocialProof'
import { UseCases } from '@/components/sections/UseCases'
import { Demo } from '@/components/sections/Demo'
import { FAQ } from '@/components/sections/FAQ'
import { Pricing } from '@/components/sections/Pricing'
import { FinalCTA } from '@/components/sections/FinalCTA'

export default function HomePage() {
  return (
    <div className="marketing-page bg-[#080808]">
      <MarketingNav />
      <main>
        <Hero />
        <LogoBar />
        <Problem />
        <HowItWorks />
        <Features />
        <SocialProof />
        <UseCases />
        <Demo />
        <FAQ />
        <Pricing />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </div>
  )
}
