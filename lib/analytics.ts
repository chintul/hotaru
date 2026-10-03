export type TrackKind = 'product_view' | 'add_to_cart' | 'checkout_start' | 'order_placed'

export const EVENT_NAME: Record<TrackKind, string> = {
  product_view: 'product_viewed',
  add_to_cart: 'added_to_cart',
  checkout_start: 'checkout_started',
  order_placed: 'order_placed',
}

export interface TrackOptions {
  productSlug?: string
  orderNumber?: string
}

export const eventProperties = (options: TrackOptions): Record<string, string> => {
  const props: Record<string, string> = {}
  if (options.productSlug) props.product_slug = options.productSlug
  if (options.orderNumber) props.order_number = options.orderNumber
  return props
}

export function isAdminUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  try {
    return new URL(url).pathname.startsWith('/admin')
  } catch {
    return url.startsWith('/admin')
  }
}

export interface AnalyticsProductRow {
  slug: string
  title: string
  units: number
  revenue_mnt: number
}

export interface AnalyticsCategoryRow {
  slug: string
  name: string
  units: number
  revenue_mnt: number
}

export interface AnalyticsStockRow {
  slug: string
  title: string
  variant: string | null
  quantity?: number
  baseline?: number
  ratio?: number
  preorder?: boolean
}

export interface AnalyticsReport {
  totals: { orders: number; revenue_mnt: number; avg_order_mnt: number }
  by_day: { day: string; orders: number; revenue_mnt: number }[]
  top_products: AnalyticsProductRow[]
  categories: AnalyticsCategoryRow[]
  stock_low: AnalyticsStockRow[]
  stock_out: AnalyticsStockRow[]
  carts: { created: number; converted: number; abandoned: number; active: number; abandoned_value_mnt: number }
  order_stages: Record<string, number>
}
