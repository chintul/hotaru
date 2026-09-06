'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CHECKOUT_CONTEXT, CREATE_ADDRESS, MY_CART, PLACE_ORDER } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes, toNumber } from '@/lib/format'
import { useCart } from '@/components/useCart'
import { useSession } from '@/components/useSession'
import ProductImage from '@/components/ProductImage'

const EMPTY_ADDRESS = {
  recipientName: '', phone: '', cityAimag: 'Улаанбаатар', districtSum: '',
  khorooBag: '', building: '', entrance: '', apartment: '', landmarkNote: '',
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, loading: cartLoading } = useCart()
  const { isAuthenticated, ready, user } = useSession()

  // Signing in is its own screen. Gating inline meant the checkout rendered a
  // login form where the order summary should be, which is both uglier and
  // harder to come back to — /login?next= returns them here when done.
  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.replace('/login?next=/checkout')
    }
  }, [ready, isAuthenticated, router])

  if (!ready || (isAuthenticated && cartLoading && items.length === 0)) {
    return <CheckoutSkeleton />
  }

  if (!isAuthenticated) {
    return <CheckoutSkeleton note="Нэвтрэх хуудас руу шилжиж байна…" />
  }

  if (items.length === 0) {
    return (
      <Shell step={2}>
        <div className="border border-line px-6 py-20 text-center">
          <p className="text-[15px] font-semibold">Сагс хоосон байна</p>
          <p className="mt-1.5 text-[13px] text-ink-soft">Захиалга өгөхийн тулд бараа нэмнэ үү.</p>
          <Link href="/shop" className="btn-solid mt-6 inline-block px-8 py-3.5">Дэлгүүр рүү</Link>
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

function Shell({ step, children }) {
  const crumbs = ['Сагс', 'Баталгаажуулалт', 'Хүргэлт, төлбөр']
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

function CheckoutSkeleton({ note }) {
  return (
    <Shell step={1}>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[170px] animate-pulse border border-line bg-shade" />
          ))}
        </div>
        <div className="h-[320px] animate-pulse border border-line bg-shade" />
      </div>
      {note && <p className="mt-6 text-center text-[13px] text-ink-soft">{note}</p>}
    </Shell>
  )
}

function CheckoutForm({ items, subtotal, profileId }) {
  const router = useRouter()
  const apollo = useApolloClient()
  const { data, loading, refetch } = useQuery(CHECKOUT_CONTEXT, {
    variables: { profileId },
    skip: !profileId,
  })
  const [placeOrder, { loading: placing }] = useMutation(PLACE_ORDER)
  const [createAddress, { loading: savingAddress }] = useMutation(CREATE_ADDRESS)

  const addresses = nodes(data?.addressCollection)
  const methods = nodes(data?.deliveryMethodCollection)
  const bank = nodes(data?.storeSettingsCollection)[0]

  const [addressId, setAddressId] = useState(null)
  const [methodId, setMethodId] = useState(null)
  const [discountCode, setDiscountCode] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(EMPTY_ADDRESS)
  const [addingAddress, setAddingAddress] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!addressId && addresses.length) {
      setAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id)
    }
    if (!methodId && methods.length) setMethodId(methods[0].id)
    if (addresses.length === 0 && !loading) setAddingAddress(true)
  }, [addresses, methods, addressId, methodId, loading])

  const method = methods.find((m) => m.id === methodId)
  const deliveryFee = toNumber(method?.feeMnt)
  const estimate = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee])

  const onSaveAddress = async (e) => {
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
      setError(e?.message ?? 'Хаяг хадгалахад алдаа гарлаа.')
    }
  }

  const onPlace = async () => {
    setError(null)
    if (!addressId || !methodId) {
      setError('Хаяг болон хүргэлтийн хэлбэрээ сонгоно уу.')
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
        // place_order converts the cart, so the header count must not keep
        // showing it from cache.
        await apollo.refetchQueries({ include: [MY_CART] })
        router.push(`/orders/${order.orderNumber}`)
      }
    } catch (e) {
      setError(e?.message ?? 'Захиалга үүсгэхэд алдаа гарлаа.')
    }
  }

  if (loading && !data) return <CheckoutSkeleton />

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
      <div className="space-y-4">
        <Section n={1} title="Хүргэлтийн хаяг">
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
                    onChange={() => setAddressId(a.id)} className="mt-1 accent-black" />
                  <span className="text-[13px]">
                    <span className="block font-semibold">{a.recipientName} · {a.phone}</span>
                    <span className="block text-ink-soft">
                      {[a.cityAimag, a.districtSum, a.khorooBag, a.building,
                        a.entrance && `${a.entrance} орц`, a.apartment && `${a.apartment} тоот`]
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
                <Field label="Хүлээн авагч" required value={draft.recipientName}
                  onChange={(v) => setDraft({ ...draft, recipientName: v })} />
                <Field label="Утас" required value={draft.phone}
                  onChange={(v) => setDraft({ ...draft, phone: v })} />
                <Field label="Хот / аймаг" required value={draft.cityAimag}
                  onChange={(v) => setDraft({ ...draft, cityAimag: v })} />
                <Field label="Дүүрэг / сум" required value={draft.districtSum}
                  onChange={(v) => setDraft({ ...draft, districtSum: v })} />
                <Field label="Хороо / баг" value={draft.khorooBag}
                  onChange={(v) => setDraft({ ...draft, khorooBag: v })} />
                <Field label="Байр / гудамж" value={draft.building}
                  onChange={(v) => setDraft({ ...draft, building: v })} />
                <Field label="Орц" value={draft.entrance}
                  onChange={(v) => setDraft({ ...draft, entrance: v })} />
                <Field label="Тоот" value={draft.apartment}
                  onChange={(v) => setDraft({ ...draft, apartment: v })} />
                <div className="sm:col-span-2">
                  <Field label="Нэмэлт заавар (орчны тэмдэг)" value={draft.landmarkNote}
                    onChange={(v) => setDraft({ ...draft, landmarkNote: v })} />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button type="submit" disabled={savingAddress} className="btn-solid px-6 py-3">
                  {savingAddress ? 'Хадгалж байна…' : 'Хаяг хадгалах'}
                </button>
                {addresses.length > 0 && (
                  <button type="button" onClick={() => setAddingAddress(false)} className="btn-outline px-5 py-3">
                    Болих
                  </button>
                )}
              </div>
            </form>
          ) : (
            <button onClick={() => setAddingAddress(true)} className="link-underline mt-4 text-[13px] text-ink-soft">
              + Шинэ хаяг нэмэх
            </button>
          )}
        </Section>

        <Section n={2} title="Хүргэлтийн хэлбэр">
          <div className="space-y-2.5">
            {methods.map((m) => (
              <label key={m.id}
                className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${
                  m.id === methodId ? 'border-ink' : 'border-line hover:border-ink-faint'
                }`}>
                <input type="radio" name="method" checked={m.id === methodId}
                  onChange={() => setMethodId(m.id)} className="accent-black" />
                <span className="flex-1 text-[13px]">
                  <span className="block font-semibold">{m.name}</span>
                  {m.note && <span className="block text-ink-faint">{m.note}</span>}
                </span>
                <span className="text-[13px] tabular-nums">
                  {toNumber(m.feeMnt) === 0 ? 'Үнэгүй' : formatMnt(m.feeMnt)}
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section n={3} title="Төлбөр">
          <p className="text-[13px] text-ink-soft">
            QPay QR эсвэл дансаар шилжүүлж төлнө. Захиалга баталгаажсаны дараа QR код,
            дансны мэдээлэл болон гүйлгээний утга харагдана.
          </p>
          {bank?.bankName && !String(bank.bankName).includes('REPLACE_ME') && (
            <p className="mt-2 text-[13px] font-semibold">{bank.bankName}</p>
          )}
          <div className="mt-5">
            <Field label="Захиалгын тэмдэглэл (заавал биш)" value={note} onChange={setNote} />
          </div>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line bg-shade p-6">
          <p className="text-[13px] font-bold uppercase tracking-[0.6px]">Захиалгын хураангуй</p>

          <ul className="mt-5 space-y-4">
            {items.map((i) => {
              const product = i.variant?.product
              const title = copy(product).title
              const image = i.variant?.image ?? firstNode(product?.productImageCollection)
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
                    {i.variant?.optionValue && (
                      <span className="block text-[12px] text-ink-faint">{i.variant.optionValue}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums">
                    {formatMnt(toNumber(i.variant?.priceMnt) * i.quantity)}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 flex gap-2 border-t border-line pt-5">
            <input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Хөнгөлөлтийн код"
              className="min-w-0 flex-1 border border-line bg-paper px-3 py-2.5 text-[13px] outline-none focus:border-ink"
            />
            <span className="grid place-items-center border border-line bg-paper px-3 text-[12px] text-ink-faint">
              Захиалахад тооцно
            </span>
          </div>

          <dl className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
            <Row label="Барааны дүн" value={formatMnt(subtotal)} />
            <Row label="Хүргэлт" value={deliveryFee === 0 ? 'Үнэгүй' : formatMnt(deliveryFee)} />
            <div className="flex justify-between border-t border-line pt-3 text-[15px] font-bold">
              <dt>Нийт</dt>
              <dd className="tabular-nums">{formatMnt(estimate)}</dd>
            </div>
          </dl>

          {error && <p className="mt-4 text-[13px] text-sale">{error}</p>}

          <button onClick={onPlace} disabled={placing || !addressId || !methodId}
            className="btn-solid mt-5 w-full py-4">
            {placing ? 'Илгээж байна…' : 'Захиалга баталгаажуулах'}
          </button>
          <p className="mt-3 text-[12px] text-ink-faint">
            Хөнгөлөлт сервер дээр тооцогдож эцсийн дүн гарна.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Section({ n, title, children }) {
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

function Field({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-soft">{label}{required && ' *'}</span>
      <input
        value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border border-line bg-paper px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-ink"
      />
    </label>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
