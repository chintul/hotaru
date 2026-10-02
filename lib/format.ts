import type {
  AddressSnapshot,
  CartItem,
  Connection,
  Mnt,
  OrderStatus,
  ProductTranslation,
  Variant,
} from './types.ts'

export const toNumber = (v: Mnt | null | undefined): number => (v == null || v === '' ? 0 : Number(v))

export const formatMnt = (v: Mnt | null | undefined): string =>
  v == null || v === '' ? '' : `${new Intl.NumberFormat('mn-MN').format(toNumber(v))}₮`

export const nodes = <T>(conn: Connection<T> | null | undefined): T[] =>
  conn?.edges?.map((e) => e.node) ?? []

export const firstNode = <T>(conn: Connection<T> | null | undefined): T | null => nodes(conn)[0] ?? null

export interface Translatable {
  productTranslationCollection?: Connection<ProductTranslation> | null
}

export const copy = (product: Translatable | null | undefined): ProductTranslation =>
  firstNode(product?.productTranslationCollection) ?? {}

export type CartLine = Pick<CartItem, 'quantity'> & {
  variant?: Pick<Variant, 'priceMnt'> | null
}

export const cartTotals = (items: readonly CartLine[]): { subtotal: number; count: number } => {
  const subtotal = items.reduce((sum, i) => sum + toNumber(i.variant?.priceMnt) * i.quantity, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  return { subtotal, count }
}

export const formatDate = (iso: string | number | Date | null | undefined): string =>
  iso ? new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium' }).format(new Date(iso)) : ''

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Төлбөр хүлээгдэж байна',
  deposit_paid: 'Урьдчилгаа төлсөн · бараа хүлээж байна',
  awaiting_balance: 'Бараа ирсэн · үлдэгдэл төлөх',
  paid: 'Төлбөр баталгаажсан',
  packed: 'Бэлтгэгдсэн',
  shipped: 'Хүргэлтэд гарсан',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
  refunded: 'Буцаагдсан',
  oversold: 'Нөөц хүрэлцээгүй',
}

export const orderStatusLabel = (s: OrderStatus | null | undefined): string => (s ? ORDER_STATUS_LABEL[s] : '')

export function parseJson<T extends object = Record<string, unknown>>(
  value: unknown,
  fallback: T = {} as T,
): T {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}

export const formatAddress = (raw: unknown): string => {
  const a = parseJson<AddressSnapshot>(raw)
  return [
    a.city_aimag,
    a.district_sum,
    a.khoroo_bag,
    a.building,
    a.entrance && `${a.entrance} орц`,
    a.apartment && `${a.apartment} тоот`,
  ]
    .filter(Boolean)
    .join(', ')
}

export interface Countable {
  productCollection?: { totalCount?: number | null } | null
}

export const stocked = <T extends Countable>(categories: readonly T[]): T[] =>
  categories.filter((c) => (c.productCollection?.totalCount ?? 0) > 0)
