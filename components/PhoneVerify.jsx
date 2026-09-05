'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'

const POLL_MS = 3000

/**
 * verify.mn phone verification.
 *
 * The user texts a code we mint to 144773 from the number they are claiming, so
 * the SMS itself is the proof. Two rules drive this UI:
 *
 *  - Every SMS costs the user 150₮ whether it matches or not. The send action
 *    disappears and polling stops the moment the session verifies, and we never
 *    ask them to send twice for one session.
 *  - The reply SMS is carrier-dependent — Unitel substitutes its own text, Lime
 *    sends none at all — so the result is shown here, from sessionStatus, and
 *    never inferred from whether a reply arrived.
 */
export default function PhoneVerify({ onVerified, initialPhone = '' }) {
  const [phone, setPhone] = useState(initialPhone)
  const [session, setSession] = useState(null)
  const [status, setStatus] = useState('idle') // idle | starting | pending | verified | expired
  const [error, setError] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const pollRef = useRef(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  // Countdown from the session's own expiry, so the user can see the window.
  useEffect(() => {
    if (!session?.expiresAt || status !== 'pending') return
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(session.expiresAt) - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) { stopPolling(); setStatus('expired') }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session, status, stopPolling])

  const start = async () => {
    setError(null)
    setStatus('starting')
    try {
      const res = await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStatus('idle')
        setError(body.code === 'NOT_CONFIGURED'
          ? 'Утсаар баталгаажуулах түр боломжгүй байна. Имэйлээр үргэлжлүүлнэ үү.'
          : body.error ?? 'Эхлүүлж чадсангүй.')
        return
      }
      setSession(body)
      setStatus('pending')
      poll(body.sessionId)
    } catch {
      setStatus('idle')
      setError('Сүлжээний алдаа.')
    }
  }

  const poll = (sessionId) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/verify/status?sessionId=${encodeURIComponent(sessionId)}`)
        const body = await res.json()

        if (body.status === 'VERIFIED') {
          stopPolling()
          setStatus('verified')
          // The phone was attached to the account server-side; refresh so the
          // client session reflects it before checkout continues.
          await supabaseBrowser().auth.refreshSession()
          onVerified?.({ phone: body.phone, outcome: body.outcome })
        } else if (body.status === 'EXPIRED') {
          stopPolling()
          setStatus('expired')
        }
      } catch {
        // Transient network trouble: keep polling until the deadline.
      }
    }, POLL_MS)
  }

  if (status === 'verified') {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
        Утасны дугаар баталгаажлаа: <strong>{session?.phone ?? phone}</strong>
      </p>
    )
  }

  return (
    <div>
      {status !== 'pending' && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="label text-ink-faint">Утасны дугаар</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="99112233"
              className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
            />
          </label>
          <button
            onClick={start}
            disabled={status === 'starting' || phone.replace(/\D/g, '').length < 8}
            className="btn-solid px-6 py-3"
          >
            {status === 'starting' ? 'Түр хүлээнэ үү…' : 'Код авах'}
          </button>
        </div>
      )}

      {status === 'pending' && session && (
        <div className="border border-ink p-5">
          {/* Verbatim: it names the number the user must send FROM, and sending
              from a different SIM is the most common reason this fails. */}
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

      {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
    </div>
  )
}
