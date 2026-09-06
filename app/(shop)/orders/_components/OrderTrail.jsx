'use client'

import { formatDate } from '@/lib/format'
import { IconCheck } from '@/components/Icons'

/**
 * The five stops an order makes, drawn as a trail.
 *
 * Only three of them have a timestamp column (placed_at, paid_at, shipped_at);
 * "packed" and "delivered" are status-only. So the dot state comes from
 * `status` — the authoritative field — and the date underneath is shown only
 * where one actually exists. Inventing a date for the other two would be a lie
 * the customer has no way to check.
 */
const STOPS = [
  { key: 'placed', label: 'Захиалсан' },
  { key: 'paid', label: 'Төлсөн' },
  { key: 'packed', label: 'Бэлтгэсэн' },
  { key: 'shipped', label: 'Замдаа' },
  { key: 'delivered', label: 'Хүрсэн' },
]

// Where each status sits on the trail. Terminal states (cancelled, refunded,
// oversold) are absent on purpose: the page renders a banner for those instead
// of pretending the parcel is still moving.
const STOP_INDEX = {
  awaiting_payment: 0,
  paid: 1,
  packed: 2,
  shipped: 3,
  delivered: 4,
}

export function trailApplies(status) {
  return status in STOP_INDEX
}

export default function OrderTrail({ order }) {
  const current = STOP_INDEX[order.status] ?? 0
  const dates = {
    placed: order.placedAt,
    paid: order.paidAt,
    shipped: order.shippedAt,
  }
  // The connecting line fills to the middle of the current dot, so a
  // half-finished trail never looks like it stops between two stops.
  const fill = (current / (STOPS.length - 1)) * 100

  return (
    <ol className="relative mt-2 grid grid-cols-5">
      {/* Track. Inset by half a column at each end so it starts and ends under
          a dot rather than at the card edge. */}
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
