'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useSession } from '@/components/useSession'
import PhoneVerify from '@/components/PhoneVerify'
import EmailOtp from '@/components/EmailOtp'
import OAuthButtons from '@/components/OAuthButtons'
import { useRedeemParkedCart } from '@/components/CartHandoff'

function SignIn() {
  useRedeemParkedCart()

  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/account'
  // /auth/callback sends the shopper back here when the provider denied consent
  // or the code exchange failed, rather than leaving them on a blank page.
  const oauthFailed = params.get('oauth') === 'failed'
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

      {oauthFailed && (
        <p className="mt-5 rounded-lg bg-sale/10 px-4 py-3 text-[13px] text-sale">
          Нэвтэрч чадсангүй. Дахин оролдоно уу.
        </p>
      )}

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
        <img src="/logo.png" alt="hotaru" width={591} height={113} className="h-10 w-auto" />
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
