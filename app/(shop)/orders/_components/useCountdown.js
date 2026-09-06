'use client'

import { useEffect, useState } from 'react'

/**
 * Time left until a deadline, ticking once a second.
 *
 * Returns null until after mount. The order page is server-rendered before
 * Apollo has data, so reading the clock during render would produce a server
 * string that never matches the client's a moment later — a hydration mismatch
 * for something as visible as a countdown. Starting at null and filling it in
 * from an effect keeps the first client render identical to the server's.
 */
export default function useCountdown(deadlineIso) {
  const [left, setLeft] = useState(null)

  useEffect(() => {
    if (!deadlineIso) return
    const target = new Date(deadlineIso).getTime()
    if (Number.isNaN(target)) return

    const tick = () => setLeft(Math.max(0, target - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineIso])

  if (left == null) return null
  const total = Math.floor(left / 1000)
  return {
    expired: left === 0,
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    // 23:04:59 — padded so the row does not jitter as digits drop.
    text: [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':'),
  }
}

/** placed_at + the owner's payment window, or null when no window is set. */
export function paymentDeadline(order, hours) {
  if (!order?.placedAt || !hours) return null
  return new Date(new Date(order.placedAt).getTime() + Number(hours) * 3600_000).toISOString()
}
