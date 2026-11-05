'use client'

import { formatDate } from '@/lib/format'
import { IconCheck } from '@/components/Icons'
import { useT } from '@/lib/i18n'
import type { Order, OrderStatus } from '@/lib/types'
import { hasBalance } from './payStage'

const STOPS = [
  { key: 'placed', label: 'Захиалсан', en: 'Ordered' },
  { key: 'paid', label: 'Төлсөн', en: 'Paid' },
  { key: 'packed', label: 'Бэлтгэсэн', en: 'Packed' },
  { key: 'shipped', label: 'Замдаа', en: 'On the way' },
  { key: 'delivered', label: 'Хүргэсэн', en: 'Delivered' },
] as const

const PREORDER_STOPS = [
  { key: 'placed', label: 'Захиалсан', en: 'Ordered' },
  { key: 'paid', label: 'Урьдчилгаа', en: 'Deposit' },
  { key: 'balance', label: 'Үлдэгдэл', en: 'Balance' },
  { key: 'packed', label: 'Бэлтгэсэн', en: 'Packed' },
  { key: 'shipped', label: 'Замдаа', en: 'On the way' },
  { key: 'delivered', label: 'Хүргэсэн', en: 'Delivered' },
] as const

type StopKey = (typeof PREORDER_STOPS)[number]['key']

const STOP_INDEX: Partial<Record<OrderStatus, number>> = {
  awaiting_payment: 0,
  paid: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
}

const PREORDER_STOP_INDEX: Partial<Record<OrderStatus, number>> = {
  awaiting_payment: 0,
  deposit_paid: 1,
  awaiting_balance: 1,
  paid: 2,
  packed: 3,
  shipped: 4,
  delivered: 5,
}

const WAITING_ON_SHOPPER: ReadonlySet<OrderStatus> = new Set(['awaiting_payment', 'awaiting_balance'])

export function trailApplies(status: string | null | undefined): boolean {
  return typeof status === 'string' && status in PREORDER_STOP_INDEX
}

export default function OrderTrail({ order }: { order: Order }) {
  const t = useT()
  const preorder = hasBalance(order)
  const stops = preorder ? PREORDER_STOPS : STOPS
  const index = preorder ? PREORDER_STOP_INDEX : STOP_INDEX
  const current = (order.status && index[order.status]) ?? 0
  const dates: Partial<Record<StopKey, string | null | undefined>> = {
    placed: order.placedAt,
    paid: order.paidAt,
    balance: order.balancePaidAt,
    shipped: order.shippedAt,
  }
  const edge = 50 / stops.length
  const fill = (current / (stops.length - 1)) * (100 - 2 * edge)
  const waiting = Boolean(order.status && WAITING_ON_SHOPPER.has(order.status))

  return (
    <ol
      className="relative mt-2 grid"
      style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className="absolute top-[11px] h-[2px] rounded-full bg-line"
        style={{ left: `${edge}%`, right: `${edge}%` }}
      />
      <div
        aria-hidden
        className="absolute top-[11px] h-[2px] rounded-full bg-ink transition-[width] duration-700 ease-out"
        style={{ left: `${edge}%`, width: `${fill}%` }}
      />

      {stops.map((stop, i) => {
        const done = i < current
        const here = i === current
        const at = dates[stop.key]
        return (
          <li key={stop.key} className="relative flex flex-col items-center gap-2 text-center">
            <span className="relative grid h-6 w-6 place-items-center">
              {here && waiting && (
                <span aria-hidden className="o-ping absolute h-6 w-6 rounded-full border-2 border-ink" />
              )}
              <span
                className={`relative grid h-6 w-6 place-items-center rounded-full border-2 transition-colors ${
                  done || here
                    ? 'border-ink bg-ink text-paper'
                    : 'border-line bg-paper text-transparent'
                }`}
              >
                {done ? <IconCheck width="13" height="13" /> : here ? <span className="h-1.5 w-1.5 rounded-full bg-paper" /> : null}
              </span>
            </span>
            <span className={`text-[11px] leading-tight sm:text-[12px] ${done || here ? 'font-semibold' : 'text-ink-faint'}`}>
              {t(stop.label, stop.en)}
            </span>
            {at && <span className="text-[10px] leading-tight text-ink-faint sm:text-[11px]">{formatDate(at)}</span>}
          </li>
        )
      })}
    </ol>
  )
}
