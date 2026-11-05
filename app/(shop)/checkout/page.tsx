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
import { useUI } from '@/components/UIProvider'
import { IconCheck } from '@/components/Icons'
import { cartSplit } from '@/components/cartSplit'
import { DEFAULT_DEPOSIT_PCT, PREORDER_ARRIVAL_DAYS, isPreorder, unitPriceOf } from '@/lib/preorder'
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
      <Shell step={1}>
        <div className="rounded-2xl border border-line px-6 py-20 text-center">
          <p className="text-[15px] font-semibold">{t('Сагс хоосон байна', 'Your bag is empty')}</p>
          <p className="mt-1.5 text-[13px] text-ink-soft">{t('Захиалахын тулд сагсандаа бараа нэмнэ үү.', 'Add something to place an order.')}</p>
          <Button asChild variant="solid" size="cta" className="mt-6">
            <Link href="/shop">{t('Дэлгүүр рүү', 'Go to shop')}</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell step={1}>
      <CheckoutForm items={items} subtotal={subtotal} profileId={user?.id} />
    </Shell>
  )
}

function Shell({ step, children }: { step: number; children: ReactNode }) {
  const t = useT()
  const { open } = useUI()
  const steps = [t('Сагс', 'Cart'), t('Хүргэлт', 'Delivery'), t('Төлбөр', 'Payment')]
  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 lg:px-8 lg:py-10">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-ink-strong sm:text-[30px]">
        {t('Захиалга', 'Checkout')}
      </h1>
      <ol className="mb-8 mt-4 flex items-center gap-2 text-[13px]" aria-label={t('Захиалгын алхам', 'Checkout steps')}>
        {steps.map((label, i) => {
          const done = i < step
          const current = i === step
          const badge = (
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                done ? 'bg-note-soft text-primary-strong' : current ? 'bg-primary-strong text-on-primary' : 'border border-line text-ink-faint'
              }`}
            >
              {done ? <IconCheck width="14" height="14" aria-hidden="true" /> : i + 1}
            </span>
          )
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
              {i > 0 && <span aria-hidden className="h-px w-6 bg-line sm:w-10" />}
              {i === 0 ? (
                <button type="button" onClick={() => open('cart')} className="flex min-h-10 items-center gap-2 text-ink-soft hover:text-ink">
                  {badge}
                  {label}
                </button>
              ) : (
                <span className={`flex items-center gap-2 ${current ? 'font-semibold text-ink-strong' : 'text-ink-faint'}`}>
                  {badge}
                  {label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
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
  const addressForm = useRef<HTMLFormElement>(null)

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
      await saveDraftAddress()
    } catch (e) {
      setError(errorMessage(e, t('Хаяг хадгалахад алдаа гарлаа.', 'Couldn’t save the address.')))
    }
  }

  const saveDraftAddress = async () => {
    const res = await createAddress({
      variables: { objects: [{ ...draft, isDefault: addresses.length === 0 }] },
    })
    const created = res.data?.insertIntoAddressCollection?.records?.[0]
    await refetch()
    if (created) setAddressId(created.id)
    setDraft(EMPTY_ADDRESS)
    setAddingAddress(false)
    return created?.id ?? null
  }

  const onPlace = async () => {
    setError(null)
    const firstAddress = addresses.length === 0
    if (firstAddress && !addressForm.current?.reportValidity()) return
    if ((!addressId && !firstAddress) || !methodId) {
      setError(t('Хаяг болон хүргэлтийн хэлбэрээ сонгоно уу.', 'Please choose an address and a delivery option.'))
      return
    }
    try {
      const deliverTo = firstAddress ? await saveDraftAddress() : addressId
      if (!deliverTo) {
        setError(t('Хаяг хадгалахад алдаа гарлаа.', 'Couldn’t save the address.'))
        return
      }
      const res = await placeOrder({
        variables: {
          addressId: deliverTo,
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
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                    a.id === addressId ? 'border-primary-strong bg-note-soft/50 ring-1 ring-primary-strong' : 'border-line hover:border-ink-faint'
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
            <form ref={addressForm} onSubmit={onSaveAddress} className={addresses.length ? 'mt-5 border-t border-line pt-5' : ''}>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
                <Field label={t('Хүлээн авагч', 'Recipient')} required value={draft.recipientName} wide
                  autoComplete="name" onChange={(v) => setDraft({ ...draft, recipientName: v })} />
                <Field label={t('Утас', 'Phone')} required value={draft.phone} wide
                  type="tel" autoComplete="tel" onChange={(v) => setDraft({ ...draft, phone: v })} />
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
                <div className="col-span-2">
                  <Field label={t('Нэмэлт тайлбар (ойролцоох байршил)', 'Directions (nearby landmark)')} value={draft.landmarkNote}
                    onChange={(v) => setDraft({ ...draft, landmarkNote: v })} />
                </div>
              </div>
              {addresses.length === 0 && (
                <p className="mt-4 text-[12px] text-ink-faint">
                  {t('Захиалгаа баталгаажуулахад энэ хаяг хадгалагдана.', 'This address is saved when you place the order.')}
                </p>
              )}
              <div className={`mt-5 gap-3 ${addresses.length ? 'flex' : 'hidden'}`}>
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
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                  m.id === methodId ? 'border-primary-strong bg-note-soft/50 ring-1 ring-primary-strong' : 'border-line hover:border-ink-faint'
                }`}>
                <input type="radio" name="method" checked={m.id === methodId}
                  onChange={() => setMethodId(m.id)} className="accent-primary-strong" />
                <span className="flex-1 text-[13px]">
                  <span className="block font-semibold">{m.name}</span>
                  {m.note && <span className="block text-ink-faint">{m.note}</span>}
                </span>
                <span className="text-[14px] font-semibold tabular-nums">
                  {toNumber(m.feeMnt) === 0 ? t('Үнэгүй', 'Free') : formatMnt(m.feeMnt)}
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section title={t('Тэмдэглэл', 'Note')} hint={t('Заавал биш', 'Optional')}>
          <Field label={t('Бидэнд хэлэх зүйл байвал бичээрэй', 'Anything we should know')} value={note} onChange={setNote} />
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl bg-shade p-5 sm:p-6">
          <p className="text-[15px] font-semibold text-ink-strong">{t('Таны захиалга', 'Your order')}</p>

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
                  <span className="relative aspect-[4/5] w-12 shrink-0 rounded-lg bg-paper">
                    <span className="absolute inset-0 overflow-hidden rounded-lg">
                      <ProductImage filePath={image?.filePath} alt={title} seed={product?.slug} sizes="48px" />
                    </span>
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
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
                        <span aria-hidden className="preorder-dot" />
                        {t('Урьдчилгаа', 'Deposit')} {product?.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT}%
                      </span>
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

          <div className="mt-5 border-t border-line pt-5">
            <Label htmlFor="discount-code" className="block text-[12px] font-medium leading-normal text-ink-soft">
              {t('Хөнгөлөлтийн код', 'Discount code')}
            </Label>
            <Input
              id="discount-code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder={t('Байгаа бол оруулна уу', 'If you have one')}
              autoCapitalize="characters"
              className="mt-1.5 h-11 rounded-xl bg-paper px-3 text-[13px] md:text-[13px]"
            />
            {discountCode.trim() && (
              <p className="mt-1.5 text-[12px] text-ink-faint">
                {t('Захиалгаа баталгаажуулах үед кодыг шалгаад хөнгөлөлтийг нийт дүнгээс хасна.', 'We check the code when you place the order and take it off the total.')}
              </p>
            )}
          </div>

          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
            <Row label={t('Барааны дүн', 'Subtotal')} value={formatMnt(subtotal)} />
            <Row label={t('Хүргэлт', 'Delivery')} value={deliveryFee === 0 ? t('Үнэгүй', 'Free') : formatMnt(deliveryFee)} />
            <div className="flex justify-between border-t border-line pt-3 text-[15px] font-bold">
              <dt>{t('Нийт', 'Total')}</dt>
              <dd className="tabular-nums">{formatMnt(estimate)}</dd>
            </div>
          </dl>

          {split.hasPreorder && (
            <div className="mt-4 rounded-xl bg-paper p-4 text-[13px]">
              <div className="flex items-baseline justify-between text-[15px] font-semibold text-ink-strong">
                <span>{t('Одоо төлөх', 'Due now')}</span>
                <span className="tabular-nums">{formatMnt(split.upfront)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-ink-soft">
                <span>{t('Бараа ирэхэд', 'When it arrives')}</span>
                <span className="tabular-nums">{formatMnt(split.balance)}</span>
              </div>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-soft">
                {t(
                  `Энэ бол хамгийн бага урьдчилгаа. Дараагийн алхамд бүтэн дүнгээр нь ч төлж болно. Бараа захиалга баталгаажсанаас хойш ${PREORDER_ARRIVAL_DAYS} хоногт ирнэ. Урьдчилгаа буцаагдахгүй бөгөөд барааг буцаах, солих боломжгүй.`,
                  `This is the minimum deposit; you can pay in full in the next step. Items arrive ${PREORDER_ARRIVAL_DAYS} days after your order is confirmed. Deposits are non-refundable and orders can't be returned or exchanged.`,
                )}
              </p>
              <details className="group mt-2">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-primary-strong marker:hidden">
                  {t('Урьдчилсан захиалга хэрхэн явагддаг вэ?', 'How do pre-orders work?')}
                  <span aria-hidden className="transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  {t(
                    'Бараа ирмэгц үлдэгдлийн нэхэмжлэл илгээнэ. Бүрэн төлөгдсөний дараа бүх бараа тань хамт хүргэгдэнэ.',
                    'We send an invoice for the balance as soon as your items arrive, and deliver everything together once it is paid in full.',
                  )}
                </p>
              </details>
            </div>
          )}

          {error && <p className="mt-4 text-[13px] text-sale">{error}</p>}

          <Button variant="solid" size="cta" onClick={onPlace}
            disabled={placing || savingAddress || !methodId || (!addressId && addresses.length > 0)}
            className="mt-5 w-full">
            {placing || savingAddress ? t('Илгээж байна…', 'Placing order…') : t('Захиалга баталгаажуулах', 'Place order')}
          </Button>
          <p className="mt-3 text-center text-[12px] text-ink-faint">
            {t('Дараагийн алхамд төлбөрөө төлнө.', 'You pay in the next step.')}
          </p>
        </div>
      </aside>
    </div>
  )
}

function Section({ n, title, hint, children }: { n?: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-[16px] font-semibold text-ink-strong">
        {n !== undefined && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-primary-strong text-[12px] text-on-primary">{n}</span>
        )}
        {title}
        {hint && <span className="text-[13px] font-normal text-ink-faint">{hint}</span>}
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
  wide?: boolean
  type?: string
  autoComplete?: string
}

function Field({ label, value, onChange, required = false, wide = false, type, autoComplete }: FieldProps) {
  const id = useId()
  return (
    <div className={wide ? 'col-span-2 sm:col-span-1' : undefined}>
      <Label htmlFor={id} className="block text-[12px] font-medium leading-normal text-ink-soft">
        {label}{required && ' *'}
      </Label>
      <Input
        id={id} type={type} autoComplete={autoComplete}
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
