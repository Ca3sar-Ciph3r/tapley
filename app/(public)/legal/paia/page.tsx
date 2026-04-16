// app/(public)/legal/paia/page.tsx
//
// PAIA (Promotion of Access to Information Act, No. 2 of 2000) Manual
// for Tapley Connect / Antigravity Digital (Pty) Ltd.
// Static server component — no data fetching required.
//
// Section 51 of PAIA requires every private body to compile a manual
// describing the records it holds and how to request access to them.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'PAIA Manual — Tapley Connect',
  description: 'Promotion of Access to Information Act (PAIA) Manual for Tapley Connect / Antigravity Digital (Pty) Ltd.',
}

export default function PaiaManualPage() {
  const effectiveDate = '15 April 2026'

  return (
    <main style={{ fontFamily: 'sans-serif', color: '#1e293b', maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
        PAIA Manual
      </h1>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
        Promotion of Access to Information Act, No. 2 of 2000 · Section 51 Manual
      </p>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '40px' }}>
        Effective date: {effectiveDate}
      </p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>1. Private body details</h2>
        <table style={table}>
          <tbody>
            <tr>
              <td style={tdLabel}>Legal name</td>
              <td style={tdValue}>Antigravity Digital (Pty) Ltd</td>
            </tr>
            <tr>
              <td style={tdLabel}>Trading as</td>
              <td style={tdValue}>Tapley Connect</td>
            </tr>
            <tr>
              <td style={tdLabel}>Country of registration</td>
              <td style={tdValue}>South Africa</td>
            </tr>
            <tr>
              <td style={tdLabel}>Email address</td>
              <td style={tdValue}><a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a></td>
            </tr>
            <tr>
              <td style={tdLabel}>Website</td>
              <td style={tdValue}><a href="https://tapleyconnect.co.za" style={link}>tapleyconnect.co.za</a></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>2. Information Officer</h2>
        <p style={p}>
          In terms of section 17 of POPIA and section 51(1)(a) of PAIA, the Information Officer
          of Antigravity Digital (Pty) Ltd is the Chief Executive Officer / Director of the company.
        </p>
        <p style={p}>
          Contact the Information Officer at:{' '}
          <a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a>
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>3. Guide on how to use PAIA</h2>
        <p style={p}>
          The South African Human Rights Commission (SAHRC) has compiled a guide on how to use PAIA.
          This guide is available from the SAHRC at:{' '}
          <a href="https://www.sahrc.org.za" style={link} target="_blank" rel="noopener noreferrer">sahrc.org.za</a>
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>4. Records held by Tapley Connect</h2>
        <p style={p}>Tapley Connect holds the following categories of records:</p>

        <h3 style={h3}>4.1 Company records</h3>
        <ul style={ul}>
          <li style={li}>Company name, slug, and branding configuration (logo, brand colours).</li>
          <li style={li}>Subscription tier, billing cycle, and pricing information.</li>
          <li style={li}>Primary contact name and email address.</li>
          <li style={li}>Company creation date and onboarding status.</li>
        </ul>

        <h3 style={h3}>4.2 Staff card records</h3>
        <ul style={ul}>
          <li style={li}>Full name, job title, department.</li>
          <li style={li}>Email address and phone numbers (including WhatsApp).</li>
          <li style={li}>Profile photo (if uploaded).</li>
          <li style={li}>NFC card assignment and activation status.</li>
        </ul>

        <h3 style={h3}>4.3 NFC card records</h3>
        <ul style={ul}>
          <li style={li}>NFC card slug (permanent identifier embedded in the physical card chip).</li>
          <li style={li}>Order status and batch information.</li>
        </ul>

        <h3 style={h3}>4.4 Analytics records</h3>
        <ul style={ul}>
          <li style={li}>Card view events (timestamp, source type — NFC/QR/direct).</li>
          <li style={li}>No personally identifiable information about card viewers is collected without their consent.</li>
        </ul>

        <h3 style={h3}>4.5 Administrator account records</h3>
        <ul style={ul}>
          <li style={li}>Administrator email address and encrypted password hash (managed by Supabase Auth).</li>
          <li style={li}>Role (company admin or super admin).</li>
        </ul>

        <h3 style={h3}>4.6 Legal and compliance records</h3>
        <ul style={ul}>
          <li style={li}>Data Processing Agreement acceptance timestamp and version number.</li>
          <li style={li}>Data deletion log (if a deletion has been scheduled).</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>5. Records automatically available</h2>
        <p style={p}>
          The following records are made available by Tapley Connect without a formal PAIA request:
        </p>
        <ul style={ul}>
          <li style={li}>This PAIA Manual (available at <a href="/legal/paia" style={link}>/legal/paia</a>).</li>
          <li style={li}>Privacy Policy (available at <a href="/privacy" style={link}>/privacy</a>).</li>
          <li style={li}>Data Processing Agreement (available at <a href="/legal/dpa" style={link}>/legal/dpa</a>).</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>6. How to request access to records</h2>
        <p style={p}>
          To request access to records held by Tapley Connect, submit a written request to the
          Information Officer at{' '}
          <a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a>.
        </p>
        <p style={p}>Your request must include:</p>
        <ul style={ul}>
          <li style={li}>Your full name and contact details.</li>
          <li style={li}>A description of the records you are requesting.</li>
          <li style={li}>The form in which you wish to receive the records (electronic copy, printed copy, etc.).</li>
          <li style={li}>An indication of your right of access (if applicable).</li>
        </ul>
        <p style={p}>
          We will respond within 30 days of receiving your request. A prescribed fee may be charged
          for the reproduction of records, in accordance with the PAIA Regulations.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>7. Grounds for refusal</h2>
        <p style={p}>
          Access may be refused on the grounds set out in sections 62–70 of PAIA, including where
          disclosure would unreasonably disclose personal information of a third party, reveal trade
          secrets, or be contrary to law.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>8. Remedies available</h2>
        <p style={p}>
          If your request is refused, or we fail to respond within 30 days, you may:
        </p>
        <ul style={ul}>
          <li style={li}>Apply to court for relief under section 78 of PAIA.</li>
          <li style={li}>Lodge a complaint with the Information Regulator of South Africa.</li>
        </ul>
        <p style={p}>
          Information Regulator (South Africa){' '}
          <a href="https://inforegulator.org.za" style={link} target="_blank" rel="noopener noreferrer">
            inforegulator.org.za
          </a>
          {' '}· complaints.IR@justice.gov.za · Tel: 010 023 5207
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>9. Availability of this manual</h2>
        <p style={p}>
          This manual is available free of charge on the Tapley Connect website at{' '}
          <a href="/legal/paia" style={link}>tapleyconnect.co.za/legal/paia</a>{' '}
          and will be submitted to the South African Human Rights Commission as required by PAIA.
        </p>
      </section>
    </main>
  )
}

const h2: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
  marginBottom: '12px',
  marginTop: 0,
}

const h3: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '8px',
  marginTop: '16px',
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

const table: React.CSSProperties = {
  borderCollapse: 'collapse',
  width: '100%',
  marginBottom: '16px',
}

const tdLabel: React.CSSProperties = {
  padding: '8px 16px 8px 0',
  fontWeight: 600,
  color: '#334155',
  width: '180px',
  verticalAlign: 'top',
}

const tdValue: React.CSSProperties = {
  padding: '8px 0',
  color: '#475569',
  verticalAlign: 'top',
}
