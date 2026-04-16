// app/(public)/privacy/page.tsx
//
// Plain-language Privacy Policy for Tapley Connect.
// Static server component — no data fetching required.
// POPIA (Protection of Personal Information Act, No. 4 of 2013) compliant.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Tapley Connect',
  description: 'How Tapley Connect collects, uses, and protects your personal information under POPIA.',
}

export default function PrivacyPolicyPage() {
  const effectiveDate = '15 April 2026'

  return (
    <main style={{ fontFamily: 'sans-serif', color: '#1e293b', maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
        Privacy Policy
      </h1>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '40px' }}>
        Effective date: {effectiveDate}
      </p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>1. Who we are</h2>
        <p style={p}>
          Tapley Connect is a digital business card management platform operated by Antigravity Digital
          (Pty) Ltd, a company registered in South Africa. We provide companies with branded digital
          business cards for their staff, accessible via NFC tap or QR scan.
        </p>
        <p style={p}>
          In terms of the Protection of Personal Information Act, No. 4 of 2013 (<strong>POPIA</strong>),
          Tapley Connect acts as the <strong>responsible party</strong> for personal information collected
          through this platform.
        </p>
        <p style={p}>
          Contact us: <a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a>
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>2. What information we collect</h2>
        <p style={p}>We collect the following categories of personal information:</p>
        <ul style={ul}>
          <li style={li}><strong>Staff card data</strong> — full name, job title, department, email address, phone number, and WhatsApp number, as supplied by the employing company.</li>
          <li style={li}><strong>Company admin data</strong> — name and email address of company administrators who access the dashboard.</li>
          <li style={li}><strong>Card view events</strong> — anonymous analytics when a digital card is viewed, including approximate timestamp and the source (NFC tap, QR scan, or direct link). We do not collect the viewer&apos;s personal information without their consent.</li>
          <li style={li}><strong>Contact capture (post-MVP)</strong> — if a viewer elects to share their contact details via a future feature, that data is stored with their explicit consent.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>3. Why we collect this information</h2>
        <p style={p}>We process personal information for the following purposes:</p>
        <ul style={ul}>
          <li style={li}>To render and display digital business card pages to viewers.</li>
          <li style={li}>To allow companies to manage their staff cards via the dashboard.</li>
          <li style={li}>To provide analytics to company administrators (e.g. card view counts).</li>
          <li style={li}>To send transactional emails (welcome, onboarding, monthly digest) to company admins.</li>
          <li style={li}>To comply with our legal obligations.</li>
        </ul>
        <p style={p}>
          We process staff personal information on behalf of the employing company, which is the
          responsible party for that data in terms of the employment relationship.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>4. How we share your information</h2>
        <p style={p}>We do not sell personal information. We share it only where necessary:</p>
        <ul style={ul}>
          <li style={li}><strong>Supabase</strong> — our database and authentication provider (data stored in af-south-1, Cape Town).</li>
          <li style={li}><strong>Vercel</strong> — our hosting provider, which serves card pages globally via edge caching.</li>
          <li style={li}><strong>Resend</strong> — our transactional email provider, used to send admin emails.</li>
        </ul>
        <p style={p}>
          All sub-processors are contractually bound to handle data in accordance with applicable
          data protection law.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>5. How long we keep your information</h2>
        <ul style={ul}>
          <li style={li}><strong>Staff card data</strong> — retained for the duration of the company&apos;s subscription. When a company account is deleted, staff data is scheduled for deletion within 30 days.</li>
          <li style={li}><strong>Card view events</strong> — retained indefinitely for analytics unless a data deletion is requested.</li>
          <li style={li}><strong>Admin account data</strong> — retained for the duration of the admin account.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>6. Your rights under POPIA</h2>
        <p style={p}>You have the right to:</p>
        <ul style={ul}>
          <li style={li}>Request access to personal information we hold about you.</li>
          <li style={li}>Request correction of inaccurate personal information.</li>
          <li style={li}>Request deletion of your personal information (subject to legal retention requirements).</li>
          <li style={li}>Object to the processing of your personal information.</li>
          <li style={li}>Lodge a complaint with the Information Regulator of South Africa.</li>
        </ul>
        <p style={p}>
          To exercise any of these rights, email us at{' '}
          <a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a>.
          We will respond within 30 days.
        </p>
        <p style={p}>
          Information Regulator (South Africa):{' '}
          <a href="https://inforegulator.org.za" style={link} target="_blank" rel="noopener noreferrer">
            inforegulator.org.za
          </a>
          {' '}· complaints.IR@justice.gov.za
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>7. Security</h2>
        <p style={p}>
          We implement reasonable technical and organisational measures to protect personal information,
          including encrypted data transmission (HTTPS), row-level security in our database, and
          restricted access to service-role credentials. No method of transmission over the internet
          is 100% secure; we cannot guarantee absolute security.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>8. Cookies and tracking</h2>
        <p style={p}>
          Tapley Connect uses a session cookie issued by Supabase Auth for authenticated users.
          Card pages do not set tracking cookies on viewers. We use server-side analytics only
          (no third-party tracking pixels on public card pages).
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>9. Changes to this policy</h2>
        <p style={p}>
          We may update this policy from time to time. When we make material changes we will update
          the effective date above and notify company administrators via email.
        </p>
      </section>
    </main>
  )
}

// Inline style objects for readability
const h2: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '12px',
  marginTop: 0,
}

const p: React.CSSProperties = {
  color: '#475569',
  lineHeight: 1.7,
  marginBottom: '12px',
  marginTop: 0,
}

const ul: React.CSSProperties = {
  color: '#475569',
  paddingLeft: '20px',
  marginBottom: '12px',
  marginTop: 0,
}

const li: React.CSSProperties = {
  lineHeight: 1.7,
  marginBottom: '6px',
}

const link: React.CSSProperties = {
  color: '#0d9488',
  textDecoration: 'underline',
}
