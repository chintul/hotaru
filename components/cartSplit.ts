import { splitPayment } from '@/lib/preorder'
import type { PaymentSplit } from '@/lib/preorder'
import type { CartItem } from '@/lib/types'

export function cartSplit(items: readonly CartItem[], extrasMnt = 0): PaymentSplit {
  return splitPayment(
    items.map((item) => ({
      quantity: item.quantity,
      priceMnt: item.variant?.priceMnt,
      variant: item.variant,
      depositPct: item.variant?.product?.preorderDepositPct,
    })),
    extrasMnt,
  )
}
