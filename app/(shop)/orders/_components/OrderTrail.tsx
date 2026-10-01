'use client'

import { formatDate } from '@/lib/format'
import { IconCheck } from '@/components/Icons'
import type { Order, OrderStatus } from '@/lib/types'

const STOPS = [
  { key: 'placed', label: 'Захиалсан' },
  { key: 'paid', label: 'Төлсөн' },
  { key: 'packed', label: 'Бэлтгэсэн' },
  { key: 'shipped', label: 'Замдаа' },
  { key: 'delivered', label: 'Хүрсэн' },
] as const

type StopKey = (typeof STOPS)[number]['key']

const STOP_INDEX: Partial<Record<OrderStatus, number>> = {
  awaiting_payment: 0,
  paid: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
}

export function trailApplies(status: string | null | undefined): boolean {
  return typeof status === 'string' && status in STOP_INDEX
}

export default function OrderTrail({ order }: { order: Order }) {
  const current = (order.status && STOP_INDEX[order.status]) ?? 0
  const dates: Partial<Record<StopKey, string | null | undefined>> = {
    placed: order.placedAt,
    paid: order.paidAt,
    shipped: order.shippedAt,
  }
  const fill = (current / (STOPS.length - 1)) * 100

  return (
    <ol className="relative mt-2 grid grid-cols-5">
      <div aria-hidden className="absolute left-[10%] right-[10%] top-[11px] h-[2px] rounded-full bg-line" />
      <div
        aria-hidden
        className="absolute left-[10%] top-[11px] h-[2px] rounded-full bg-ink transition-[width] duration-700 ease-out"
        style={{ width: `calc(${fill} * 0.8%)` }}
      />

      {STOPS.map((stop, i) => {
        const done = i < current
        const here = i === current
        const at = dates[stop.key]
        return (
          <li key={stop.key} className="relative flex flex-col items-center gap-2 text-center">
            <span className="relative grid h-6 w-6 place-items-center">
              {here && order.status === 'awaiting_payment' && (
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
              {stop.label}
            </span>
            {at && <span className="text-[10px] leading-tight text-ink-faint sm:text-[11px]">{formatDate(at)}</span>}
          </li>
        )
      })}
    </ol>
  )
}
