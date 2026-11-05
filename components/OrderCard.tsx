'use client'

import Link from 'next/link'
import { formatDate, formatMnt, nodes, orderStatusLabel, toNumber } from '@/lib/format'
import { useLang, useT } from '@/lib/i18n'
import type { Order, OrderStatus } from '@/lib/types'
import ProductImage from './ProductImage'
import { IconChevronRight } from './Icons'

export const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: 'border-warn-line text-warn-ink bg-warn-soft',
  deposit_paid: 'border-info-line text-info-ink bg-info-soft',
  awaiting_balance: 'border-warn-line text-warn-ink bg-warn-soft',
  paid: 'border-success-line text-success-ink bg-success-soft',
  packed: 'border-info-line text-info-ink bg-info-soft',
  shipped: 'border-info-line text-info-ink bg-info-soft',
  delivered: 'border-success-line text-success-ink bg-success-soft',
  cancelled: 'border-line text-ink-soft bg-shade',
  refunded: 'border-note-line text-note-ink bg-note-soft',
  oversold: 'border-danger-line text-danger-ink bg-danger-soft',
}

const NEXT_STEP: Partial<Record<OrderStatus, readonly [string, string]>> = {
  deposit_paid: ['Бараа ирмэгц бид танд мэдэгдэнэ.', 'We’ll let you know as soon as it arrives.'],
  paid: ['Бид захиалгыг тань бэлтгэж байна.', 'We’re getting your order ready.'],
  packed: ['Удахгүй хүргэлтэд гарна.', 'It will be on its way soon.'],
  shipped: ['Жолооч тантай холбогдоно.', 'The driver will call you.'],
}

export default function OrderCard({ order }: { order: Order }) {
  const t = useT()
  const lang = useLang()
  const items = nodes(order.orderItemCollection)
  const itemCount = items.length
  const units = items.reduce((sum, i) => sum + (i.quantity ?? 0), 0)
  const first = items[0]
  const more = itemCount - 1
  const status = order.status ?? undefined
  const next = status ? NEXT_STEP[status] : undefined
  const due =
    status === 'awaiting_balance'
      ? { label: t('Үлдэгдэл төлөх', 'Pay the balance'), amount: order.balanceMnt }
      : status === 'awaiting_payment'
        ? { label: t('Төлбөр төлөх', 'Pay now'), amount: toNumber(order.upfrontMnt) ? order.upfrontMnt : order.totalMnt }
        : null

  return (
    <Link
      href={`/orders/${order.orderNumber}`}
      className="group block rounded-2xl border border-line p-4 transition-colors hover:border-ink-faint sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold ${(status && STATUS_TONE[status]) || 'border-line text-ink-soft'}`}>
          {orderStatusLabel(status, lang)}
        </span>
        <span className="text-[15px] font-semibold tabular-nums text-ink-strong">{formatMnt(order.totalMnt)}</span>
      </div>

      <div className="mt-3.5 flex items-center gap-3.5">
        <span className="flex shrink-0 -space-x-4">
          {items.slice(0, 3).map((i, n) => (
            <span
              key={i.id}
              style={{ zIndex: 3 - n }}
              className="relative aspect-[4/5] w-12 overflow-hidden rounded-lg border-2 border-paper bg-shade"
            >
              <ProductImage filePath={i.imagePath} alt="" seed={i.id} sizes="48px" />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[14px] font-medium leading-snug text-ink-strong">
            {first?.productTitle ?? t('Бараа', 'Item')}
            {more > 0 && <span className="font-normal text-ink-soft"> {t(`ба өөр ${more} бараа`, `and ${more} more`)}</span>}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-faint">
            {units > 0 ? t(`${units} ширхэг`, `${units} ${units === 1 ? 'item' : 'items'}`) : first?.variantLabel}
          </span>
        </span>
      </div>

      {next && <p className="mt-3 text-[13px] text-ink-soft">{t(next[0], next[1])}</p>}

      {due && (
        <span className="mt-3.5 flex items-center justify-between gap-3 rounded-full bg-primary-strong px-4 py-2.5 text-[13px] font-semibold text-on-primary">
          <span>{due.label}</span>
          <span className="tabular-nums">{formatMnt(due.amount)}</span>
        </span>
      )}

      <div className="mt-3.5 flex items-center justify-between border-t border-line pt-3 text-[12px] text-ink-faint">
        <span className="tabular-nums">
          {t('Захиалга', 'Order')} {order.orderNumber} · {formatDate(order.placedAt)}
        </span>
        <span className="flex items-center gap-0.5 font-medium text-ink-soft group-hover:text-ink">
          {t('Дэлгэрэнгүй', 'Details')}
          <IconChevronRight width="14" height="14" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
