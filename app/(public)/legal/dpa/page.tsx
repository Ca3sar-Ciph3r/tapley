// app/(public)/legal/dpa/page.tsx
//
// Data Processing Agreement (DPA) for Tapley Connect.
// Static server component — no data fetching required.
// Governs the relationship between Tapley Connect (processor) and
// companies (responsible parties) under POPIA.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Tapley Connect',
  description: 'Data Processing Agreement between Tapley Connect and subscribing companies under POPIA.',
}

export default function DpaPage() {
  const version = '1.0'
  const effectiveDate = '15 April 2026'

  return (
    <main style={{ fontFamily: 'sans-serif', color: '#1e293b', maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
        Data Processing Agreement
      </h1>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>
        Version {version} · Effective date: {effectiveDate}
      </p>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '40px' }}>
        This agreement is automatically accepted when a company account is created on Tapley Connect.
        The accepted version is recorded against the company record.
      </p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>1. Parties and definitions</h2>
        <p style={p}>
          <strong>&quot;Processor&quot;</strong> means Antigravity Digital (Pty) Ltd, trading as Tapley Connect,
          which operates the platform and processes personal information on behalf of the Responsible Party.
        </p>
        <p style={p}>
          <strong>&quot;Responsible Party&quot;</strong> means the subscribing company that has created an account
          on Tapley Connect and whose staff personal information is processed on the platform.
        </p>
        <p style={p}>
          <strong>&quot;Personal Information&quot;</strong> has the meaning assigned to it in POPIA and includes
          staff full names, job titles, email addresses, and phone numbers entered into the platform.
        </p>
        <p style={p}>
          <strong>&quot;POPIA&quot;</strong> means the Protection of Personal Information Act, No. 4 of 2013,
          as amended from time to time.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>2. Scope of processing</h2>
        <p style={p}>
          The Processor will process Personal Information solely for the purpose of providing the
          Tapley Connect digital business card management service, including:
        </p>
        <ul style={ul}>
          <li style={li}>Storing and displaying staff card data on public card pages.</li>
          <li style={li}>Providing analytics on card view events to the Responsible Party.</li>
          <li style={li}>Sending transactional emails to company administrators.</li>
          <li style={li}>Generating .vcf contact files for download by card viewers.</li>
        </ul>
        <p style={p}>
          The Processor will not use Personal Information for any purpose other than providing
          the service, unless required by law.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>3. Obligations of the Processor</h2>
        <p style={p}>The Processor agrees to:</p>
        <ul style={ul}>
          <li style={li}>Process Personal Information only on documented instructions from the Responsible Party (as reflected in the platform&apos;s intended functionality).</li>
          <li style={li}>Ensure that personnel authorised to process Personal Information are bound by confidentiality obligations.</li>
          <li style={li}>Implement appropriate technical and organisational security measures as described in Clause 5.</li>
          <li style={li}>Not engage a sub-processor without informing the Responsible Party and ensuring equivalent data protection obligations are imposed on the sub-processor.</li>
          <li style={li}>Assist the Responsible Party in responding to data subject requests within 30 days.</li>
          <li style={li}>Notify the Responsible Party without undue delay upon becoming aware of a personal information breach.</li>
          <li style={li}>Delete or return all Personal Information upon termination of the service, at the Responsible Party&apos;s election, within 30 days.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>4. Obligations of the Responsible Party</h2>
        <p style={p}>The Responsible Party agrees to:</p>
        <ul style={ul}>
          <li style={li}>Ensure it has a lawful basis for processing staff Personal Information and sharing it with the Processor.</li>
          <li style={li}>Notify affected staff members that their contact information will appear on a public digital business card accessible by anyone with the card URL.</li>
          <li style={li}>Only submit Personal Information that is accurate and up-to-date.</li>
          <li style={li}>Promptly notify the Processor of any data subject request or complaint received.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>5. Security measures</h2>
        <p style={p}>The Processor implements the following security measures:</p>
        <ul style={ul}>
          <li style={li}>All data transmitted between the platform and users is encrypted via HTTPS/TLS.</li>
          <li style={li}>Database access is controlled by row-level security (RLS) policies ensuring company data isolation.</li>
          <li style={li}>Service-role database credentials are stored as environment secrets and never exposed to the browser or public APIs.</li>
          <li style={li}>Authentication is managed by Supabase Auth with email/password and session tokens.</li>
          <li style={li}>Data is hosted on Supabase in the af-south-1 region (Cape Town, South Africa).</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>6. Sub-processors</h2>
        <p style={p}>The Processor uses the following sub-processors:</p>
        <ul style={ul}>
          <li style={li}><strong>Supabase Inc.</strong> — database, storage, and authentication (af-south-1, Cape Town).</li>
          <li style={li}><strong>Vercel Inc.</strong> — hosting and edge delivery of card pages.</li>
          <li style={li}><strong>Resend Inc.</strong> — transactional email delivery to company administrators.</li>
        </ul>
        <p style={p}>
          The Processor will notify the Responsible Party of any intended changes to this list of
          sub-processors, giving the Responsible Party the opportunity to object.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>7. International data transfers</h2>
        <p style={p}>
          Primary data storage is in South Africa (af-south-1). Edge caching via Vercel may result
          in card page content being served from servers outside South Africa. The Responsible Party
          acknowledges this technical requirement for global performance.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>8. Duration and termination</h2>
        <p style={p}>
          This agreement is in force for the duration of the Responsible Party&apos;s subscription to
          Tapley Connect. Upon termination, the Processor will schedule deletion of all Personal
          Information within 30 days, unless a shorter period is legally required.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>9. Governing law</h2>
        <p style={p}>
          This agreement is governed by the laws of the Republic of South Africa.
          Any disputes will be resolved in the courts of South Africa.
        </p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={h2}>10. Contact</h2>
        <p style={p}>
          For any queries regarding this agreement, contact:{' '}
          <a href="mailto:hello@tapleyconnect.co.za" style={link}>hello@tapleyconnect.co.za</a>
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
