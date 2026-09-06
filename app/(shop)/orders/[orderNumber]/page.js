'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ORDER_DETAIL, SUBMIT_PAYMENT_PROOF } from '@/lib/queries'
import { ORDER_STATUS_LABEL, formatAddress, formatDate, formatMnt, nodes, parseJson, toNumber } from '@/lib/format'
import { useSession } from '@/components/useSession'
import ProductImage from '@/components/ProductImage'
import { IconBank, IconChevronLeft, IconClock, IconQr, IconTruck } from '@/components/Icons'
import OrderSkeleton from '../_components/OrderSkeleton'
import OrderTrail, { trailApplies } from '../_components/OrderTrail'
import PaymentModal from '../_components/PaymentModal'
import useCountdown, { paymentDeadline } from '../_components/useCountdown'

// Which tint an order state gets. One map, so the chip, the trail and any
// banner can never disagree about whether a state is good news.
const STATUS_TONE = {
  awaiting_payment: 'wait',
  paid: 'good',
  packed: 'move',
  shipped: 'move',
  delivered: 'good',
  cancelled: 'stop',
  refunded: 'stop',
  oversold: 'stop',
}

// A line of reassurance under the order number. The status chip says *what*;
// this says what it means for the customer.
const STATUS_NOTE = {
  awaiting_payment: ['Төлбөрөө хүлээж байна', '🕰️'],
  paid: ['Төлбөр баталгаажлаа, баярлалаа', '🎀'],
  packed: ['Захиалга тань савлагдлаа', '📦'],
  shipped: ['Хүргэлтэд гарсан', '🚚'],
  delivered: ['Хүргэгдсэн, сайхан хэрэглээрэй', '💛'],
  cancelled: ['Захиалга цуцлагдсан', '🥀'],
  refunded: ['Төлбөр буцаагдсан', '↩️'],
  oversold: ['Нөөц хүрэлцээгүй', '⚠️'],
}

export default function OrderPage({ params }) {
  // Next 16: params is a Promise in client components too — unwrap with use().
  const { orderNumber } = use(params)
  const { isAuthenticated, ready, user } = useSession()
  const { data, loading, refetch } = useQuery(ORDER_DETAIL, {
    variables: { orderNumber, profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  })
  const [submitProof, { loading: submitting }] = useMutation(SUBMIT_PAYMENT_PROOF)
  const [done, setDone] = useState(false)

  // The QPay invoice lives here, not in the modal, so closing and reopening the
  // sheet reuses the one already minted. Two invoices against one payment row
  // would leave the second one dangling and unmatchable.
  const [qpay, setQpay] = useState(null)
  const [qpayState, setQpayState] = useState('idle') // idle | loading | ready | error
  const [method, setMethod] = useState(null)         // null = sheet closed

  const order = nodes(data?.orderCollection)[0]
  const bank = nodes(data?.storeSettingsCollection)[0]
  const items = nodes(order?.orderItemCollection)
  // jsonb arrives as a JSON string from pg_graphql — parse before reading.
  const address = parseJson(order?.shippingAddress)

  const awaiting = order?.status === 'awaiting_payment'
  const submitted = done || order?.paymentStatus === 'submitted'
  const deadline = useCountdown(awaiting ? paymentDeadline(order, bank?.paymentDeadlineHours) : null)

  // Plain function, not useCallback: the React Compiler memoizes it, and the
  // one consumer guards on qpayState so a fresh identity cannot mint twice.
  const orderId = order?.id
  const mintQpay = async () => {
    if (!orderId) return
    setQpayState('loading')
    try {
      const res = await fetch('/api/payments/qpay/invoice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setQpay(await res.json())
      setQpayState('ready')
    } catch {
      // QPay being down must not hide the bank details underneath: the sheet
      // falls back to a retry plus a link straight to the transfer panel.
      setQpayState('error')
    }
  }

  // The callback confirms server-side; this only keeps an open page honest.
  // It polls our own database, never QPay — their docs forbid polling them —
  // and only while someone is actually looking at a payment instruction.
  const watching = awaiting && (method !== null || qpayState === 'ready')
  useEffect(() => {
    if (!watching) return
    const id = setInterval(() => { refetch() }, 5000)
    return () => clearInterval(id)
  }, [watching, refetch])

  if (!ready || loading) return <OrderSkeleton />

  if (!isAuthenticated) {
    return (
      <Empty
        emoji="🔑"
        title="Нэвтэрч орно уу"
        body="Захиалгаа харахын тулд нэвтэрнэ үү."
        href={`/login?next=/orders/${orderNumber}`}
        cta="Нэвтрэх"
      />
    )
  }
  if (!order) {
    return (
      <Empty
        emoji="🔍"
        title="Захиалга олдсонгүй"
        body="Энэ дугаартай захиалга таны бүртгэлд алга байна."
        href="/orders"
        cta="Бүх захиалга"
      />
    )
  }

  const [note, noteEmoji] = STATUS_NOTE[order.status] ?? ['', '']
  const count = items.reduce((n, i) => n + i.quantity, 0)

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink"
      >
        <IconChevronLeft width="16" height="16" /> Бүх захиалга
      </Link>

      <header className="o-card o-card-warm fade-up mt-4 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="o-chip" data-tone={STATUS_TONE[order.status]}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
          <span className="text-[12px] text-ink-faint">{formatDate(order.placedAt)}</span>
        </div>
        <h1 className="display mt-3 text-[clamp(1.7rem,5vw,2.4rem)] tabular-nums">{order.orderNumber}</h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          {note} <span aria-hidden>{noteEmoji}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-4 text-[13px] text-ink-soft">
          <span>{count} ширхэг бараа</span>
          <span className="font-semibold text-ink tabular-nums">{formatMnt(order.totalMnt)}</span>
        </div>
      </header>

      {trailApplies(order.status) && (
        <section className="o-card mt-4 px-3 py-6 sm:px-6">
          <OrderTrail order={order} />
        </section>
      )}

      {order.status === 'oversold' && (
        <Banner tone="stop" title="Нөөц хүрэлцээгүй">
          Уучлаарай, таны төлбөр баталгаажсан ч бараа дууссан байна. Бид тантай холбогдож
          төлбөрийг буцаана.
        </Banner>
      )}
      {order.status === 'cancelled' && (
        <Banner tone="stop" title="Захиалга цуцлагдсан">
          Асуух зүйл байвал бидэнтэй холбогдоорой.
        </Banner>
      )}
      {order.status === 'refunded' && (
        <Banner tone="stop" title="Төлбөр буцаагдсан">
          Мөнгө таны данс руу 1–3 ажлын өдөрт орно.
        </Banner>
      )}

      {/* The pay-me screen. With manual payment this is the most important
          section on the site — it is where the customer learns how to actually
          pay — so it sits above the receipt and owns the accent colour. */}
      {awaiting && bank && (
        <section className="o-card fade-up mt-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">Төлөх дүн</p>
              <p className="display mt-1 text-[clamp(1.5rem,4vw,2rem)] tabular-nums">{formatMnt(order.totalMnt)}</p>
            </div>
            {deadline && (
              <span className="o-chip" data-tone={deadline.expired ? 'stop' : 'wait'}>
                <IconClock />
                {deadline.expired ? 'Хугацаа дууссан' : `${deadline.text} үлдсэн`}
              </span>
            )}
          </div>

          {submitted && (
            <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-[13px] text-mint-ink">
              Мэдэгдэл хүлээн авлаа. Төлбөр баталгаажмагц танд имэйл илгээнэ.
            </p>
          )}

          <div className={`mt-5 grid gap-3 ${bank.qpayEnabled ? 'sm:grid-cols-2' : ''}`}>
            {bank.qpayEnabled && (
              <PayPick
                icon={<IconQr />}
                tint="bg-sky text-sky-ink"
                title="QPay QR"
                sub="Банкны аппаараа уншуулах"
                onClick={() => setMethod('qpay')}
              />
            )}
            <PayPick
              icon={<IconBank />}
              tint="bg-cream text-cream-ink"
              title="Дансаар шилжүүлэх"
              sub={bank.bankName || 'Дансны мэдээлэл харах'}
              onClick={() => setMethod('bank')}
            />
          </div>

          <p className="mt-4 text-[12px] text-ink-faint">
            Гүйлгээний утга: <span className="font-semibold text-ink">{order.orderNumber}</span>
            {bank.paymentDeadlineHours ? ` · ${bank.paymentDeadlineHours} цагийн дотор` : ''}
          </p>
        </section>
      )}

      <section className="o-card mt-4 overflow-hidden">
        <p className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint sm:px-6">
          Бараа
        </p>
        <ul className="mt-3 divide-y divide-line-soft px-5 sm:px-6">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 py-4">
              {/* The clip lives on the inner span, not this one: rounding the
                  thumbnail here would also cut the quantity badge in half. */}
              <span className="relative h-16 w-16 shrink-0">
                <span className="block h-full w-full overflow-hidden rounded-2xl bg-paper-warm">
                  <ProductImage
                    filePath={i.imagePath}
                    alt={i.productTitle}
                    seed={i.sku || i.productTitle}
                    sizes="64px"
                  />
                </span>
                {i.quantity > 1 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-semibold text-paper">
                    {i.quantity}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[14px] font-medium">{i.productTitle}</span>
                {i.variantLabel && (
                  <span className="mt-1 inline-block rounded-full bg-shade px-2.5 py-0.5 text-[11px] text-ink-soft">
                    {i.variantLabel}
                  </span>
                )}
                <span className="mt-1 block text-[12px] text-ink-faint tabular-nums">
                  {formatMnt(i.unitPriceMnt)} × {i.quantity}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-medium tabular-nums">{formatMnt(i.lineTotalMnt)}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-1 space-y-2 bg-paper-warm px-5 py-5 text-[13px] sm:px-6">
          <Row label="Барааны дүн" value={formatMnt(order.subtotalMnt)} />
          {toNumber(order.discountMnt) > 0 && (
            <Row label="Хөнгөлөлт" value={`−${formatMnt(order.discountMnt)}`} accent />
          )}
          <Row
            label="Хүргэлт"
            value={toNumber(order.deliveryMnt) === 0 ? 'Үнэгүй' : formatMnt(order.deliveryMnt)}
          />
          <div className="flex justify-between border-t border-line pt-3 text-[16px] font-semibold">
            <dt>Нийт</dt>
            <dd className="tabular-nums">{formatMnt(order.totalMnt)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="o-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">Хүргэлтийн хаяг</p>
          <p className="mt-3 text-[14px] font-medium">{address.recipient_name}</p>
          <p className="text-[13px] text-ink-soft tabular-nums">{address.phone}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {formatAddress(address)}
            {address.landmark_note ? <><br />{address.landmark_note}</> : null}
          </p>
        </section>

        <section className="o-card p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[.6px] text-ink-faint">Хүргэлт</p>
          <p className="mt-3 flex items-center gap-2 text-[14px] font-medium">
            <IconTruck className="text-ink-soft" />
            {order.deliveryMethod?.name ?? '—'}
          </p>
          {order.trackingNumber ? (
            <p className="mt-2 text-[13px] text-ink-soft">
              Хяналтын дугаар: <span className="font-medium text-ink tabular-nums">{order.trackingNumber}</span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-faint">
              Хүргэлтэд гарахад хяналтын дугаар энд харагдана.
            </p>
          )}
          {order.customerNote && (
            <p className="mt-3 rounded-2xl bg-paper-warm px-3.5 py-2.5 text-[13px] text-ink-soft">
              “{order.customerNote}”
            </p>
          )}
        </section>
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-faint">
        Асуух зүйл байна уу?{' '}
        <Link href="/contact" className="link-underline text-ink-soft">Бидэнтэй холбогдох</Link>
      </p>

      {method && bank && (
        <PaymentModal
          order={order}
          bank={bank}
          method={method}
          onMethod={setMethod}
          qpay={qpay}
          qpayState={qpayState}
          onMintQpay={mintQpay}
          onClose={() => setMethod(null)}
          onSubmitProof={async (externalReference) => {
            await submitProof({ variables: { orderId: order.id, externalReference } })
            setDone(true)
            refetch()
          }}
          submitting={submitting}
          submitted={submitted}
        />
      )}
    </div>
  )
}

function PayPick({ icon, tint, title, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} className="o-pick flex items-center gap-3.5 sm:block">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tint}`}>{icon}</span>
      <span className="min-w-0 sm:mt-3 sm:block">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-faint">{sub}</span>
      </span>
    </button>
  )
}

function Banner({ tone, title, children }) {
  const bg = tone === 'stop' ? 'bg-blush' : 'bg-cream'
  const ink = tone === 'stop' ? 'text-blush-ink' : 'text-cream-ink'
  return (
    <section className={`mt-4 rounded-[20px] ${bg} p-5 sm:p-6`}>
      <p className={`text-[14px] font-semibold ${ink}`}>{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{children}</p>
    </section>
  )
}

function Row({ label, value, accent = false }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-soft">{label}</dt>
      <dd className={`tabular-nums ${accent ? 'text-mint-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  )
}

function Empty({ emoji, title, body, href, cta }) {
  return (
    <div className="mx-auto max-w-[520px] px-5 py-20 text-center">
      <div className="o-card o-card-warm px-6 py-12">
        <span aria-hidden className="text-[34px]">{emoji}</span>
        <p className="mt-3 text-[16px] font-semibold">{title}</p>
        <p className="mt-1.5 text-[13px] text-ink-soft">{body}</p>
        <Link
          href={href}
          className="mt-6 inline-block rounded-full bg-ink-strong px-6 py-3 text-[12px] font-bold uppercase tracking-[.7px] text-paper transition-opacity hover:opacity-85"
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}
