import type { Tone } from '@/components/admin/ui'
import type { OrderStatus, PaymentStatus } from '@/lib/types'

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  awaiting_payment: 'amber',
  paid: 'green',
  packed: 'blue',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'grey',
  refunded: 'purple',
  oversold: 'red',
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Төлбөр хүлээж буй',
  paid: 'Төлөгдсөн',
  packed: 'Бэлтгэсэн',
  shipped: 'Илгээсэн',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
  refunded: 'Буцаагдсан',
  oversold: 'Нөөцгүй',
}

export const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  unpaid: 'grey',
  submitted: 'amber',
  confirmed: 'green',
  failed: 'red',
  refunded: 'purple',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Төлөгдөөгүй',
  submitted: 'Төлсөн гэсэн',
  confirmed: 'Баталгаажсан',
  failed: 'Амжилтгүй',
  refunded: 'Буцаасан',
}

export const statusTone = (s: OrderStatus | null | undefined) => (s ? STATUS_TONE[s] : undefined)
export const statusLabel = (s: OrderStatus | null | undefined) => (s ? STATUS_LABEL[s] : undefined)
export const paymentTone = (s: PaymentStatus | null | undefined) => (s ? PAYMENT_TONE[s] : undefined)
export const paymentLabel = (s: PaymentStatus | null | undefined) => (s ? PAYMENT_LABEL[s] : undefined)
