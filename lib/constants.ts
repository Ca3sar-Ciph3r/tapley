export const FAQ_ITEMS = [
  {
    q: 'What happens when a staff member leaves?',
    a: 'You log into your dashboard, open the card assignment, and tap Reassign. The physical card stays with the company. The old profile goes offline. New profile goes live. Takes about 30 seconds.',
  },
  {
    q: 'Do recipients need an app to receive my details?',
    a: 'Zero apps needed. When they tap your card (NFC) or scan the QR code, their phone opens a standard browser page. One tap to save your contact. That\'s it.',
  },
  {
    q: 'What if someone has an older phone without NFC?',
    a: 'Every Tapley card includes both NFC and a QR code. iPhone 7 and up support NFC natively. Any camera-equipped phone can scan the QR. You\'re covered either way.',
  },
  {
    q: 'How long does it take to get the physical cards?',
    a: 'Typically 5–7 business days after your order is confirmed and your design is approved. Rush options available.',
  },
  {
    q: 'Can I customise the card design?',
    a: 'Yes. Cards are printed to your brand — your logo, your colours, your finish (matte or gloss). You keep brand control. No Tapley branding appears on your card unless you want it.',
  },
  {
    q: 'What does the digital profile look like?',
    a: 'Clean, mobile-first, fast-loading page with your photo, title, contact links, social profiles, and a save contact button. You can see a live demo above.',
  },
  {
    q: 'Is my data safe? Is it POPIA compliant?',
    a: 'Yes. Tapley is built for South African data requirements. Contact data is not sold or shared. Consent flows are built into the save contact flow. Full POPIA documentation available on request.',
  },
  {
    q: 'What happens if I lose a card?',
    a: 'Log in, mark that card as inactive. The profile goes offline immediately. No one can access the old contact details. Order a replacement and reassign when it arrives.',
  },
  {
    q: 'Can we manage multiple teams or locations?',
    a: 'Yes. The business dashboard supports multiple teams, locations, and departments. Assign cards by branch, sort staff by team, and get analytics by location.',
  },
  {
    q: 'Is there a lock-in contract?',
    a: 'No. Month-to-month billing on the base plans. Annual plans available at a discount if you want them.',
  },
]

export const PRICING_PLANS = [
  {
    name: 'Starter',
    monthlyPrice: 490,
    annualPrice: 392,
    description: 'Small teams, 1 location',
    features: [
      { text: 'Up to 10 cards', included: true },
      { text: 'Unlimited profile updates', included: true },
      { text: 'NFC + QR on all cards', included: true },
      { text: 'Basic analytics', included: true },
      { text: '1 admin user', included: true },
      { text: 'Multi-location', included: false },
      { text: 'Team analytics', included: false },
    ],
    cta: 'Start with Starter',
    variant: 'outline' as const,
  },
  {
    name: 'Growth',
    monthlyPrice: 1290,
    annualPrice: 1032,
    description: 'Growing teams, multi-location',
    badge: 'Most Popular',
    features: [
      { text: 'Up to 50 cards', included: true },
      { text: 'Unlimited profile updates', included: true },
      { text: 'NFC + QR on all cards', included: true },
      { text: 'Full analytics + tap history', included: true },
      { text: '5 admin users', included: true },
      { text: 'Multi-location support', included: true },
      { text: 'Priority support', included: true },
      { text: 'White-label / custom domain', included: false },
    ],
    cta: 'Get Growth →',
    variant: 'brand' as const,
    featured: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    description: 'Franchises, large corporates',
    features: [
      { text: 'Unlimited cards', included: true },
      { text: 'Unlimited admins', included: true },
      { text: 'White-label options', included: true },
      { text: 'Custom domain for profiles', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'SLA + uptime guarantee', included: true },
      { text: 'API access', included: true },
      { text: 'POPIA documentation package', included: true },
    ],
    cta: 'Talk to us →',
    variant: 'outline' as const,
  },
]

export const USE_CASES = [
  {
    id: 'sales',
    icon: 'TrendingUp',
    title: 'Sales Teams',
    headline: 'Close faster. Never fumble for a card again.',
    body: 'Sales reps tap phones, share profiles, get saved instantly. CRM links, LinkedIn, WhatsApp — all in one tap.',
    cta: 'Built for sales →',
  },
  {
    id: 'franchise',
    icon: 'Building2',
    title: 'Franchises & Multi-Location',
    headline: 'One dashboard. Every location.',
    body: 'Assign and manage cards for every branch from HQ. Staff changes at a franchise don\'t require head office visits.',
    cta: 'Franchise solution →',
    badge: 'Perfect for Karam Africa-style businesses',
  },
  {
    id: 'onboarding',
    icon: 'Users',
    title: 'Corporate Onboarding',
    headline: 'Day 1 ready. Card included.',
    body: 'New hire walks in. Their card is pre-ordered, their profile is ready. Tap. Done.',
    cta: 'Streamline onboarding →',
  },
  {
    id: 'events',
    icon: 'CalendarCheck',
    title: 'Events & Expos',
    headline: 'Every expo. Same cards. Different staff.',
    body: 'Bring 10 cards to any event. Assign whoever\'s attending that day. Collect analytics on who tapped after.',
    cta: 'Event use case →',
  },
  {
    id: 'professional',
    icon: 'Briefcase',
    title: 'Professional Services',
    headline: 'Your brand. Your trust. On every card.',
    body: 'Lawyers, accountants, consultants — your firm card, their profile. Consistent brand no matter who hands it over.',
    cta: 'For professionals →',
  },
]

export const FEATURES = [
  {
    id: 'reassignment',
    title: 'Instant Profile Reassignment',
    description: 'Tap any card to any profile. Works in real-time. No reprint. No delay. No waste.',
    badge: 'Core feature',
    size: 'large' as const,
    icon: 'Shuffle',
  },
  {
    id: 'nfc-qr',
    title: 'NFC + QR Dual Mode',
    description: 'Every card taps with NFC and scans with QR. 100% phone compatibility.',
    size: 'medium' as const,
    icon: 'Wifi',
  },
  {
    id: 'profile-editor',
    title: 'Live Profile Editor',
    description: 'Update phone, title, links — instantly live on every card linked to that profile.',
    size: 'small' as const,
    icon: 'Pencil',
  },
  {
    id: 'dashboard',
    title: 'Team Dashboard',
    description: 'See all cards, all profiles, all assignments in one place.',
    size: 'small' as const,
    icon: 'LayoutDashboard',
  },
  {
    id: 'analytics',
    title: 'Analytics & Tap Tracking',
    description: 'Know who\'s getting tapped, when, and from where.',
    size: 'small' as const,
    icon: 'BarChart2',
  },
  {
    id: 'vcf',
    title: 'vCard / Contact Save',
    description: 'One tap and they\'re saved to the recipient\'s phone. No app needed.',
    size: 'small' as const,
    icon: 'Contact',
  },
  {
    id: 'popia',
    title: 'POPIA-Compliant',
    description: 'Built for South Africa. Data handling, consent flows, and storage designed to POPIA standards.',
    badge: 'South Africa ✓',
    size: 'wide' as const,
    icon: 'Shield',
  },
]
