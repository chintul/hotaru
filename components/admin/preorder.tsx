'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_REQUEST_BALANCE, CANCEL_ORDER } from '@/lib/queries'
import { formatMnt, toNumber } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import type { Order } from '@/lib/types'
import { useConfirm } from './confirm'

export const REQUEST_BALANCE_LABEL = 'Бараа ирсэн · үлдэгдэл нэхэмжлэх'

export type OrderRef = Pick<Order, 'id' | 'orderNumber' | 'email' | 'phone' | 'balanceMnt'>

export const upfrontOf = (order: Pick<Order, 'totalMnt' | 'upfrontMnt' | 'balanceMnt'>): number =>
  order.upfrontMnt != null && order.upfrontMnt !== ''
    ? toNumber(order.upfrontMnt)
    : toNumber(order.totalMnt) - toNumber(order.balanceMnt)

export const isDepositOrder = (order: Pick<Order, 'balanceMnt'>): boolean => toNumber(order.balanceMnt) > 0

const notifyLine = (order: OrderRef) =>
  order.email
    ? `${order.email} хаягаар үлдэгдэл төлөх мэдэгдэл автоматаар очно.`
    : `Имэйлгүй захиалга тул ${order.phone ?? 'утсаар'} холбогдож мэдэгдээрэй.`

export function useRequestBalance(onDone: () => unknown) {
  const [request, { loading }] = useMutation<unknown, { orderId: string }>(ADMIN_REQUEST_BALANCE)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const run = async (order: OrderRef) => {
    const ok = await confirm({
      title: `${order.orderNumber}: үлдэгдэл ${formatMnt(order.balanceMnt)} нэхэмжлэх үү?`,
      description: `Бараа ирсэн бол үргэлжлүүлнэ үү.\n${notifyLine(order)}\nТөлбөр орсныг дараа нь баталгаажуулна.`,
      confirmLabel: 'Нэхэмжлэх',
    })
    if (!ok) return
    setError(null)
    try {
      await request({ variables: { orderId: order.id } })
      await onDone()
    } catch (e) {
      setError(errorMessage(e, 'Нэхэмжлэхэд алдаа гарлаа.'))
    }
  }

  return { run, loading, error }
}

export type CancelTarget = Pick<Order, 'id' | 'orderNumber' | 'paidAt' | 'totalMnt' | 'upfrontMnt' | 'balanceMnt' | 'email'>

export function useCancelOrder(onDone: () => unknown) {
  const [cancel, { loading }] = useMutation<unknown, { orderId: string; reason: string }>(CANCEL_ORDER)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const run = async (order: CancelTarget) => {
    const depositPaid = isDepositOrder(order) && Boolean(order.paidAt)
    const ok = await confirm({
      title: `${order.orderNumber} захиалгыг цуцлах уу?`,
      description: depositPaid
        ? `Худалдан авагч урьдчилгаа ${formatMnt(upfrontOf(order))} төлсөн байна. Урьдчилгаа буцаагдахгүй гэж захиалах үед мэдэгдсэн — буцаах эсэхээ өөрөө шийдэж, шаардлагатай бол банкаар буцаана.\n${order.email ? 'Худалдан авагчид цуцалсан тухай имэйл очно. ' : ''}Энэ үйлдлийг буцаах боломжгүй.`
        : 'Нөөц агуулах руу буцаж, энэ үйлдлийг буцаах боломжгүй.',
      confirmLabel: 'Цуцлах',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    try {
      await cancel({ variables: { orderId: order.id, reason: depositPaid ? 'admin cancelled after deposit' : 'admin cancelled' } })
      await onDone()
    } catch (e) {
      setError(errorMessage(e, 'Алдаа гарлаа.'))
    }
  }

  return { run, loading, error }
}
