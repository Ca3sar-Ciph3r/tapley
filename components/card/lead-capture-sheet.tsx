'use client'

// components/card/lead-capture-sheet.tsx
//
// Branded lead-capture bottom-sheet for public card pages.
//
// Behaviour:
//   - Slides up 5 seconds after mount (one-shot per browser session via sessionStorage)
//   - Dismissible via backdrop tap or skip button — won't re-appear this session
//   - On submit: POSTs to /api/lead-capture, shows success state, auto-closes
//   - Fully branded: inherits primaryColor / secondaryColor / isDark from the card page
//
// Props are intentionally all primitives so this component stays serialisable
// and can be passed cleanly from an ISR server page.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

interface LeadCaptureSheetProps {
  staffCardId:     string
  nfcCardId:       string
  staffName:       string
  companyName:     string
  logoUrl:         string | null
  primaryColor:    string
  secondaryColor:  string
  isDark:          boolean
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

const SESSION_KEY = 'tc_lead_captured'

export function LeadCaptureSheet({
  staffCardId,
  nfcCardId,
  staffName,
  companyName,
  logoUrl,
  primaryColor,
  secondaryColor,
  isDark,
}: LeadCaptureSheetProps) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen]       = useState(false)

  // Form fields
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [phone,   setPhone]   = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [popia,   setPopia]   = useState(false)

  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMsg,    setErrorMsg]    = useState('')

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived colours
  const bg             = isDark ? '#1a1b1f' : '#ffffff'
  const border         = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'
  const textPrimary    = isDark ? '#ffffff' : '#111827'
  const textSecondary  = isDark ? 'rgba(255,255,255,0.6)' : '#6B7280'
  const inputBg        = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'
  const inputBorder    = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
  const inputText      = isDark ? '#ffffff' : '#111827'
  const placeholderColor = isDark ? 'rgba(255,255,255,0.35)' : '#9CA3AF'

  const popiaText = `I consent to ${companyName} storing my contact details in compliance with POPIA`

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      return
    }

    timerRef.current = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    }, 5000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function dismiss() {
    setOpen(false)
    sessionStorage.setItem(SESSION_KEY, 'dismissed')
    setTimeout(() => setVisible(false), 400)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    // Client-side validation
    if (!name.trim()) {
      setErrorMsg('Please enter your name.')
      return
    }

    if (!email.trim() && !phone.trim()) {
      setErrorMsg('Please provide at least an email address or phone number.')
      return
    }

    if (!popia) {
      setErrorMsg('Please tick the consent checkbox to continue.')
      return
    }

    setSubmitState('submitting')

    try {
      const res = await fetch('/api/lead-capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_card_id:      staffCardId,
          nfc_card_id:        nfcCardId,
          visitor_name:       name.trim(),
          visitor_email:      email.trim() || null,
          visitor_phone:      phone.trim() || null,
          visitor_company:    company.trim() || null,
          message:            message.trim() || null,
          popia_consent:      true,
          popia_consent_text: popiaText,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const data = body as { error?: string; errors?: Record<string, string> }
        const msg = data.error
          ?? Object.values(data.errors ?? {}).find(Boolean)
          ?? 'Submission failed. Please try again.'
        throw new Error(msg)
      }

      setSubmitState('success')
      sessionStorage.setItem(SESSION_KEY, 'submitted')
      setTimeout(() => {
        setOpen(false)
        setTimeout(() => setVisible(false), 400)
      }, 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setErrorMsg(msg)
      setSubmitState('error')
    }
  }

  if (!visible) return null

  const isSubmitting = submitState === 'submitting'

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={dismiss}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     40,
          background: 'rgba(0,0,0,0.5)',
          opacity:    open ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share your details"
        style={{
          position:            'fixed',
          bottom:              0,
          left:                0,
          right:               0,
          zIndex:              50,
          backgroundColor:     bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius:24,
          borderTop:           `1px solid ${border}`,
          padding:             '20px 20px 40px',
          maxWidth:            480,
          margin:              '0 auto',
          transform:           open ? 'translateY(0)' : 'translateY(100%)',
          transition:          'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow:           '0 -8px 32px rgba(0,0,0,0.24)',
          overflowY:           'auto',
          maxHeight:           '90dvh',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width:           40,
            height:          4,
            borderRadius:    999,
            backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            margin:          '0 auto 20px',
          }}
        />

        {submitState === 'success' ? (
          <SuccessState
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            staffName={staffName}
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              {logoUrl ? (
                <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                  <Image src={logoUrl} alt={companyName} fill style={{ objectFit: 'contain' }} />
                </div>
              ) : (
                <div
                  style={{
                    width:           44,
                    height:          44,
                    borderRadius:    10,
                    backgroundColor: primaryColor,
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    flexShrink:      0,
                    color:           '#fff',
                    fontWeight:      700,
                    fontSize:        18,
                  }}
                >
                  {companyName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: textPrimary, marginBottom: 2 }}>
                  Stay connected with {staffName.split(' ')[0]}
                </p>
                <p style={{ fontSize: 13, color: textSecondary }}>
                  Share your details and {staffName.split(' ')[0]} will be in touch.
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InputField
                  label="Your name"
                  type="text"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Sarah Johnson"
                  required
                  autoComplete="name"
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputText={inputText}
                  placeholderColor={placeholderColor}
                  textPrimary={textPrimary}
                />
                <InputField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="sarah@example.com"
                  autoComplete="email"
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputText={inputText}
                  placeholderColor={placeholderColor}
                  textPrimary={textPrimary}
                />
                <InputField
                  label="Phone / WhatsApp"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+27 82 123 4567"
                  autoComplete="tel"
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputText={inputText}
                  placeholderColor={placeholderColor}
                  textPrimary={textPrimary}
                />
                <InputField
                  label="Your company"
                  type="text"
                  value={company}
                  onChange={setCompany}
                  placeholder="Optional"
                  autoComplete="organization"
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  inputText={inputText}
                  placeholderColor={placeholderColor}
                  textPrimary={textPrimary}
                />

                {/* Message textarea */}
                <div>
                  <label
                    htmlFor="lcs-message"
                    style={{
                      display:    'block',
                      fontSize:   12,
                      fontWeight: 600,
                      color:      textPrimary,
                      marginBottom: 6,
                      opacity:    0.75,
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    id="lcs-message"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Optional — anything you'd like to say"
                    maxLength={200}
                    rows={3}
                    style={{
                      width:           '100%',
                      padding:         '11px 14px',
                      borderRadius:    10,
                      border:          `1px solid ${inputBorder}`,
                      backgroundColor: inputBg,
                      color:           inputText,
                      fontSize:        14,
                      outline:         'none',
                      boxSizing:       'border-box',
                      resize:          'none',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(100,100,255,0.4)')}
                    onBlur={e => (e.currentTarget.style.borderColor = inputBorder)}
                  />
                  <style>{`#lcs-message::placeholder { color: ${placeholderColor}; }`}</style>
                  <p style={{ fontSize: 11, color: textSecondary, textAlign: 'right', marginTop: 2 }}>
                    {message.length}/200
                  </p>
                </div>

                {/* POPIA consent checkbox — required */}
                <label
                  style={{
                    display:    'flex',
                    alignItems: 'flex-start',
                    gap:        10,
                    cursor:     'pointer',
                    marginTop:  4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={popia}
                    onChange={e => setPopia(e.target.checked)}
                    required
                    style={{ marginTop: 2, flexShrink: 0, accentColor: primaryColor }}
                  />
                  <span style={{ fontSize: 12, color: textSecondary, lineHeight: 1.5 }}>
                    {popiaText}.{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: primaryColor, textDecoration: 'underline' }}
                    >
                      Privacy policy
                    </a>
                    {' '}
                    <span style={{ color: '#EF4444' }}>*</span>
                  </span>
                </label>
              </div>

              {/* Error message */}
              {errorMsg && (
                <p style={{ marginTop: 10, fontSize: 13, color: '#EF4444' }}>{errorMsg}</p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting || !popia}
                style={{
                  marginTop:       18,
                  width:           '100%',
                  padding:         '14px 0',
                  borderRadius:    12,
                  backgroundColor: primaryColor,
                  color:           '#ffffff',
                  fontWeight:      700,
                  fontSize:        15,
                  border:          'none',
                  cursor:          (isSubmitting || !popia) ? 'not-allowed' : 'pointer',
                  opacity:         (isSubmitting || !popia) ? 0.6 : 1,
                  transition:      'opacity 0.2s',
                }}
              >
                {isSubmitting ? 'Sending…' : 'Share my details'}
              </button>

              {/* Accent bar at bottom of button */}
              <div
                style={{
                  height:          3,
                  borderRadius:    '0 0 12px 12px',
                  backgroundColor: secondaryColor,
                  marginTop:       -3,
                  width:           '100%',
                }}
              />

              {/* Skip */}
              <button
                type="button"
                onClick={dismiss}
                style={{
                  marginTop:  14,
                  width:      '100%',
                  textAlign:  'center',
                  fontSize:   13,
                  color:      textSecondary,
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  padding:    '4px 0',
                }}
              >
                No thanks, skip
              </button>
            </form>
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface InputFieldProps {
  label:            string
  type:             string
  value:            string
  onChange:         (v: string) => void
  placeholder:      string
  required?:        boolean
  autoComplete?:    string
  inputBg:          string
  inputBorder:      string
  inputText:        string
  placeholderColor: string
  textPrimary:      string
}

function InputField({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  inputBg,
  inputBorder,
  inputText,
  placeholderColor,
  textPrimary,
}: InputFieldProps) {
  const id = `lcs-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display:    'block',
          fontSize:   12,
          fontWeight: 600,
          color:      textPrimary,
          marginBottom: 6,
          opacity:    0.75,
        }}
      >
        {label}
        {required && <span style={{ color: '#EF4444', marginLeft: 2 }}>*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        style={{
          width:           '100%',
          padding:         '11px 14px',
          borderRadius:    10,
          border:          `1px solid ${inputBorder}`,
          backgroundColor: inputBg,
          color:           inputText,
          fontSize:        15,
          outline:         'none',
          boxSizing:       'border-box',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(100,100,255,0.4)')}
        onBlur={e => (e.currentTarget.style.borderColor = inputBorder)}
      />
      <style>{`#${id}::placeholder { color: ${placeholderColor}; }`}</style>
    </div>
  )
}

interface SuccessStateProps {
  primaryColor:   string
  secondaryColor: string
  textPrimary:    string
  textSecondary:  string
  staffName:      string
}

function SuccessState({ primaryColor, secondaryColor, textPrimary, textSecondary, staffName }: SuccessStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      <div
        style={{
          width:           64,
          height:          64,
          borderRadius:    '50%',
          backgroundColor: primaryColor,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          margin:          '0 auto 16px',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <p style={{ fontWeight: 700, fontSize: 17, color: textPrimary, marginBottom: 6 }}>
        Details sent!
      </p>
      <p style={{ fontSize: 14, color: textSecondary, lineHeight: 1.5 }}>
        {staffName.split(' ')[0]} will be in touch with you soon.
      </p>
      <div
        style={{
          height:          3,
          borderRadius:    999,
          backgroundColor: secondaryColor,
          width:           48,
          margin:          '16px auto 0',
        }}
      />
    </div>
  )
}
