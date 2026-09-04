/**
 * Money helpers.
 *
 * Two things to remember, both easy to get wrong:
 *  1. Amounts are WHOLE Mongolian tugrik. No minor unit. Never divide by 100.
 *  2. pg_graphql maps Postgres `bigint` to a String scalar (GraphQL Int is
 *     32-bit), so every *_mnt field arrives as "189000", not 189000. Coerce
 *     before any arithmetic or you will concatenate instead of add.
 */
export const toNumber = (v) => (v == null || v === '' ? 0 : Number(v))

export const formatMnt = (v) =>
  v == null || v === '' ? '' : `${new Intl.NumberFormat('mn-MN').format(toNumber(v))}₮`

/** Relay connections are noisy to unwrap inline. Do it once, here. */
export const nodes = (conn) => conn?.edges?.map((e) => e.node) ?? []
export const firstNode = (conn) => nodes(conn)[0] ?? null

/** Localised copy for a product. Only 'mn' rows exist today. */
export const copy = (product) => firstNode(product?.productTranslationCollection) ?? {}

export const cartTotals = (items) => {
  const subtotal = items.reduce(
    (sum, i) => sum + toNumber(i.variant?.priceMnt) * i.quantity,
    0,
  )
  const count = items.reduce((sum, i) => sum + i.quantity, 0)
  return { subtotal, count }
}

export const formatDate = (iso) =>
  iso ? new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium' }).format(new Date(iso)) : ''

/** Human labels for the order state machine. */
export const ORDER_STATUS_LABEL = {
  awaiting_payment: 'Төлбөр хүлээгдэж байна',
  paid: 'Төлбөр баталгаажсан',
  packed: 'Бэлтгэгдсэн',
  shipped: 'Хүргэлтэд гарсан',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
  refunded: 'Буцаагдсан',
  oversold: 'Нөөц хүрэлцээгүй',
}

/**
 * pg_graphql serialises a jsonb column as a JSON *string*, not an object, so
 * `order.shippingAddress.city_aimag` is silently undefined until you parse it.
 * Accepts either shape so it stays correct if that ever changes.
 */
export const parseJson = (value, fallback = {}) => {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

/** Render a stored address snapshot as one line. Keys are snake_case: the
 *  snapshot is `to_jsonb(addresses)`, so it carries the column names. */
export const formatAddress = (raw) => {
  const a = parseJson(raw)
  return [
    a.city_aimag, a.district_sum, a.khoroo_bag, a.building,
    a.entrance && `${a.entrance} орц`,
    a.apartment && `${a.apartment} тоот`,
  ].filter(Boolean).join(', ')
}
