'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ACCOUNT_OVERVIEW, UPDATE_PROFILE } from '@/lib/queries'
import { ORDER_STATUS_LABEL, formatDate, formatMnt, nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import PhoneVerify from '@/components/PhoneVerify'
import ProductImage from '@/components/ProductImage'

const STATUS_TONE = {
  awaiting_payment: 'border-amber-300 text-amber-700 bg-amber-50',
  paid: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  packed: 'border-blue-300 text-blue-700 bg-blue-50',
  shipped: 'border-blue-300 text-blue-700 bg-blue-50',
  delivered: 'border-emerald-300 text-emerald-700 bg-emerald-50',
  cancelled: 'border-line text-ink-soft bg-shade',
  refunded: 'border-violet-300 text-violet-700 bg-violet-50',
  oversold: 'border-red-300 text-red-700 bg-red-50',
}

export default function AccountPage() {
  const { isAuthenticated, ready, user } = useSession()
  const { signOut } = useAuthUpgrade()

  const { data, refetch } = useQuery(ACCOUNT_OVERVIEW, {
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  const profile = nodes(data?.profileCollection)[0]
  const orders = nodes(data?.orderCollection)
  const orderCount = data?.orderCollection?.totalCount ?? 0
  const wishlistCount = nodes(data?.wishlistItemCollection).length
  const addressCount = nodes(data?.addressCollection).length

  if (!ready) return <Loading />

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-24 text-center">
        <h1 className="text-[22px] font-bold">Профайл</h1>
        <p className="mt-2 text-[14px] text-ink-soft">Үргэлжлүүлэхийн тулд нэвтэрнэ үү.</p>
        <Link href="/login?next=/account" className="btn-solid mt-6 inline-block px-8 py-3.5">
          Нэвтрэх
        </Link>
      </div>
    )
  }

  const displayName = profile?.fullName?.trim() || profile?.email?.split('@')[0] || 'Сайн байна уу'

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[1px] text-ink-faint">Профайл</p>
          <h1 className="mt-1.5 text-[clamp(1.6rem,3.5vw,2.2rem)] font-bold tracking-[-.02em]">
            {displayName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {profile?.email ?? user?.email}
            {profile?.phone && ` · ${profile.phone}`}
            {profile?.createdAt && ` · ${formatDate(profile.createdAt)}-с хойш`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <Link href="/admin" className="btn-outline px-5 py-2.5">Админ самбар</Link>
          )}
          <button onClick={signOut} className="text-[13px] text-ink-soft hover:text-ink">Гарах</button>
        </div>
      </header>

      {/* Tiles double as navigation: the counts answer "is there anything
          here?" before the shopper spends a click finding out. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tile href="/orders" label="Захиалга" value={orderCount} hint="Захиалгын түүх" />
        <Tile href="/wishlist" label="Хадгалсан" value={wishlistCount} hint="Дараа авах бараа" />
        <Tile href="/checkout" label="Хаяг" value={addressCount} hint="Хүргэлтийн хаяг" />
      </div>

      {!profile?.phoneVerifiedAt && (
        <section className="mt-6 border border-ink p-6">
          <h2 className="text-[15px] font-bold">Утасны дугаараа баталгаажуулах</h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-ink-soft">
            Баталгаажуулсны дараа зөвхөн утсаараа нэвтэрч, хүргэлтийн үед холбогдоход
            ашиглагдана.
          </p>
          <div className="mt-5 max-w-sm">
            <PhoneVerify onVerified={() => refetch()} initialPhone={profile?.phone ?? ''} />
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">Сүүлийн захиалга</h2>
            {orderCount > 0 && (
              <Link href="/orders" className="link-underline text-[13px] text-ink-soft">Бүгдийг үзэх</Link>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="mt-4 border border-line bg-shade px-6 py-12 text-center">
              <p className="text-[14px] font-medium">Захиалга алга</p>
              <p className="mt-1 text-[13px] text-ink-soft">Эхний захиалгаа өгөөрэй.</p>
              <Link href="/shop" className="btn-solid mt-5 inline-block px-7 py-3">Дэлгүүр рүү</Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => {
                const items = nodes(o.orderItemCollection)
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.orderNumber}`}
                      className="flex items-center gap-4 border border-line p-4 transition-colors hover:border-ink">
                      <span className="flex -space-x-3">
                        {items.slice(0, 3).map((i) => (
                          <span key={i.id}
                            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-paper bg-shade">
                            <ProductImage filePath={i.imagePath} alt={i.productTitle} seed={i.id} sizes="48px" />
                          </span>
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold tabular-nums">{o.orderNumber}</span>
                        <span className="block text-[12px] text-ink-faint">{formatDate(o.placedAt)}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[o.status] ?? 'border-line text-ink-soft'}`}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                        {formatMnt(o.totalMnt)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <ProfileDetails profile={profile} onSaved={refetch} />
      </div>
    </div>
  )
}

function ProfileDetails({ profile, onSaved }) {
  const [save, { loading }] = useMutation(UPDATE_PROFILE)
  const [fullName, setFullName] = useState('')
  const [marketing, setMarketing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setFullName(profile?.fullName ?? '')
    setMarketing(Boolean(profile?.marketingOptIn))
  }, [profile])

  const dirty =
    fullName !== (profile?.fullName ?? '') || marketing !== Boolean(profile?.marketingOptIn)

  return (
    <section className="border border-line p-6">
      <h2 className="text-[15px] font-bold">Хувийн мэдээлэл</h2>

      <form
        className="mt-5"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null); setSaved(false)
          try {
            await save({ variables: { set: { fullName: fullName.trim() || null, marketingOptIn: marketing } } })
            setSaved(true)
            onSaved?.()
          } catch (e) {
            setError(e?.message ?? 'Хадгалахад алдаа гарлаа.')
          }
        }}
      >
        <label className="block">
          <span className="text-[12px] font-medium text-ink-soft">Нэр</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Таны нэр"
            className="mt-1.5 w-full border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-ink"
          />
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox" checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-black"
          />
          <span className="text-[13px] text-ink-soft">
            Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээлэл имэйлээр авах
          </span>
        </label>

        {/* Email and phone are identity, not preferences: changing either means
            re-verifying, so they are shown here and changed through sign-in. */}
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">Имэйл</dt>
            <dd className="truncate">{profile?.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">Утас</dt>
            <dd>
              {profile?.phone ?? '—'}
              {profile?.phoneVerifiedAt && (
                <span className="ml-1.5 text-[11px] font-semibold text-emerald-700">баталгаажсан</span>
              )}
            </dd>
          </div>
        </dl>

        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
        {saved && !dirty && <p className="mt-3 text-[13px] text-emerald-700">Хадгалагдлаа.</p>}

        <button type="submit" disabled={loading || !dirty} className="btn-solid mt-5 w-full py-3">
          {loading ? 'Хадгалж байна…' : 'Хадгалах'}
        </button>
      </form>
    </section>
  )
}

function Tile({ href, label, value, hint }) {
  return (
    <Link href={href} className="group border border-line p-5 transition-colors hover:border-ink">
      <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-ink-faint">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-ink-soft group-hover:text-ink">{hint} →</p>
    </Link>
  )
}

const Loading = () => (
  <div className="mx-auto max-w-[1000px] px-5 py-10 lg:px-8">
    <div className="h-24 animate-pulse border border-line bg-shade" />
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse border border-line bg-shade" />)}
    </div>
  </div>
)
