'use client'

// components/billing/PayFastForm.tsx
//
// Renders a hidden PayFast payment form and auto-submits it on mount.
// The parent renders this component only when it has valid form params —
// the redirect to PayFast happens within one render cycle.

import { useEffect, useRef } from 'react'
import type { PayFastFormData } from '@/lib/payfast/buildPaymentForm'

interface PayFastFormProps {
  formData: PayFastFormData
}

export function PayFastForm({ formData }: PayFastFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    formRef.current?.submit()
  }, [])

  return (
    <form ref={formRef} method="POST" action={formData.action} className="hidden">
      {formData.fields.map(({ name, value }) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </form>
  )
}
