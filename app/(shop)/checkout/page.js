'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { CHECKOUT_CONTEXT, CREATE_ADDRESS, MY_CART, PLACE_ORDER } from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes, toNumber } from '@/lib/format'
import { useCart } from '@/components/useCart'
import ProductImage from '@/components/ProductImage'
import { useSession } from '@/components/useSession'
import { useAuthUpgrade } from '@/components/useAuthUpgrade'
import PhoneVerify from '@/components/PhoneVerify'

const EMPTY_ADDRESS = {
  recipientName: '', phone: '', cityAimag: 'Улаанбаатар', districtSum: '',
  khorooBag: '', building: '', entrance: '', apartment: '', landmarkNote: '',
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, subtotal, loading: cartLoading } = useCart()
  const { isAuthenticated, ready, user } = useSession()

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-8">
      {/* Progress rail, the shape a shopper expects from a checkout: they can
          see how many steps remain before they commit. */}
      <nav className="mb-8 flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
        <Link href="/shop" className="hover:text-ink">Сагс</Link>
        <span>›</span>
        <span className={isAuthenticated ? '' : 'font-semibold text-ink'}>Баталгаажуулалт</span>
        <span>›</span>
        <span className={isAuthenticated ? 'font-semibold text-ink' : ''}>Хүргэлт, төлбөр</span>
      </nav>

      {cartLoading || !ready ? (
        <p className="label mt-10 text-ink-faint">Ачааллаж байна…</p>
      ) : items.length === 0 ? (
        <div className="mt-10 border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">Сагс хоосон байна.</p>
          <Link href="/shop" className="label link-underline mt-4 inline-block">Дэлгүүр рүү</Link>
        </div>
      ) : !isAuthenticated ? (
        <AuthGate onDone={() => router.refresh()} />
      ) : (
        <CheckoutForm items={items} subtotal={subtotal} profileId={user?.id} />
      )}
    </div>
  )
}

/**
 * The auth wall. It sits here, as late as possible, because requiring an
 * account is the single biggest drop-off point in the flow — and the cart is
 * preserved straight through it by the anonymous-to-permanent upgrade.
 */
function AuthGate({ onDone }) {
  const { upgrade, busy, error } = useAuthUpgrade()
  const [method, setMethod] = useState('phone')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="mt-10 max-w-md">
      <p className="label text-ink-faint">Алхам 1 / 2</p>
      <h2 className="display mt-2 text-2xl">Баталгаажуулалт</h2>
      <p className="mt-2 text-ink-soft">
        Захиалгаа хянах боломжтой болгохын тулд утсаа баталгаажуулна уу.
        Сагсанд байгаа бараа хадгалагдана.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setMethod('phone')}
          className={`label border px-4 py-2.5 ${method === 'phone' ? 'border-ink bg-ink text-paper' : 'border-line'}`}
        >
          Утсаар
        </button>
        <button
          onClick={() => setMethod('email')}
          className={`label border px-4 py-2.5 ${method === 'email' ? 'border-ink bg-ink text-paper' : 'border-line'}`}
        >
          Имэйлээр
        </button>
      </div>

      <div className="mt-6">
        {method === 'phone' ? (
          // verify.mn is Mongolia-only, so email stays available as the path
          // that always works — including for anyone abroad.
          <PhoneVerify onVerified={onDone} />
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await upgrade({ email, password })
              if (res.ok) onDone()
            }}
          >
            <div>
              <label className="label text-ink-faint" htmlFor="co-email">Имэйл</label>
              <input id="co-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink" />
            </div>
            <div>
              <label className="label text-ink-faint" htmlFor="co-pass">Нууц үг</label>
              <input id="co-pass" type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
                className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink" />
            </div>
            {error && <p className="text-sale">{error}</p>}
            <button type="submit" disabled={busy} className="btn-solid w-full py-3.5">
              {busy ? 'Түр хүлээнэ үү…' : 'Үргэлжлүүлэх'}
            </button>
          </form>
        )}
      </div>
    </div>
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

  const [addressId, setAddressId] = useState(null)
  const [methodId, setMethodId] = useState(null)
  const [discountCode, setDiscountCode] = useState('')
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(EMPTY_ADDRESS)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!addressId && addresses.length) {
      setAddressId(addresses.find((a) => a.isDefault)?.id ?? addresses[0].id)
    }
    if (!methodId && methods.length) setMethodId(methods[0].id)
  }, [addresses, methods, addressId, methodId])

  const method = methods.find((m) => m.id === methodId)
  const deliveryFee = toNumber(method?.feeMnt)

  // Display estimate only. The authoritative total is computed inside
  // place_order from the catalog — the client never sends an amount.
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
    } catch (e) {
      setError(e?.message ?? 'Хаяг хадгалахад алдаа гарлаа.')
    }
  }

  const onPlace = async () => {
    setError(null)
    if (!addressId || !methodId) { setError('Хаяг болон хүргэлтийн хэлбэрээ сонгоно уу.'); return }
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
        // place_order marks the cart 'converted'; without this the header keeps
        // showing the old item count from cache.
        await apollo.refetchQueries({ include: [MY_CART] })
        router.push(`/orders/${order.orderNumber}`)
      }
    } catch (e) {
      setError(e?.message ?? 'Захиалга үүсгэхэд алдаа гарлаа.')
    }
  }

  if (loading) return <p className="label mt-10 text-ink-faint">Ачааллаж байна…</p>

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="border border-line p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-bold">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-paper">1</span>
            Хүргэлтийн хаяг
          </h2>
          {addresses.length > 0 && (
            <div className="mt-4 space-y-3">
              {addresses.map((a) => (
                <label key={a.id}
                  className={`flex cursor-pointer gap-3 border p-4 transition-colors ${
                    a.id === addressId ? 'border-ink' : 'border-line hover:border-ink-faint'}`}>
                  <input type="radio" name="address" checked={a.id === addressId}
                    onChange={() => setAddressId(a.id)} className="mt-1" />
                  <span>
                    <span className="block font-medium">{a.recipientName} · {a.phone}</span>
                    <span className="block text-ink-soft">
                      {[a.cityAimag, a.districtSum, a.khorooBag, a.building, a.entrance && `${a.entrance} орц`, a.apartment && `${a.apartment} тоот`]
                        .filter(Boolean).join(', ')}
                    </span>
                    {a.landmarkNote && <span className="label block text-ink-faint">{a.landmarkNote}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          <details className="mt-4" open={addresses.length === 0}>
            <summary className="label cursor-pointer text-ink-soft">Шинэ хаяг нэмэх</summary>
            <form onSubmit={onSaveAddress} className="mt-5 grid gap-4 sm:grid-cols-2">
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
                <Field label="Нэмэлт заавар (хаалга, орчны тэмдэг)" value={draft.landmarkNote}
                  onChange={(v) => setDraft({ ...draft, landmarkNote: v })} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={savingAddress}
                  className="label border border-ink px-5 py-2.5 transition-colors hover:bg-ink hover:text-paper disabled:opacity-40">
                  {savingAddress ? 'Хадгалж байна…' : 'Хаяг хадгалах'}
                </button>
              </div>
            </form>
          </details>
        </section>

        <section className="border border-line p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-bold">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-paper">2</span>
            Хүргэлтийн хэлбэр
          </h2>
          <div className="mt-4 space-y-3">
            {methods.map((m) => (
              <label key={m.id}
                className={`flex cursor-pointer items-center gap-3 border p-4 transition-colors ${
                  m.id === methodId ? 'border-ink' : 'border-line hover:border-ink-faint'}`}>
                <input type="radio" name="method" checked={m.id === methodId}
                  onChange={() => setMethodId(m.id)} />
                <span className="flex-1">
                  <span className="block font-medium">{m.name}</span>
                  {m.note && <span className="label block text-ink-faint">{m.note}</span>}
                </span>
                <span className="tabular-nums">{toNumber(m.feeMnt) === 0 ? 'Үнэгүй' : formatMnt(m.feeMnt)}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="border border-line p-6">
          <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-bold">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[12px] text-paper">3</span>
            Нэмэлт
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Хөнгөлөлтийн код" value={discountCode} onChange={setDiscountCode} />
            <Field label="Захиалгын тэмдэглэл" value={note} onChange={setNote} />
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-line bg-shade p-6">
          <p className="label text-ink-faint">Захиалгын хураангуй</p>
          <ul className="mt-4 space-y-4">
            {items.map((i) => {
              const product = i.variant?.product
              const title = copy(product).title
              const image = firstNode(product?.productImageCollection)
              return (
                <li key={i.id} className="flex items-center gap-3">
                  {/* Thumbnail with the quantity as a badge: a checkout summary
                      is scanned, not read, and the picture is the anchor. */}
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
          <dl className="mt-5 space-y-2 border-t border-line pt-4">
            <Row label="Дүн" value={formatMnt(subtotal)} />
            <Row label="Хүргэлт" value={deliveryFee === 0 ? 'Үнэгүй' : formatMnt(deliveryFee)} />
            <div className="flex justify-between border-t border-line pt-3 text-[15px]">
              <dt>Нийт</dt>
              <dd className="tabular-nums">{formatMnt(estimate)}</dd>
            </div>
          </dl>
          <p className="label mt-2 text-ink-faint">
            Хөнгөлөлт сервер дээр тооцогдож эцсийн дүн гарна.
          </p>

          {error && <p className="mt-4 text-sale">{error}</p>}

          <button onClick={onPlace} disabled={placing || !addressId || !methodId}
            className="label mt-5 w-full bg-ink py-4 text-paper transition-opacity hover:opacity-85 disabled:opacity-30">
            {placing ? 'Илгээж байна…' : 'Захиалга баталгаажуулах'}
          </button>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] font-semibold">Төлбөрийн хэлбэр</p>
            <p className="mt-1 text-[13px] text-ink-soft">
              Дансаар шилжүүлэн төлнө. Захиалга баталгаажсаны дараа дансны мэдээлэл
              болон гүйлгээний утга харагдана.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Field({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="label text-ink-faint">{label}{required && ' *'}</span>
      <input
        value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
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
