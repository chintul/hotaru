'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'

const POLL_MS = 3000

type Status = 'idle' | 'starting' | 'pending' | 'verified' | 'expired' | 'failed'

interface VerifySession {
  sessionId: string
  phone: string
  shortcode: string
  smsUri: string
  displayInstruction: string
  expiresAt: string
}

interface StartFailure {
  error?: string
  code?: string
}

interface AdoptableSession {
  access_token: string
  refresh_token: string
}

type StatusResponse =
  | { status: 'VERIFIED'; phone: string; outcome: string; session: AdoptableSession | null }
  | { status: 'EXPIRED' }
  | { status: 'ERROR'; message?: string }
  | { status: 'PENDING'; expiresAt?: string }

interface IssueCartTransferData {
  issueCartTransferToken: string | null
}

interface PhoneVerifyProps {
  onVerified?: (result: { phone: string; outcome: string }) => void
  initialPhone?: string
}

export default function PhoneVerify({ onVerified, initialPhone = '' }: PhoneVerifyProps) {
  const [phone, setPhone] = useState(initialPhone)
  const [session, setSession] = useState<VerifySession | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const apollo = useApolloClient()
  const transferTokenRef = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  useEffect(() => {
    if (!session?.expiresAt || status !== 'pending') return
    const expiresAtMs = new Date(session.expiresAt).getTime()
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) { stopPolling(); setStatus('expired') }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session, status, stopPolling])

  const issueTransferTokenWhileCartIsOurs = async () => {
    try {
      const { data } = await apollo.mutate<IssueCartTransferData>({ mutation: ISSUE_CART_TRANSFER })
      transferTokenRef.current = data?.issueCartTransferToken ?? null
    } catch {}
  }

  const adoptExistingAccount = async (adopted: AdoptableSession) => {
    const supabase = await supabaseBrowser()
    await supabase.auth.setSession(adopted)
    if (!transferTokenRef.current) return
    try {
      await apollo.mutate({
        mutation: REDEEM_CART_TRANSFER,
        variables: { token: transferTokenRef.current },
      })
    } catch {}
  }

  const refreshConvertedSession = async () => {
    const supabase = await supabaseBrowser()
    await supabase.auth.refreshSession()
  }

  const poll = (sessionId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/verify/status?sessionId=${encodeURIComponent(sessionId)}`)
        const body: StatusResponse = await res.json()

        if (body.status === 'VERIFIED') {
          stopPolling()
          setStatus('verified')
          if (body.session) {
            await adoptExistingAccount(body.session)
          } else {
            await refreshConvertedSession()
          }
          await apollo.resetStore().catch(() => {})
          onVerified?.({ phone: body.phone, outcome: body.outcome })
        } else if (body.status === 'EXPIRED') {
          stopPolling()
          setStatus('expired')
        } else if (body.status === 'ERROR') {
          stopPolling()
          setError(body.message ?? 'Нэвтэрч чадсангүй.')
          setStatus('failed')
        }
      } catch {}
    }, POLL_MS)
  }

  const start = async () => {
    setError(null)
    setStatus('starting')
    try {
      await ensureSession()
      await issueTransferTokenWhileCartIsOurs()

      const res = await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) {
        const failure: StartFailure = await res.json()
        setStatus('idle')
        setError(failure.code === 'NOT_CONFIGURED'
          ? 'Утсаар баталгаажуулах түр боломжгүй байна. Имэйлээр үргэлжлүүлнэ үү.'
          : failure.error ?? 'Эхлүүлж чадсангүй.')
        return
      }
      const started: VerifySession = await res.json()
      setSession(started)
      setStatus('pending')
      poll(started.sessionId)
    } catch {
      setStatus('idle')
      setError('Сүлжээний алдаа.')
    }
  }

  if (status === 'verified') {
    return (
      <p className="rounded-md border border-success-line bg-success-soft px-4 py-3 text-[13px] text-success-ink">
        Утасны дугаар баталгаажлаа: <strong>{session?.phone ?? phone}</strong>
      </p>
    )
  }

  return (
    <div>
      {status !== 'pending' && (
        <form onSubmit={(e) => { e.preventDefault(); start() }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, ''))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="Утасны дугаар"
            className="auth-input"
          />
          <button
            type="submit"
            disabled={status === 'starting' || phone.replace(/\D/g, '').length < 8}
            className="btn-solid mt-3 w-full rounded-full py-4"
          >
            {status === 'starting' ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}
          </button>
          <p className="mt-2.5 text-center text-[12px] text-ink-faint">
            144773 руу 1 мессеж илгээнэ · 150₮
          </p>
        </form>
      )}

      {status === 'pending' && session && (
        <div className="border border-ink p-5">
          <p className="text-[14px] leading-relaxed">{session.displayInstruction}</p>

          <a
            href={session.smsUri}
            className="btn-solid mt-4 block px-6 py-3.5 text-center"
          >
            Мессеж илгээх
          </a>

          <p className="label mt-3 text-ink-faint">
            {session.shortcode} руу илгээнэ · 1 мессеж 150₮ · {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(2, '0')} үлдлээ
          </p>
          <p className="mt-2 text-[13px] text-ink-soft">
            Илгээсний дараа энэ хуудас автоматаар баталгаажна. Хариу мессеж заримдаа
            ирэхгүй байж болно — үр дүнг эндээс харна уу.
          </p>
        </div>
      )}

      {status === 'expired' && (
        <div className="mt-3 border border-line bg-shade p-4">
          <p className="text-[13px] text-ink-soft">
            Хугацаа дууслаа. Өмнөх код хүчингүй боллоо — шинэ код авч дахин илгээнэ үү.
          </p>
          <button onClick={() => { setSession(null); setStatus('idle') }} className="btn-outline mt-3 px-5 py-2.5">
            Шинэ код авах
          </button>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-3 border border-line bg-shade p-4">
          <p className="text-[13px] text-ink-soft">
            Дугаар баталгаажсан ч нэвтрэлт дуусгаж чадсангүй. Дахин оролдоно уу.
          </p>
          <button
            onClick={() => { setSession(null); setError(null); setStatus('idle') }}
            className="btn-outline mt-3 px-5 py-2.5"
          >
            Дахин оролдох
          </button>
        </div>
      )}

      {error && status !== 'failed' && <p className="mt-3 text-[13px] text-sale">{error}</p>}
    </div>
  )
}
