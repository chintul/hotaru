import type { Tone } from '@/components/admin/ui'
import type { OrderStatus, PaymentKind, PaymentStatus } from '@/lib/types'

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  awaiting_payment: 'amber',
  deposit_paid: 'blue',
  awaiting_balance: 'amber',
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
  deposit_paid: 'Урьдчилгаа төлсөн',
  awaiting_balance: 'Үлдэгдэл хүлээж буй',
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
  partially_paid: 'blue',
  confirmed: 'green',
  failed: 'red',
  refunded: 'purple',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Төлөгдөөгүй',
  submitted: 'Төлсөн гэсэн',
  partially_paid: 'Урьдчилгаа орсон',
  confirmed: 'Баталгаажсан',
  failed: 'Амжилтгүй',
  refunded: 'Буцаасан',
}

export const statusTone = (s: OrderStatus | null | undefined) => (s ? STATUS_TONE[s] : undefined)
export const statusLabel = (s: OrderStatus | null | undefined) => (s ? STATUS_LABEL[s] : undefined)
export const paymentTone = (s: PaymentStatus | null | undefined) => (s ? PAYMENT_TONE[s] : undefined)
export const paymentLabel = (s: PaymentStatus | null | undefined) => (s ? PAYMENT_LABEL[s] : undefined)

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  full: 'Бүтэн төлбөр',
  deposit: 'Урьдчилгаа',
  balance: 'Үлдэгдэл',
}

export const CONFIRM_PAYMENT_LABEL: Record<PaymentKind, string> = {
  full: 'Төлбөр баталгаажуулах',
  deposit: 'Урьдчилгаа баталгаажуулах',
  balance: 'Үлдэгдэл баталгаажуулах',
}

export const paymentKindLabel = (k: PaymentKind | null | undefined) => PAYMENT_KIND_LABEL[k ?? 'full']
