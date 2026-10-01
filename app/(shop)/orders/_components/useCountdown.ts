'use client'

import { useEffect, useState } from 'react'
import type { Order } from '@/lib/types'

export interface Countdown {
  expired: boolean
  hours: number
  minutes: number
  seconds: number
  text: string
}

export default function useCountdown(deadlineIso: string | null | undefined): Countdown | null {
  const [left, setLeft] = useState<number | null>(null)

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
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return {
    expired: left === 0,
    hours,
    minutes,
    seconds,
    text: [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':'),
  }
}

export function paymentDeadline(
  order: Pick<Order, 'placedAt'> | null | undefined,
  hours: number | string | null | undefined,
): string | null {
  if (!order?.placedAt || !hours) return null
  return new Date(new Date(order.placedAt).getTime() + Number(hours) * 3600_000).toISOString()
}
