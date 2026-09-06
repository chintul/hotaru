'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ORDER_DETAIL, SUBMIT_PAYMENT_PROOF } from '@/lib/queries'
import { ORDER_STATUS_LABEL, formatAddress, formatDate, formatMnt, nodes, parseJson } from '@/lib/format'
import { useSession } from '@/components/useSession'

export default function OrderPage({ params }) {
  // Next 16: params is a Promise in client components too — unwrap with use().
  const { orderNumber } = use(params)
  const { isAuthenticated, ready, user } = useSession()
  const { data, loading, refetch } = useQuery(ORDER_DETAIL, {
    variables: { orderNumber, profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  })
  const [submitProof, { loading: submitting }] = useMutation(SUBMIT_PAYMENT_PROOF)
  const [reference, setReference] = useState('')
  const [done, setDone] = useState(false)
  const [qpay, setQpay] = useState(null)
  const [qpayError, setQpayError] = useState(false)

  const order = nodes(data?.orderCollection)[0]
  const bank = nodes(data?.storeSettingsCollection)[0]
  const items = nodes(order?.orderItemCollection)
  // jsonb arrives as a JSON string from pg_graphql — parse before reading.
  const address = parseJson(order?.shippingAddress)

  // Mint the invoice once, when the order is known to be awaiting payment and
  // the owner has QPay switched on.
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || !bank?.qpayEnabled || qpay || qpayError) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/payments/qpay/invoice', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!cancelled) setQpay(data)
      } catch {
        // QPay being down must not hide the bank details underneath.
        if (!cancelled) setQpayError(true)
      }
    })()
    return () => { cancelled = true }
  }, [order, bank, qpay, qpayError])

  // The callback confirms server-side; this only keeps an open page honest.
  // It polls our own database, never QPay — their docs forbid polling them.
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || !qpay) return
    const id = setInterval(() => { refetch() }, 5000)
    return () => clearInterval(id)
  }, [order, qpay, refetch])

  if (!ready || loading) {
    return <p className="label mx-auto max-w-[900px] px-5 py-20 text-ink-faint">Ачааллаж байна…</p>
  }
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-20 text-center">
        <p className="text-ink-soft">Захиалга харахын тулд нэвтэрнэ үү.</p>
        <Link href={`/login?next=/orders/${orderNumber}`} className="label link-underline mt-4 inline-block">
          Нэвтрэх
        </Link>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-20 text-center">
        <p className="text-ink-soft">Захиалга олдсонгүй.</p>
        <Link href="/orders" className="label link-underline mt-4 inline-block">Бүх захиалга</Link>
      </div>
    )
  }

  const awaiting = order.status === 'awaiting_payment'

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-8">
      <Link href="/orders" className="label link-underline text-ink-faint">← Бүх захиалга</Link>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h1 className="display text-[clamp(1.6rem,4vw,2.5rem)] tabular-nums">{order.orderNumber}</h1>
        <span className="label border border-line px-2.5 py-1 text-ink-soft">
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </span>
        <span className="label text-ink-faint">{formatDate(order.placedAt)}</span>
      </div>

      {/* The bank-transfer instruction screen. With manual payment this is the
          most important page on the site — it is where the customer learns how
          to actually pay. */}
      {awaiting && bank && (
        <section className="mt-10 border border-ink p-6">
          <p className="label">Төлбөрөө шилжүүлнэ үү</p>

          {qpay?.qrImage && (
            <div className="mb-6 mt-5 border-b border-line pb-6">
              <p className="text-[13px] text-ink-soft">
                Банкны аппаараа QR-г уншуулж төлнө үү. Төлбөр орсон даруйд захиалга
                автоматаар баталгаажна.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a base64 QR from QPay, not an ImageKit asset */}
              <img
                src={qpay.qrImage.startsWith('data:') ? qpay.qrImage : `data:image/png;base64,${qpay.qrImage}`}
                alt="QPay QR"
                className="mt-4 h-[220px] w-[220px] border border-line bg-paper p-2"
              />
              {qpay.urls?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {qpay.urls.map((u) => (
                    <a key={u.link} href={u.link}
                      className="label border border-line px-3 py-2 transition-colors hover:border-ink">
                      {u.name}
                    </a>
                  ))}
                </div>
              )}
              <p className="label mt-4 text-ink-faint">Эсвэл доорх дансаар шилжүүлнэ үү.</p>
            </div>
          )}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Банк" value={bank.bankName} />
            <Detail label="Данс" value={bank.bankAccountNumber} mono />
            <Detail label="Хүлээн авагч" value={bank.bankAccountName} />
            <Detail label="Дүн" value={formatMnt(order.totalMnt)} mono />
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-ink-soft">
            {bank.paymentInstructions}
          </p>
          <p className="label mt-2 text-ink-faint">
            Гүйлгээний утга: <span className="text-ink">{order.orderNumber}</span>
            {bank.paymentDeadlineHours ? ` · ${bank.paymentDeadlineHours} цагийн дотор` : ''}
          </p>

          {done || order.paymentStatus === 'submitted' ? (
            <p className="mt-6 border-t border-line pt-4 text-ink-soft">
              Мэдэгдэл хүлээн авлаа. Төлбөр баталгаажмагц танд мэдэгдэнэ.
            </p>
          ) : (
            <form
              className="mt-6 border-t border-line pt-4"
              onSubmit={async (e) => {
                e.preventDefault()
                await submitProof({
                  variables: { orderId: order.id, externalReference: reference.trim() || null },
                })
                setDone(true)
                refetch()
              }}
            >
              <label className="label text-ink-faint" htmlFor="ref">Гүйлгээний дугаар (заавал биш)</label>
              <input
                id="ref" value={reference} onChange={(e) => setReference(e.target.value)}
                className="mt-2 w-full border-b border-line bg-transparent py-2 outline-none focus:border-ink"
              />
              <button type="submit" disabled={submitting}
                className="label mt-4 border border-ink px-5 py-2.5 transition-colors hover:bg-ink hover:text-paper disabled:opacity-40">
                {submitting ? 'Илгээж байна…' : 'Төлбөр шилжүүлсэн'}
              </button>
            </form>
          )}
        </section>
      )}

      {order.status === 'oversold' && (
        <section className="mt-10 border border-sale p-6">
          <p className="label text-sale">Нөөц хүрэлцээгүй</p>
          <p className="mt-3 text-ink-soft">
            Уучлаарай, таны төлбөр баталгаажсан ч бараа дууссан байна. Бид тантай холбогдож
            төлбөрийг буцаана.
          </p>
        </section>
      )}

      <section className="mt-10">
        <p className="label text-ink-faint">Бараа</p>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
              <span className="font-medium">{i.productTitle}</span>
              {i.variantLabel && <span className="label text-ink-faint">{i.variantLabel}</span>}
              <span className="label text-ink-faint">{i.quantity} ш</span>
              <span className="ml-auto tabular-nums">{formatMnt(i.lineTotalMnt)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2">
          <Row label="Дүн" value={formatMnt(order.subtotalMnt)} />
          {Number(order.discountMnt) > 0 && <Row label="Хөнгөлөлт" value={`−${formatMnt(order.discountMnt)}`} />}
          <Row label="Хүргэлт" value={formatMnt(order.deliveryMnt)} />
          <div className="flex justify-between border-t border-line pt-3 text-[15px]">
            <dt>Нийт</dt><dd className="tabular-nums">{formatMnt(order.totalMnt)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <p className="label text-ink-faint">Хүргэлтийн хаяг</p>
          <p className="mt-3 text-ink-soft">
            {address.recipient_name} · {address.phone}<br />
            {formatAddress(address)}
            {address.landmark_note ? <><br />{address.landmark_note}</> : null}
          </p>
        </div>
        <div>
          <p className="label text-ink-faint">Хүргэлт</p>
          <p className="mt-3 text-ink-soft">{order.deliveryMethod?.name}</p>
          {order.trackingNumber && <p className="label mt-1 text-ink-faint">Дугаар: {order.trackingNumber}</p>}
        </div>
      </section>
    </div>
  )
}

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="label text-ink-faint">{label}</dt>
      <dd className={`mt-1 ${mono ? 'tabular-nums text-[15px]' : ''}`}>{value || '—'}</dd>
    </div>
  )
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt><dd className="tabular-nums">{value}</dd>
    </div>
  )
}
