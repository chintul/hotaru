'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import { useSession } from '@/components/useSession'
import PhoneVerify from '@/components/PhoneVerify'

/**
 * Sign-in, laid out like the reference's hosted auth screen: a narrow centred
 * column on an off-white ground, wordmark above, one primary action, an "or"
 * rule, then the secondary path. Nothing else on the page — it is the one
 * screen where a second option costs conversions.
 */
function SignIn() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  const { upgrade, busy, error } = useAuthUpgrade()
  const { isAuthenticated } = useSession()

  const [method, setMethod] = useState('phone')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(null)

  if (isAuthenticated) {
    return (
      <div className="text-center">
        <p className="text-[14px] text-ink-soft">Та нэвтэрсэн байна.</p>
        <button onClick={() => router.push(next)} className="btn-solid mt-5 w-full rounded-full py-3.5">
          Үргэлжлүүлэх
        </button>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-[20px] font-semibold tracking-[-.01em]">Нэвтрэх</h1>
      <p className="mt-1 text-[13px] text-ink-soft">Нэвтрэх эсвэл шинэ бүртгэл үүсгэх</p>

      {method === 'phone' ? (
        <div className="mt-6">
          <PhoneVerify onVerified={() => router.push(next)} />
          <Divider />
          <button
            onClick={() => setMethod('email')}
            className="w-full rounded-lg border border-line py-3 text-[14px] font-medium transition-colors hover:border-ink"
          >
            Имэйлээр үргэлжлүүлэх
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await upgrade({ email, password })
              if (res.ok) router.push(next)
              else if (res.message?.toLowerCase().includes('confirm')) {
                setNotice('Имэйлээ шалгаж баталгаажуулна уу.')
              }
            }}
          >
            {/* Rounded field with the submit arrow inside it, as the reference
                does — one visual unit rather than a field plus a button. */}
            <div className="relative">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Имэйл" autoComplete="email"
                className="w-full rounded-lg border-2 border-line px-4 py-3.5 text-[14px] outline-none transition-colors focus:border-ink"
              />
            </div>
            <input
              type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Нууц үг"
              autoComplete="current-password"
              className="mt-3 w-full rounded-lg border-2 border-line px-4 py-3.5 text-[14px] outline-none transition-colors focus:border-ink"
            />

            {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
            {notice && <p className="mt-3 text-[13px] text-ink-soft">{notice}</p>}

            <button type="submit" disabled={busy} className="btn-solid mt-4 w-full rounded-full py-3.5">
              {busy ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}
            </button>
          </form>

          <Divider />
          <button
            onClick={() => setMethod('phone')}
            className="w-full rounded-lg border border-line py-3 text-[14px] font-medium transition-colors hover:border-ink"
          >
            Утсаар үргэлжлүүлэх
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-[12px] text-ink-faint">
        Үргэлжлүүлснээр манай{' '}
        <Link href="/returns" className="link-underline">үйлчилгээний нөхцөл</Link>-ийг зөвшөөрнө.
      </p>
    </>
  )
}

const Divider = () => (
  <div className="my-5 flex items-center gap-3">
    <span className="h-px flex-1 bg-line" />
    <span className="text-[12px] text-ink-faint">эсвэл</span>
    <span className="h-px flex-1 bg-line" />
  </div>
)

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] bg-shade">
      <div className="mx-auto w-full max-w-[380px] px-5 py-16">
        <Link href="/" className="mb-10 block text-center text-[26px] font-bold tracking-tight">
          hotaru<span className="text-ink-faint">.</span>
        </Link>
        <Suspense fallback={<p className="text-center text-[13px] text-ink-faint">…</p>}>
          <SignIn />
        </Suspense>
      </div>
    </div>
  )
}
