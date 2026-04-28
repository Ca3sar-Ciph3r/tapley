// app/(onboard)/onboard/_types.ts
//
// Shared types for the self-service onboarding wizard.

export type WizardStep = 'plan' | 'company' | 'account' | 'branding' | 'payment'

export const WIZARD_STEPS: WizardStep[] = ['plan', 'company', 'account', 'branding', 'payment']

export const STEP_LABELS: Record<WizardStep, string> = {
  plan:     'Plan',
  company:  'Company',
  account:  'Account',
  branding: 'Branding',
  payment:  'Payment',
}

export type WizardPlan = {
  tierName: string       // 'QR Digital' | 'Solo' | 'Starter' | 'Growth' | 'Scale' | 'Enterprise'
  cardCount: number
  isQrDigital: boolean
  billingCycle: 'monthly' | 'annual'
  monthlyTotalZar: number
  setupTotalZar: number
  annualDiscountedTotalZar: number
}

export type WizardCompany = {
  name: string
  industry: string
  companySize: string
  website: string
  tagline: string
  challenge: string
}

export type WizardAccount = {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type WizardBrand = {
  logoUrl: string | null       // public URL after Storage upload
  logoPath: string | null      // Storage path (for updates)
  primaryColor: string
  secondaryColor: string
  isDark: boolean
  cardTemplate: 'minimal' | 'bold' | 'split'
}

export type WizardState = {
  plan:    WizardPlan | null
  company: WizardCompany | null
  account: WizardAccount | null
  brand:   WizardBrand | null
  companyId: string | null      // set after createPendingCompany() succeeds
}
