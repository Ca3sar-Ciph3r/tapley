// lib/email/onboarding.ts
//
// Onboarding drip email functions.
// All functions use the shared Resend client from lib/email/resend.ts.
//
// Drip sequence:
//   Day 0  — sendWelcomeEmail()  — triggered from createCompany server action
//   Day 5  — sendDay5NudgeEmail() — manual trigger from super admin company page
//   Day 14 — sendDay14AnalyticsEmail() — manual trigger from super admin company page
//
// Self-service onboarding:
//   sendAdminNotificationEmail()  — notifies Luke when a self-service company signs up
//   sendClientActivationEmail()   — sent to the client when payment is confirmed
//
// Automated scheduling (cron / Make.com) is post-MVP.

import { getResend, FROM_ADDRESS } from './resend'

// ---------------------------------------------------------------------------
// Day 0 — Welcome
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(params: {
  companyName: string
  adminEmail: string
  adminName: string
  dashboardUrl: string
}): Promise<{ error?: string }> {
  const { companyName, adminEmail, adminName, dashboardUrl } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    Welcome to Tapley Connect, ${adminName ?? companyName}! 👋
  </h1>
  <p style="color: #475569; margin-bottom: 24px;">
    Your company <strong>${companyName}</strong> is now set up on Tapley Connect.
    Your team's digital business cards are ready to be configured.
  </p>

  <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
    Getting started in 3 steps:
  </h2>
  <ol style="color: #475569; padding-left: 20px; line-height: 1.8;">
    <li>Upload your company logo and set your brand colours in <strong>Settings → Branding</strong></li>
    <li>Add your team members in <strong>Team Cards</strong></li>
    <li>Assign NFC cards when they arrive — then tap and test!</li>
  </ol>

  <a href="${dashboardUrl}"
     style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
    Go to your Dashboard →
  </a>

  <hr style="margin: 40px 0; border: none; border-top: 1px solid #e2e8f0;" />
  <p style="font-size: 12px; color: #94a3b8;">
    Tapley Connect · Digital Business Card Platform · South Africa<br />
    Questions? Reply to this email or WhatsApp Luke at +27 41 000 0000.
  </p>
</body>
</html>
`

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `Welcome to Tapley Connect — ${companyName} is live!`,
    html,
  })

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Day 5 — Nudge
// ---------------------------------------------------------------------------

export async function sendDay5NudgeEmail(params: {
  companyName: string
  adminEmail: string
  adminName: string
  analyticsUrl: string
}): Promise<{ error?: string }> {
  const { companyName, adminEmail, adminName, analyticsUrl } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    Have you tapped your card yet, ${adminName ?? companyName}?
  </h1>
  <p style="color: #475569; margin-bottom: 16px;">
    Your team's digital cards have been live for 5 days. If you haven't tapped one yet — grab your
    phone and try it now! Hold it close to any NFC-enabled phone and your card will appear instantly.
  </p>
  <p style="color: #475569; margin-bottom: 24px;">
    You can also check your analytics to see if anyone's been tapping already:
  </p>

  <a href="${analyticsUrl}"
     style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
    View your analytics →
  </a>

  <hr style="margin: 40px 0; border: none; border-top: 1px solid #e2e8f0;" />
  <p style="font-size: 12px; color: #94a3b8;">
    Tapley Connect · Digital Business Card Platform · South Africa
  </p>
</body>
</html>
`

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `${companyName} — Have you tapped your card yet?`,
    html,
  })

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Day 14 — First analytics snapshot
// ---------------------------------------------------------------------------

export async function sendDay14AnalyticsEmail(params: {
  companyName: string
  adminEmail: string
  adminName: string
  viewCount: number
  topCardName: string | null
  dashboardUrl: string
}): Promise<{ error?: string }> {
  const { companyName, adminEmail, adminName, viewCount, topCardName, dashboardUrl } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    Your first 2 weeks on Tapley Connect
  </h1>
  <p style="color: #475569; margin-bottom: 24px;">
    Here's how <strong>${companyName}</strong> has been performing since go-live:
  </p>

  <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #0f172a;">
      ${viewCount.toLocaleString('en-ZA')}
    </p>
    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">
      Total Card Taps
    </p>
    ${topCardName ? `
    <p style="margin-top: 16px; font-size: 14px; color: #475569;">
      Top performer: <strong>${topCardName}</strong>
    </p>
    ` : ''}
  </div>

  <a href="${dashboardUrl}"
     style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
    See full analytics →
  </a>

  <hr style="margin: 40px 0; border: none; border-top: 1px solid #e2e8f0;" />
  <p style="font-size: 12px; color: #94a3b8;">
    Tapley Connect · Digital Business Card Platform · South Africa
  </p>
</body>
</html>
`

  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `${companyName} — your first 2 weeks: ${viewCount} card taps`,
    html,
  })

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Self-service: Admin notification (to Luke / internal team)
// ---------------------------------------------------------------------------

export async function sendAdminNotificationEmail(params: {
  companyName: string
  adminName:   string
  adminEmail:  string
  planName:    string
  cardCount:   number
  setupFeeZar: number
  companyId:   string
}): Promise<{ error?: string }> {
  const { companyName, adminName, adminEmail, planName, cardCount, setupFeeZar, companyId } = params
  const notifyEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!notifyEmail) return {}   // not configured — skip silently

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tapleyconnect.co.za'
  const companyLink = `${appUrl}/admin/${companyId}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    🎉 New self-service sign-up!
  </h1>
  <p style="color: #475569; margin-bottom: 24px;">A new company just completed onboarding and paid their setup fee.</p>

  <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
    <tr>
      <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; width: 140px;">Company</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${companyName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">Admin</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${adminName} — ${adminEmail}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">Plan</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${planName} · ${cardCount} cards</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600;">Setup fee</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">R ${setupFeeZar.toFixed(2)}</td>
    </tr>
  </table>

  <a href="${companyLink}"
     style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
    View in Tapley Admin →
  </a>

  <hr style="margin: 32px 0; border: none; border-top: 1px solid #e2e8f0;" />
  <p style="font-size: 11px; color: #94a3b8;">Tapley Connect — Internal notification</p>
</body>
</html>
`

  const { error } = await getResend().emails.send({
    from:    FROM_ADDRESS,
    to:      notifyEmail,
    subject: `New sign-up: ${companyName} (${planName} · ${cardCount} cards)`,
    html,
  })

  return { error: error?.message }
}

// ---------------------------------------------------------------------------
// Self-service: Client activation email (to the new client admin)
// ---------------------------------------------------------------------------

export async function sendClientActivationEmail(params: {
  companyName:  string
  adminEmail:   string
  adminName:    string
  planName:     string
  cardCount:    number
  dashboardUrl: string
}): Promise<{ error?: string }> {
  const { companyName, adminEmail, adminName, planName, cardCount, dashboardUrl } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 32px 24px;">
  <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">
    Welcome to Tapley Connect, ${adminName}! 🎉
  </h1>
  <p style="color: #475569; margin-bottom: 8px;">
    Your payment is confirmed and <strong>${companyName}</strong> is now live on Tapley Connect.
  </p>
  <p style="color: #475569; margin-bottom: 24px;">
    You're on the <strong>${planName} plan</strong> with <strong>${cardCount} digital business cards</strong>.
  </p>

  <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
    Your next steps:
  </h2>
  <ol style="color: #475569; padding-left: 20px; line-height: 1.9;">
    <li>Add your team members in <strong>Team Cards</strong></li>
    <li>Your NFC cards will be printed and shipped within 5 business days</li>
    <li>When cards arrive, assign each one to the right team member — takes 30 seconds</li>
    <li>Tap and test — your digital cards are live immediately</li>
  </ol>

  <a href="${dashboardUrl}"
     style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
    Go to my Dashboard →
  </a>

  <hr style="margin: 40px 0; border: none; border-top: 1px solid #e2e8f0;" />
  <p style="font-size: 13px; color: #475569; margin-bottom: 4px;">
    Questions? Reply to this email or WhatsApp us at +27 41 000 0000.
  </p>
  <p style="font-size: 12px; color: #94a3b8;">
    Tapley Connect · Digital Business Card Platform · South Africa
  </p>
</body>
</html>
`

  const { error } = await getResend().emails.send({
    from:    FROM_ADDRESS,
    to:      adminEmail,
    subject: `Your Tapley Connect account is active — ${companyName}`,
    html,
  })

  return { error: error?.message }
}
