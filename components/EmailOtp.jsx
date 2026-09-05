'use client'

import { useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'

/**
 * Email sign-in by one-time code — no passwords anywhere in this app.
 *
 * Supabase sends both a link and a code for the same OTP, but the code only
 * appears in the email once a custom template is in use, and template overrides
 * are rejected on the free tier with the built-in sender. So both paths are
 * offered: the link always works today, and the code box starts working the
 * moment Resend SMTP is configured. The template is already written.
 */
export default function EmailOtp({ onVerified, next = '/account' }) {
  const apollo = useApolloClient()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState('email') // email | sent | verifying
  const [error, setError] = useState(null)
  const [transferToken, setTransferToken] = useState(null)

  const send = async (e) => {
    e.preventDefault()
    setError(null)
    setPhase('verifying')
    try {
      await ensureSession()
      // Mint the cart handoff before the identity can change.
      try {
        const t = await apollo.mutate({ mutation: ISSUE_CART_TRANSFER })
        setTransferToken(t.data?.issueCartTransferToken ?? null)
      } catch { /* empty cart */ }

      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      })
      if (error) throw error
      setPhase('sent')
    } catch (e) {
      setPhase('email')
      setError(e?.message ?? 'Илгээж чадсангүй.')
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    setError(null)
    setPhase('verifying')
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      if (error) throw error

      if (transferToken) {
        try {
          await apollo.mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token: transferToken } })
        } catch { /* nothing to move */ }
      }
      await apollo.resetStore().catch(() => {})
      onVerified?.({ email })
    } catch (e) {
      setPhase('sent')
      setError(e?.message?.includes('expired') ? 'Код хугацаа нь дууссан байна.' : 'Код буруу байна.')
    }
  }

  if (phase === 'email' || (phase === 'verifying' && !transferToken && !code)) {
    return (
      <form onSubmit={send}>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Имэйл" autoComplete="email" className="auth-input"
        />
        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
        <button type="submit" disabled={phase === 'verifying'} className="btn-solid mt-4 w-full rounded-full py-4">
          {phase === 'verifying' ? 'Илгээж байна…' : 'Код илгээх'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={verify}>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        <strong className="text-ink">{email}</strong> хаяг руу илгээлээ. Имэйл дэх холбоос дээр
        дарж нэвтрэх эсвэл 6 оронтой кодыг доор оруулна уу.
      </p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        placeholder="6 оронтой код"
        className="auth-input mt-4 text-center text-[20px] font-semibold tracking-[8px]"
      />

      {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}

      <button type="submit" disabled={phase === 'verifying' || code.length < 6}
        className="btn-solid mt-4 w-full rounded-full py-4">
        {phase === 'verifying' ? 'Шалгаж байна…' : 'Нэвтрэх'}
      </button>

      <button type="button" onClick={() => { setPhase('email'); setCode(''); setError(null) }}
        className="mt-3 w-full text-[13px] text-ink-soft hover:text-ink">
        Өөр хаяг ашиглах
      </button>
    </form>
  )
}
