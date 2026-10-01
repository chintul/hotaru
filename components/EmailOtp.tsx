'use client'

import { useState, type SubmitEvent } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'

type Phase = 'email' | 'sent' | 'verifying'

interface IssueCartTransferData {
  issueCartTransferToken: string | null
}

interface EmailOtpProps {
  onVerified?: (result: { email: string }) => void
  next?: string
}

const messageOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
    ? e.message
    : undefined

export default function EmailOtp({ onVerified, next = '/account' }: EmailOtpProps) {
  const apollo = useApolloClient()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState<Phase>('email')
  const [error, setError] = useState<string | null>(null)
  const [transferToken, setTransferToken] = useState<string | null>(null)

  const issueTransferTokenBeforeIdentityChanges = async () => {
    try {
      const { data } = await apollo.mutate<IssueCartTransferData>({ mutation: ISSUE_CART_TRANSFER })
      setTransferToken(data?.issueCartTransferToken ?? null)
    } catch {}
  }

  const send = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPhase('verifying')
    try {
      await ensureSession()
      await issueTransferTokenBeforeIdentityChanges()

      const supabase = await supabaseBrowser()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}${next}`,
        },
      })
      if (otpError) throw otpError
      setPhase('sent')
    } catch (err) {
      setPhase('email')
      setError(messageOf(err) ?? 'Илгээж чадсангүй.')
    }
  }

  const verify = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPhase('verifying')
    try {
      const supabase = await supabaseBrowser()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      })
      if (verifyError) throw verifyError

      if (transferToken) {
        try {
          await apollo.mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token: transferToken } })
        } catch {}
      }
      await apollo.resetStore().catch(() => {})
      onVerified?.({ email })
    } catch (err) {
      setPhase('sent')
      setError(messageOf(err)?.includes('expired') ? 'Код хугацаа нь дууссан байна.' : 'Код буруу байна.')
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
