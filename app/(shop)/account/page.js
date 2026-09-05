'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { ME } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import PhoneVerify from '@/components/PhoneVerify'

export default function AccountPage() {
  const { isAuthenticated, ready, user } = useSession()
  const { signOut } = useAuthUpgrade()
  const { data, refetch } = useQuery(ME, {
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })
  const profile = nodes(data?.profileCollection)[0]

  if (!ready) return <p className="label mx-auto max-w-[700px] px-5 py-20 text-ink-faint">…</p>

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-20 text-center">
        <p className="text-ink-soft">Нэвтэрч орно уу.</p>
        <Link href="/login?next=/account" className="label link-underline mt-4 inline-block">Нэвтрэх</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[700px] px-5 py-12 sm:px-8">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">Профайл</h1>

      <dl className="mt-10 divide-y divide-line border-y border-line">
        <Row label="Имэйл" value={profile?.email ?? user?.email ?? '—'} />
        <Row
          label="Утас"
          value={
            profile?.phone
              ? `${profile.phone}${profile.phoneVerifiedAt ? ' · баталгаажсан' : ''}`
              : '—'
          }
        />
        <Row label="Нэр" value={profile?.fullName ?? '—'} />
      </dl>

      {/* Attaching a verified number is what makes phone sign-in possible for
          this account afterwards — including the owner's own admin account. */}
      {!profile?.phoneVerifiedAt && (
        <section className="mt-8 border border-line p-6">
          <h2 className="text-[15px] font-bold">Утасны дугаараа баталгаажуулах</h2>
          <p className="mt-1.5 text-[13px] text-ink-soft">
            Баталгаажуулсны дараа зөвхөн утсаараа нэвтэрч, хүргэлтийн үед холбогдоход
            ашиглагдана.
          </p>
          <div className="mt-5">
            <PhoneVerify onVerified={() => refetch()} initialPhone={profile?.phone ?? ''} />
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
        <Link href="/orders" className="label link-underline">Миний захиалга</Link>
        <Link href="/wishlist" className="label link-underline">Хадгалсан</Link>
        {profile?.role === 'admin' && (
          <Link href="/admin" className="label link-underline text-ink">Админ самбар</Link>
        )}
        <button onClick={signOut} className="label link-underline text-ink-faint">Гарах</button>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-4">
      <dt className="label text-ink-faint">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
