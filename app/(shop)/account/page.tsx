'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ACCOUNT_OVERVIEW, UPDATE_PROFILE } from '@/lib/queries'
import { orderStatusLabel, formatDate, formatMnt, firstNode, nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import PhoneVerify from '@/components/PhoneVerify'
import ProductImage from '@/components/ProductImage'
import type { Address, Connection, Order, OrderStatus, Profile, WishlistItem } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

interface AccountOverviewData {
  profileCollection: Connection<Profile> | null
  orderCollection: Connection<Order> | null
  wishlistItemCollection: Connection<WishlistItem> | null
  addressCollection: Connection<Address> | null
}

const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: 'border-warn-line text-warn-ink bg-warn-soft',
  paid: 'border-success-line text-success-ink bg-success-soft',
  packed: 'border-info-line text-info-ink bg-info-soft',
  shipped: 'border-info-line text-info-ink bg-info-soft',
  delivered: 'border-success-line text-success-ink bg-success-soft',
  cancelled: 'border-line text-ink-soft bg-shade',
  refunded: 'border-note-line text-note-ink bg-note-soft',
  oversold: 'border-danger-line text-danger-ink bg-danger-soft',
}

export default function AccountPage() {
  const { isAuthenticated, ready, user } = useSession()
  const { signOut } = useAuthUpgrade()

  const { data, refetch } = useQuery<AccountOverviewData>(ACCOUNT_OVERVIEW, {
    variables: { id: user?.id },
    skip: !isAuthenticated || !user?.id,
    fetchPolicy: 'cache-and-network',
  })

  const profile = firstNode(data?.profileCollection)
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
        <Button asChild variant="solid" size="cta" className="mt-6">
          <Link href="/login?next=/account">Нэвтрэх</Link>
        </Button>
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
            <Button asChild variant="line" size="touch" className="px-5">
              <Link href="/admin">Админ самбар</Link>
            </Button>
          )}
          <button onClick={signOut} className="min-h-11 text-[13px] text-ink-soft hover:text-ink">Гарах</button>
        </div>
      </header>

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
              <Button asChild variant="solid" size="touch" className="mt-5 px-7">
                <Link href="/shop">Дэлгүүр рүү</Link>
              </Button>
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
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${(o.status && STATUS_TONE[o.status]) || 'border-line text-ink-soft'}`}>
                        {orderStatusLabel(o.status)}
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

        <ProfileDetails key={profile?.id ?? 'new'} profile={profile} onSaved={refetch} />
      </div>
    </div>
  )
}

interface ProfileDetailsProps {
  profile: Profile | null
  onSaved?: () => unknown
}

function ProfileDetails({ profile, onSaved }: ProfileDetailsProps) {
  const [save, { loading }] = useMutation(UPDATE_PROFILE)
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [marketing, setMarketing] = useState(Boolean(profile?.marketingOptIn))
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const marketingId = useId()

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
            setError(errorMessage(e, 'Хадгалахад алдаа гарлаа.'))
          }
        }}
      >
        <div>
          <Label htmlFor={nameId} className="block text-[12px] font-medium leading-normal text-ink-soft">
            Нэр
          </Label>
          <Input
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Таны нэр"
            className="mt-1.5 h-11 rounded-none bg-paper px-3 text-[13px] md:text-[13px]"
          />
        </div>

        <div className="mt-4 flex items-start gap-2.5">
          <Checkbox
            id={marketingId}
            checked={marketing}
            onCheckedChange={(checked) => setMarketing(checked === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor={marketingId}
            className="cursor-pointer text-[13px] font-normal leading-normal text-ink-soft"
          >
            Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээлэл имэйлээр авах
          </Label>
        </div>

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
                <span className="ml-1.5 text-[11px] font-semibold text-success-ink">баталгаажсан</span>
              )}
            </dd>
          </div>
        </dl>

        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
        {saved && !dirty && <p className="mt-3 text-[13px] text-success-ink">Хадгалагдлаа.</p>}

        <Button type="submit" variant="solid" size="touch" disabled={loading || !dirty} className="mt-5 w-full">
          {loading ? 'Хадгалж байна…' : 'Хадгалах'}
        </Button>
      </form>
    </section>
  )
}

interface TileProps {
  href: string
  label: string
  value: number
  hint: string
}

function Tile({ href, label, value, hint }: TileProps) {
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
    <Skeleton className="h-24 rounded-none border border-line bg-shade" />
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-none border border-line bg-shade" />)}
    </div>
  </div>
)
