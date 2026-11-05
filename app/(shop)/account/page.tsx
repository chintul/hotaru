'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ACCOUNT_OVERVIEW, UPDATE_PROFILE } from '@/lib/queries'
import { formatDate, firstNode, nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import PhoneVerify from '@/components/PhoneVerify'
import OrderCard from '@/components/OrderCard'
import type { Address, Connection, Order, Profile, WishlistItem } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useLang, useT } from '@/lib/i18n'

interface AccountOverviewData {
  profileCollection: Connection<Profile> | null
  orderCollection: Connection<Order> | null
  wishlistItemCollection: Connection<WishlistItem> | null
  addressCollection: Connection<Address> | null
}


export default function AccountPage() {
  const { isAuthenticated, ready, user } = useSession()
  const { signOut } = useAuthUpgrade()
  const t = useT()
  const lang = useLang()

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
        <h1 className="text-[22px] font-bold">{t('Профайл', 'Profile')}</h1>
        <p className="mt-2 text-[14px] text-ink-soft">{t('Үргэлжлүүлэхийн тулд нэвтэрнэ үү.', 'Please sign in to continue.')}</p>
        <Button asChild variant="solid" size="cta" className="mt-6">
          <Link href="/login?next=/account">{t('Нэвтрэх', 'Sign in')}</Link>
        </Button>
      </div>
    )
  }

  const displayName = profile?.fullName?.trim() || profile?.email?.split('@')[0] || t('Сайн байна уу', 'Hello')

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-10 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-[12px] font-semibold text-ink-faint">{t('Профайл', 'Profile')}</p>
          <h1 className="mt-1.5 text-[clamp(1.6rem,3.5vw,2.2rem)] font-bold tracking-[-.02em]">
            {displayName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {profile?.email ?? user?.email}
            {profile?.phone && ` · ${profile.phone}`}
            {profile?.createdAt && (lang === 'en' ? ` · since ${formatDate(profile.createdAt)}` : ` · бүртгүүлсэн: ${formatDate(profile.createdAt)}`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <Button asChild variant="line" size="touch" className="px-5">
              <Link href="/admin">{t('Админ самбар', 'Admin dashboard')}</Link>
            </Button>
          )}
          <button onClick={signOut} className="min-h-11 text-[13px] text-ink-soft hover:text-ink">{t('Гарах', 'Sign out')}</button>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Tile href="/orders" label={t('Захиалга', 'Orders')} value={orderCount} hint={t('Захиалгын түүх', 'Order history')} />
        <Tile href="/wishlist" label={t('Хадгалсан', 'Saved')} value={wishlistCount} hint={t('Дараа авах бараа', 'Items for later')} />
        <Tile href="/checkout" label={t('Хаяг', 'Addresses')} value={addressCount} hint={t('Хүргэлтийн хаяг', 'Delivery addresses')} />
      </div>

      {!profile?.phoneVerifiedAt && (
        <section className="mt-6 border border-ink p-6">
          <h2 className="text-[15px] font-bold">{t('Утасны дугаараа баталгаажуулах', 'Verify your phone number')}</h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-ink-soft">
            {t(
              'Баталгаажуулсны дараа утсаараа нэвтэрч болно. Дугаарыг тань хүргэлтийн үед холбогдоход ашиглана.',
              'Once verified, you can sign in with just your phone, and we’ll use it to reach you on delivery.',
            )}
          </p>
          <div className="mt-5 max-w-sm">
            <PhoneVerify onVerified={() => refetch()} initialPhone={profile?.phone ?? ''} />
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">{t('Сүүлийн захиалга', 'Recent orders')}</h2>
            {orderCount > 0 && (
              <Link href="/orders" className="link-underline text-[13px] text-ink-soft">{t('Бүгдийг үзэх', 'View all')}</Link>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="mt-4 border border-line bg-shade px-6 py-12 text-center">
              <p className="text-[14px] font-medium">{t('Захиалга алга', 'No orders yet')}</p>
              <p className="mt-1 text-[13px] text-ink-soft">{t('Эхний захиалгаа өгөөрэй.', 'Place your first order.')}</p>
              <Button asChild variant="solid" size="touch" className="mt-5 px-7">
                <Link href="/shop">{t('Дэлгүүр рүү', 'Go to shop')}</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {orders.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} />
                </li>
              ))}
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
  const t = useT()

  const dirty =
    fullName !== (profile?.fullName ?? '') || marketing !== Boolean(profile?.marketingOptIn)

  return (
    <section className="border border-line p-6">
      <h2 className="text-[15px] font-bold">{t('Хувийн мэдээлэл', 'Personal details')}</h2>

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
            setError(errorMessage(e, t('Хадгалахад алдаа гарлаа.', 'Couldn’t save your changes.')))
          }
        }}
      >
        <div>
          <Label htmlFor={nameId} className="block text-[12px] font-medium leading-normal text-ink-soft">
            {t('Нэр', 'Name')}
          </Label>
          <Input
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('Таны нэр', 'Your name')}
            className="mt-1.5 h-11 rounded-xl bg-paper px-3 text-[13px] md:text-[13px]"
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
            {t('Шинэ бүтээгдэхүүн, хөнгөлөлтийн мэдээллийг имэйлээр авах', 'Email me about new products and offers')}
          </Label>
        </div>

        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('Имэйл', 'Email')}</dt>
            <dd className="truncate">{profile?.email ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-faint">{t('Утас', 'Phone')}</dt>
            <dd>
              {profile?.phone ?? '—'}
              {profile?.phoneVerifiedAt && (
                <span className="ml-1.5 text-[11px] font-semibold text-success-ink">{t('баталгаажсан', 'verified')}</span>
              )}
            </dd>
          </div>
        </dl>

        {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}
        {saved && !dirty && <p className="mt-3 text-[13px] text-success-ink">{t('Хадгалагдлаа.', 'Saved.')}</p>}

        <Button type="submit" variant="solid" size="touch" disabled={loading || !dirty} className="mt-5 w-full">
          {loading ? t('Хадгалж байна…', 'Saving…') : t('Хадгалах', 'Save')}
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
      <p className="text-[12px] font-semibold text-ink-faint">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-ink-soft group-hover:text-ink">{hint} →</p>
    </Link>
  )
}

const Loading = () => (
  <div className="mx-auto max-w-[1000px] px-5 py-10 lg:px-8">
    <Skeleton className="h-24 rounded-2xl border border-line bg-shade" />
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl border border-line bg-shade" />)}
    </div>
  </div>
)
