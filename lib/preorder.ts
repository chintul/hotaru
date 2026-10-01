import { toNumber } from './format.ts'
import type { Mnt } from './types.ts'

export const DEFAULT_DEPOSIT_PCT = 50

export interface PreorderStock {
  quantity?: number | null
  allowBackorder?: boolean | null
}

export const isPreorder = (variant: PreorderStock | null | undefined, wanted = 1): boolean =>
  Boolean(variant?.allowBackorder) && (variant?.quantity ?? 0) < wanted

export const depositOf = (lineTotal: number, pct: number): number => Math.ceil((lineTotal * pct) / 100)

export interface SplitLine {
  quantity: number
  priceMnt: Mnt | null | undefined
  variant: PreorderStock | null | undefined
  depositPct?: number | null
}

export interface PaymentSplit {
  total: number
  balance: number
  upfront: number
  hasPreorder: boolean
}

export function splitPayment(lines: readonly SplitLine[], extrasMnt = 0): PaymentSplit {
  let subtotal = 0
  let balance = 0
  let hasPreorder = false
  for (const line of lines) {
    const lineTotal = toNumber(line.priceMnt) * line.quantity
    subtotal += lineTotal
    if (isPreorder(line.variant, line.quantity)) {
      hasPreorder = true
      balance += lineTotal - depositOf(lineTotal, line.depositPct ?? DEFAULT_DEPOSIT_PCT)
    }
  }
  const total = Math.max(subtotal + extrasMnt, 0)
  const capped = Math.min(balance, total)
  return { total, balance: capped, upfront: total - capped, hasPreorder }
}
