'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CHECKOUT_CONTEXT, CREATE_ADDRESS, MY_CART, PLACE_ORDER } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes, toNumber } from '@/lib/format'
import { useCart } from '@/components/useCart'
import { useSession } from '@/components/useSession'
import { useTrack } from '@/components/useTrack'
import ProductImage from '@/components/ProductImage'
import PreorderTag from '@/components/PreorderTag'
import { cartSplit } from '@/components/cartSplit'
import { DEFAULT_DEPOSIT_PCT, isPreorder, unitPriceOf } from '@/lib/preorder'
import { saleOf } from '@/lib/sale'
import type { Address, CartItem, Connection, DeliveryMethod, Order } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { describeVariant } from '@/lib/sizes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/lib/i18n'

interface CheckoutContextData {
  addressCollection: Connection<Address> | null
  deliveryMethodCollection: Connection<DeliveryMethod & { id: string }> | null
}

interface CreateAddressData {
  insertIntoAddressCollection: { records: Address[] | null } | null
}

interface PlaceOrderData {
  placeOrder: Pick<Order, 'orderNumber'> | null
}

const EMPTY_ADDRESS: AddressDraft = {
  recipientName: '', phone: '', cityAimag: 'Улаанбаатар', districtSum: '',
  khorooBag: '', building: '', entrance: '', apartment: '', landmarkNote: '',
}

type AddressDraft = Record<
  | 'recipientName' | 'phone' | 'cityAimag' | 'districtSum' | 'khorooBag'
  | 'building' | 'entrance' | 'apartment' | 'landmarkNote',
  string
>

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, loading: cartLoading } = useCart()
  const { isAuthenticated, ready, user } = useSession()
  const t = useT()

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace('/login?next=/checkout')
    }
  }, [ready, isAuthenticated, router])

  if (!ready || (isAuthenticated && cartLoading && items.length === 0)) {
    return <CheckoutSkeleton />
  }

  if (!isAuthenticated) {
    return <CheckoutSkeleton note={t('Нэвтрэх хуудас руу шилжиж байна…', 'Taking you to sign in…')} />
  }

  if (items.length === 0) {
    return (
      <Shell step={2}>
        <div className="border border-line px-6 py-20 text-center">
          <p className="text-[15px] font-semibold">{t('Сагс хоосон байна', 'Your bag is empty')}</p>
          <p className="mt-1.5 text-[13px] text-ink-soft">{t('Захиалга өгөхийн тулд бараа нэмнэ үү.', 'Add something to place an order.')}</p>
          <Button asChild variant="solid" size="cta" className="mt-6">
            <Link href="/shop">{t('Дэлгүүр рүү', 'Go to shop')}</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell step={2}>
      <CheckoutForm items={items} subtotal={subtotal} profileId={user?.id} />
    </Shell>
  )
}

function Shell({ step, children }: { step: number; children: ReactNode }) {
  const t = useT()
  const crumbs = [t('Сагс', 'Bag'), t('Баталгаажуулалт', 'Checkout'), t('Хүргэлт', 'Delivery')]
  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 lg:px-8">
      <nav className="mb-7 flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
        {crumbs.map((c, i) => (
          <span key={c} className="flex items-center gap-2">
            {i > 0 && <span>›</span>}
            {i === 0 ? (
              <Link href="/shop" className="hover:text-ink">{c}</Link>
            ) : (
              <span className={i === step ? 'font-semibold text-ink' : ''}>{c}</span>
            )}
          </span>
        ))}
      </nav>
      {children}
    </div>
  )
}

function CheckoutSkeleton({ note }: { note?: string }) {
  return (
    <Shell step={1}>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[170px] rounded-2xl border border-line bg-shade" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-2xl border border-line bg-shade" />
      </div>
      {note && <p className="mt-6 text-center text-[13px] text-ink-soft">{note}</p>}
    </Shell>
  )
}

interface CheckoutFormProps {
  items: CartItem[]
  subtotal: number
  profileId: string | undefined
}

function CheckoutForm({ items, subtotal, profileId }: CheckoutFormProps) {
  const router = useRouter()
  const apollo = useApolloClient()
  const { data, loading, refetch } = useQuery<CheckoutContextData>(CHECKOUT_CONTEXT, {
    variables: { profileId },
    skip: !profileId,
  })
  const [placeOrder, { loading: placing }] = useMutation<PlaceOrderData>(PLACE_ORDER)
  const [createAddress, { loading: savingAddress }] = useMutation<CreateAddressData>(CREATE_ADDRESS)
  const track = useTrack()
  const checkoutTracked = useRef(false)
  const t = useT()

  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return
    checkoutTracked.current = true
    track('checkout_start')
  }, [items.length, track])

  const addresses = nodes(data?.addressCollection)
  const methods = nodes(data?.deliveryMethodCollection)

  const [pickedAddressId, setAddressId] = useState<string | null>(null)
  const [pickedMethodId, setMethodId] = useState<string | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(EMPTY_ADDRESS)
  const [addingByChoice, setAddingAddress] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addressId =
    pickedAddressId ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null
  const methodId = pickedMethodId ?? methods[0]?.id ?? null
  const addingAddress = addingByChoice || (!loading && addresses.length === 0)

  const method = methods.find((m) => m.id === methodId)
  const deliveryFee = toNumber(method?.feeMnt)
  const estimate = subtotal + deliveryFee
  const split = cartSplit(items, deliveryFee)

  const onSaveAddress = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await createAddress({
        variables: { objects: [{ ...draft, isDefault: addresses.length === 0 }] },
      })
      const created = res.data?.insertIntoAddressCollection?.records?.[0]
      await refetch()
      if (created) setAddressId(created.id)
      setDraft(EMPTY_ADDRESS)
      setAddingAddress(false)
    } catch (e) {
      setError(errorMessage(e, t('Хаяг хадгалахад алдаа гарлаа.', 'Couldn’t save the address.')))
    }
  }

  const onPlace = async () => {
    setError(null)
    if (!addressId || !methodId) {
      setError(t('Хаяг болон хүргэлтийн хэлбэрээ сонгоно уу.', 'Please choose an address and a delivery option.'))
      return
    }
    try {
      const res = await placeOrder({
        variables: {
          addressId,
          deliveryMethodId: methodId,
          discountCode: discountCode.trim() || null,
          customerNote: note.trim() || null,
        },
      })
      const order = res.data?.placeOrder
      if (order?.orderNumber) {
        track('order_placed', { orderNumber: order.orderNumber })
        await apollo.refetchQueries({ include: [MY_CART] })
        router.push(`/orders/${order.orderNumber}`)
      }
    } catch (e) {
      setError(errorMessage(e, t('Захиалга үүсгэхэд алдаа гарлаа.', 'Couldn’t place your order.')))
    }
  }

  if (loading && !data) return <CheckoutSkeleton />

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
      <div className="space-y-4">
        <Section n={1} title={t('Хүргэлтийн хаяг', 'Delivery address')}>
          {addresses.length > 0 && (
            <div className="space-y-2.5">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 border p-4 transition-colors ${
                    a.id === addressId ? 'border-ink' : 'border-line hover:border-ink-faint'
                  }`}
                >
                  <input type="radio" name="address" checked={a.id === addressId}
                    onChange={() => setAddressId(a.id)} className="mt-1 accent-primary-strong" />
                  <span className="text-[13px]">
                    <span className="block font-semibold">{a.recipientName} · {a.phone}</span>
                    <span className="block text-ink-soft">
                      {[a.cityAimag, a.districtSum, a.khorooBag, a.building,
                        a.entrance && t(`${a.entrance} орц`, `entrance ${a.entrance}`), a.apartment && t(`${a.apartment} тоот`, `apt ${a.apartment}`)]
                        .filter(Boolean).join(', ')}
                    </span>
                    {a.landmarkNote && <span className="block text-ink-faint">{a.landmarkNote}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {addingAddress ? (
            <form onSubmit={onSaveAddress} className={addresses.length ? 'mt-5 border-t border-line pt-5' : ''}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Хүлээн авагч', 'Recipient')} required value={draft.recipientName}
                  onChange={(v) => setDraft({ ...draft, recipientName: v })} />
                <Field label={t('Утас', 'Phone')} required value={draft.phone}
                  onChange={(v) => setDraft({ ...draft, phone: v })} />
                <Field label={t('Хот / аймаг', 'City / province')} required value={draft.cityAimag}
                  onChange={(v) => setDraft({ ...draft, cityAimag: v })} />
                <Field label={t('Дүүрэг / сум', 'District / sum')} required value={draft.districtSum}
                  onChange={(v) => setDraft({ ...draft, districtSum: v })} />
                <Field label={t('Хороо / баг', 'Khoroo / bag')} value={draft.khorooBag}
                  onChange={(v) => setDraft({ ...draft, khorooBag: v })} />
                <Field label={t('Байр / гудамж', 'Building / street')} value={draft.building}
                  onChange={(v) => setDraft({ ...draft, building: v })} />
                <Field label={t('Орц', 'Entrance')} value={draft.entrance}
                  onChange={(v) => setDraft({ ...draft, entrance: v })} />
                <Field label={t('Тоот', 'Apartment')} value={draft.apartment}
                  onChange={(v) => setDraft({ ...draft, apartment: v })} />
                <div className="sm:col-span-2">
                  <Field label={t('Нэмэлт заавар (орчны тэмдэг)', 'Directions (nearby landmark)')} value={draft.landmarkNote}
                    onChange={(v) => setDraft({ ...draft, landmarkNote: v })} />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <Button type="submit" variant="solid" size="touch" disabled={savingAddress}>
                  {savingAddress ? t('Хадгалж байна…', 'Saving…') : t('Хаяг хадгалах', 'Save address')}
                </Button>
                {addresses.length > 0 && (
                  <Button type="button" variant="line" size="touch" onClick={() => setAddingAddress(false)} className="px-5">
                    {t('Болих', 'Cancel')}
                  </Button>
                )}
              </div>
            </form>
          ) : (
            <button onClick={() => setAddingAddress(true)} className="link-underline mt-4 text-[13px] text-ink-soft">
              + {t('Шинэ хаяг нэмэх', 'Add a new address')}
            </button>
          )}
        </Section>

        <Section n={2} title={t('Хүргэлтийн хэлбэр', 'Delivery option')}>
          <div className="space-y-2.5">
            {methods.map((m) => (
              <label key={m.id}
                className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${
                  m.id === methodId ? 'border-ink' : 'border-line hover:border-ink-faint'
                }`}>
                <input type="radio" name="method" checked={m.id === methodId}
                  onChange={() => setMethodId(m.id)} className="accent-primary-strong" />
                <span className="flex-1 text-[13px]">
                  <span className="block font-semibold">{m.name}</span>
                  {m.note && <span className="block text-ink-faint">{m.note}</span>}
                </span>
                <span className="text-[13px] tabular-nums">
                  {toNumber(m.feeMnt) === 0 ? t('Үнэгүй', 'Free') : formatMnt(m.feeMnt)}
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section n={3} title={t('Захиалгын тэмдэглэл', 'Order note')}>
          <Field label={t('Нэмэлт хүсэлт (заавал биш)', 'Special requests (optional)')} value={note} onChange={setNote} />
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line bg-shade p-6">
          <p className="text-[13px] font-bold">{t('Захиалгын хураангуй', 'Order summary')}</p>

          <ul className="mt-5 space-y-4">
            {items.map((i) => {
              const product = i.variant?.product
              const title = copy(product).title
              const image = i.variant?.image ?? firstNode(product?.productImageCollection)
              const unitPrice = unitPriceOf(i.variant, i.quantity)
              const sale = unitPrice === toNumber(i.variant?.priceMnt)
                ? saleOf(i.variant?.priceMnt, i.variant?.compareAtPriceMnt)
                : null
              return (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-line bg-paper">
                    <ProductImage filePath={image?.filePath} alt={title} seed={product?.slug} sizes="56px" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-semibold text-paper">
                      {i.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{title}</span>
                    {describeVariant(i.variant, t('Хэмжээ', 'Size')) && (
                      <span className="block text-[12px] text-ink-faint">{describeVariant(i.variant, t('Хэмжээ', 'Size'))}</span>
                    )}
                    {isPreorder(i.variant, i.quantity) && (
                      <>
                        <PreorderTag eta={product?.preorderEta} className="mt-1" />
                        <span className="mt-0.5 block text-[12px] text-ink-faint">
                          {t('Урьдчилгаа хамгийн багадаа', 'Deposit at least')} {product?.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT}%
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-[13px] tabular-nums">
                    <span className={sale ? 'text-sale' : undefined}>{formatMnt(unitPrice * i.quantity)}</span>
                    {sale && <s className="text-[12px] text-ink-faint">{formatMnt(sale.was * i.quantity)}</s>}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 flex gap-2 border-t border-line pt-5">
            <Input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder={t('Хөнгөлөлтийн код', 'Discount code')}
              aria-label={t('Хөнгөлөлтийн код', 'Discount code')}
              className="h-11 min-w-0 flex-1 rounded-xl bg-paper px-3 text-[13px] md:text-[13px]"
            />
            <span className="grid place-items-center border border-line bg-paper px-3 text-[12px] text-ink-faint">
              {t('Захиалахад тооцно', 'Applied at order')}
            </span>
          </div>

          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
            <Row label={t('Барааны дүн', 'Subtotal')} value={formatMnt(subtotal)} />
            <Row label={t('Хүргэлт', 'Delivery')} value={deliveryFee === 0 ? t('Үнэгүй', 'Free') : formatMnt(deliveryFee)} />
            <div className="flex justify-between border-t border-line pt-3 text-[15px] font-bold">
              <dt>{t('Нийт', 'Total')}</dt>
              <dd className="tabular-nums">{formatMnt(estimate)}</dd>
            </div>
            {split.hasPreorder && (
              <>
                <div className="flex justify-between pt-1 text-[14px] font-semibold">
                  <dt>{t('Одоо хамгийн багадаа', 'Due now, at least')}</dt>
                  <dd className="tabular-nums">{formatMnt(split.upfront)}</dd>
                </div>
                <Row label={t('Бараа ирэхэд хамгийн ихдээ', 'On arrival, at most')} value={formatMnt(split.balance)} />
              </>
            )}
          </dl>

          {split.hasPreorder && (
            <div className="mt-5 rounded-2xl bg-paper p-4 text-[13px] leading-relaxed">
              <p className="font-semibold">{t('Урьдчилсан захиалгын тухай', 'About pre-orders')}</p>
              <p className="mt-1.5 text-ink-soft">
                {t(
                  `Хамгийн багадаа ${formatMnt(split.upfront)} урьдчилж төлнө, бүтэн дүнгээр ч төлж болно. Төлөх дүнгээ дараагийн алхамд өөрөө сонгоно.`,
                  `Pay at least ${formatMnt(split.upfront)} up front, or the full amount if you prefer. You’ll choose how much in the next step.`,
                )}
              </p>
              <p className="mt-1.5 text-ink-soft">
                {t(
                  'Бараа ирмэгц үлдэгдлийн нэхэмжлэл илгээх бөгөөд бүрэн төлөгдсөний дараа бүх бараа тань хамт хүргэгдэнэ.',
                  'We’ll send an invoice for the balance as soon as your items arrive, and deliver everything together once it’s paid in full.',
                )}
              </p>
              <p className="mt-1.5 font-medium text-ink">{t('Урьдчилгаа төлбөр буцаагдахгүйг анхаарна уу.', 'Please note that deposits are non-refundable.')}</p>
            </div>
          )}

          {error && <p className="mt-4 text-[13px] text-sale">{error}</p>}

          <Button variant="solid" size="cta" onClick={onPlace} disabled={placing || !addressId || !methodId}
            className="mt-5 w-full">
            {placing ? t('Илгээж байна…', 'Placing order…') : t('Захиалга баталгаажуулах', 'Place order')}
          </Button>
          <p className="mt-3 text-[12px] text-ink-faint">
            {t('Хөнгөлөлт сервер дээр тооцогдож эцсийн дүн гарна.', 'Discounts are applied on our side to work out the final total.')}
          </p>
        </div>
      </aside>
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border border-line p-6">
      <h2 className="mb-5 flex items-center gap-2.5 text-[15px] font-bold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

function Field({ label, value, onChange, required = false }: FieldProps) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id} className="block text-[12px] font-medium leading-normal text-ink-soft">
        {label}{required && ' *'}
      </Label>
      <Input
        id={id}
        value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 rounded-xl bg-paper px-3 text-[13px] md:text-[13px]"
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
