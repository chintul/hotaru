import { toNumber } from '@/lib/format'
import type { Order } from '@/lib/types'

export type PayStage = 'full' | 'deposit' | 'balance'

type StageOrder = Pick<Order, 'status' | 'totalMnt' | 'upfrontMnt' | 'balanceMnt' | 'minUpfrontMnt'>

export const hasBalance = (order: Pick<Order, 'balanceMnt'> | null | undefined): boolean =>
  toNumber(order?.balanceMnt) > 0

export function minUpfront(order: StageOrder): number {
  return order.minUpfrontMnt == null
    ? toNumber(order.totalMnt) - toNumber(order.balanceMnt)
    : toNumber(order.minUpfrontMnt)
}

export function isPreorderOrder(order: StageOrder | null | undefined): boolean {
  if (!order) return false
  return hasBalance(order) || minUpfront(order) < toNumber(order.totalMnt)
}

export function payStage(order: StageOrder | null | undefined): PayStage | null {
  if (order?.status === 'awaiting_payment') return isPreorderOrder(order) ? 'deposit' : 'full'
  if (order?.status === 'awaiting_balance') return 'balance'
  return null
}

export function dueNow(order: StageOrder, stage: PayStage): number {
  if (stage === 'balance') return toNumber(order.balanceMnt)
  return order.upfrontMnt == null ? toNumber(order.totalMnt) : toNumber(order.upfrontMnt)
}

export const STAGE_TITLE: Record<PayStage, string> = {
  full: 'Төлөх дүн',
  deposit: 'Одоо төлөх дүн',
  balance: 'Үлдэгдэл төлөх',
}
