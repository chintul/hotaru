'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { ISSUE_CART_TRANSFER, REDEEM_CART_TRANSFER } from '@/lib/queries'
import { ensureSession, supabaseBrowser } from '@/lib/supabase/browser'

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
  const apollo = useApolloClient()
  // Minted before the account can change hands, while we still own the cart.
  const transferTokenRef = useRef(null)

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
      // A visitor arriving straight at /login has no identity yet, and the
      // session has to belong to someone. Mint the anonymous one first — the
      // same identity the cart uses — and verification then converts it in
      // place, so nothing is stranded.
      await ensureSession()

      // If this number turns out to belong to another account we will be signed
      // in as that account, and the cart we are holding would be stranded. Mint
      // the single-use handoff token now, while it is still ours.
      try {
        const t = await apollo.mutate({ mutation: ISSUE_CART_TRANSFER })
        transferTokenRef.current = t.data?.issueCartTransferToken ?? null
      } catch {
        // An empty cart has nothing to hand over.
      }

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
          const supabase = supabaseBrowser()

          if (body.session) {
            // The number belongs to an existing account, so we adopt its
            // session and carry the cart across with the token minted earlier.
            await supabase.auth.setSession(body.session)
            if (transferTokenRef.current) {
              try {
                await apollo.mutate({
                  mutation: REDEEM_CART_TRANSFER,
                  variables: { token: transferTokenRef.current },
                })
              } catch { /* nothing to move */ }
            }
          } else {
            // Same uid kept; refresh so is_anonymous reflects the conversion.
            await supabase.auth.refreshSession()
          }

          await apollo.resetStore().catch(() => {})
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
        <form
          onSubmit={(e) => { e.preventDefault(); start() }}
        >
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
