'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useSession } from '@/components/useSession'
import { useApolloClient } from '@apollo/client/react'
import { REDEEM_CART_TRANSFER } from '@/lib/queries'
import PhoneVerify from '@/components/PhoneVerify'
import EmailOtp from '@/components/EmailOtp'
import OAuthButtons from '@/components/OAuthButtons'
import { CART_HANDOFF_KEY } from '@/components/OAuthButtons'

function SignIn() {
  useRedeemParkedCart()

  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  const { isAuthenticated, ready } = useSession()

  const [method, setMethod] = useState('phone')

  if (ready && isAuthenticated) {
    return (
      <div className="text-center">
        <p className="text-[14px] text-ink-soft">Та нэвтэрсэн байна.</p>
        <button onClick={() => router.push(next)} className="btn-solid mt-5 w-full rounded-full py-4">
          Үргэлжлүүлэх
        </button>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-.02em]">Нэвтрэх</h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        {next === '/checkout'
          ? 'Захиалгаа баталгаажуулахын тулд нэвтэрнэ үү. Сагс хадгалагдана.'
          : 'Нэвтрэх эсвэл шинэ бүртгэл үүсгэх.'}
      </p>

      <div className="mt-8">
        {/* Phone is the primary path: it is the identity Mongolian shoppers
            actually carry, it proves possession rather than access to an
            inbox, and it is the number the courier will ring. Social and email
            sit below as alternatives. */}
        {method === 'phone' ? (
          <>
            <PhoneVerify onVerified={() => router.push(next)} />

            <Divider />

            <OAuthButtons next={next} />

            <button onClick={() => setMethod('email')} className="secondary-action mt-2.5">
              Имэйлээр үргэлжлүүлэх
            </button>
          </>
        ) : (
          <>
            <EmailOtp onVerified={() => router.push(next)} next={next} />

            <Divider />

            <OAuthButtons next={next} />

            <button onClick={() => setMethod('phone')} className="secondary-action mt-2.5">
              Утсаар үргэлжлүүлэх
            </button>
          </>
        )}
      </div>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-ink-faint">
        Үргэлжлүүлснээр манай{' '}
        <Link href="/returns" className="link-underline">үйлчилгээний нөхцөл</Link>-ийг зөвшөөрнө.
      </p>
    </>
  )
}

/**
 * OAuth navigates away and back, so the cart handoff token was parked in
 * sessionStorage before the redirect. Redeem it once the visitor lands here
 * signed in, then clear it so it is never replayed.
 */
function useRedeemParkedCart() {
  const apollo = useApolloClient()
  const { isAuthenticated } = useSession()

  useEffect(() => {
    if (!isAuthenticated) return
    const token = sessionStorage.getItem(CART_HANDOFF_KEY)
    if (!token) return
    sessionStorage.removeItem(CART_HANDOFF_KEY)
    apollo
      .mutate({ mutation: REDEEM_CART_TRANSFER, variables: { token } })
      .then(() => apollo.resetStore())
      .catch(() => { /* expired or already redeemed */ })
  }, [isAuthenticated, apollo])
}

const Divider = () => (
  <div className="my-6 flex items-center gap-3">
    <span className="h-px flex-1 bg-line" />
    <span className="text-[12px] text-ink-faint">эсвэл</span>
    <span className="h-px flex-1 bg-line" />
  </div>
)

export default function LoginPage() {
  return (
    // Centred in the full viewport rather than pinned near the top: with the
    // chrome gone there is no reason for the form to sit under a band of
    // empty space.
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link href="/" className="mb-10">
        {/* eslint-disable-next-line @next/next/no-img-element -- see ProductImage: no next/image here */}
        <img src="/logo.png" alt="hotaru" width={1200} height={258} className="h-10 w-auto" />
      </Link>

      <div className="w-full max-w-[400px] bg-paper px-7 py-9 shadow-[0_1px_3px_rgba(0,0,0,.06)] sm:px-9 sm:py-10">
        <Suspense fallback={<p className="text-center text-[13px] text-ink-faint">…</p>}>
          <SignIn />
        </Suspense>
      </div>

      <Link href="/shop" className="mt-8 text-[13px] text-ink-soft hover:text-ink">
        ← Дэлгүүр рүү буцах
      </Link>
    </div>
  )
}
