'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const POLL_MS = 3000

const smsBody = (uri: string): string | null => {
  const match = /[?&]body=([^&]*)/.exec(uri)
  return match ? decodeURIComponent(match[1]) : null
}

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

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

  const reset = () => {
    stopPolling()
    setSession(null)
    setError(null)
    setStatus('idle')
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

  const code = session ? smsBody(session.smsUri) : null

  return (
    <div>
      {status !== 'pending' && (
        <form onSubmit={(e) => { e.preventDefault(); start() }}>
          <Label htmlFor="phone-verify-input" className="text-[13px] font-medium text-ink">Утасны дугаар</Label>
          <Input
            id="phone-verify-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, ''))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="8800 0000"
            className="mt-2 h-13.5 rounded-xl bg-background px-4 text-[16px] tracking-[.5px] md:text-[16px]"
          />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            Код танд ирэхгүй. Дараагийн алхамд та өөрийн утаснаас манай дугаар руу нэг мессеж илгээж баталгаажуулна (150₮).
          </p>
          <Button
            type="submit"
            variant="solid"
            size="cta"
            disabled={status === 'starting' || phone.replace(/\D/g, '').length < 8}
            className="mt-5 w-full rounded-full"
          >
            {status === 'starting' ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}
          </Button>
        </form>
      )}

      {status === 'pending' && session && (
        <div>
          <p className="text-[15px] font-semibold text-ink-strong">Одоо мессеж илгээнэ үү</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            <strong className="font-medium text-ink">{session.phone}</strong> дугаартай утаснаасаа доорх кодыг илгээнэ.
          </p>

          <dl className="mt-4 divide-y divide-line rounded-2xl border border-line-strong bg-background">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[13px] text-ink-soft">Хүлээн авах дугаар</dt>
              <dd className="text-[18px] font-semibold tabular-nums tracking-[1px] text-ink-strong">{session.shortcode}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-[13px] text-ink-soft">Мессежийн текст</dt>
              <dd className="font-mono text-[20px] font-bold tracking-[3px] text-ink-strong">
                {code ?? '—'}
              </dd>
            </div>
          </dl>
          {!code && <p className="mt-2 text-[13px] text-ink-soft">{session.displayInstruction}</p>}

          <Button asChild variant="solid" size="cta" className="mt-4 flex w-full rounded-full lg:hidden">
            <a href={session.smsUri}>Мессеж бичих</a>
          </Button>
          <p className="mt-3 hidden text-[13px] text-ink-soft lg:block">
            Утсаараа <strong className="font-medium text-ink">{session.shortcode}</strong> руу дээрх кодыг мессежээр илгээнэ үү.
          </p>

          <p role="status" className="mt-4 flex items-center gap-2.5 rounded-xl bg-shade px-4 py-3 text-[13px] text-ink-soft">
            <span aria-hidden className="relative grid h-2.5 w-2.5 place-items-center">
              <span className="o-ping absolute h-2.5 w-2.5 rounded-full bg-primary-strong" />
              <span className="h-2 w-2 rounded-full bg-primary-strong" />
            </span>
            <span className="flex-1">Мессежийг хүлээж байна. Ирмэгц автоматаар нэвтэрнэ.</span>
            <span className="tabular-nums text-ink-faint">{formatClock(secondsLeft)}</span>
          </p>

          <div className="mt-3 flex items-center justify-between text-[12px] text-ink-faint">
            <span>1 мессеж 150₮</span>
            <button type="button" onClick={reset} className="min-h-11 text-[13px] text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Өөр дугаар оруулах
            </button>
          </div>
        </div>
      )}

      {status === 'expired' && (
        <div className="mt-4 rounded-2xl border border-line bg-shade p-4">
          <p className="text-[13px] text-ink-soft">
            Хугацаа дууслаа. Өмнөх код хүчингүй боллоо, шинэ код аваад дахин илгээнэ үү.
          </p>
          <Button variant="line" size="touch" onClick={reset} className="mt-3 rounded-full px-5">
            Шинэ код авах
          </Button>
        </div>
      )}

      {status === 'failed' && (
        <div className="mt-4 rounded-2xl border border-line bg-shade p-4">
          <p className="text-[13px] text-ink-soft">
            Дугаар баталгаажсан ч нэвтрэлт дуусгаж чадсангүй. Дахин оролдоно уу.
          </p>
          <Button variant="line" size="touch" onClick={reset} className="mt-3 rounded-full px-5">
            Дахин оролдох
          </Button>
        </div>
      )}

      {error && status !== 'failed' && <p className="mt-3 text-[13px] text-danger-ink">{error}</p>}
    </div>
  )
}
