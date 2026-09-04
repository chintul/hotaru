import { gql } from '@apollo/client'

/**
 * Client-only schema extensions.
 *
 * pg_graphql reflects the database and nothing else, so anything that exists
 * purely in the browser — which drawer is open, which variant the shopper has
 * highlighted, formatted prices — has no server field to hang off. These
 * `@client` fields give that UI state the same shape as real data, so a
 * component reads everything it needs from one query instead of mixing Apollo
 * with a second state library.
 *
 * Nothing here is ever sent to Supabase.
 */
export const localTypeDefs = gql`
  extend type Query {
    """Slide-out cart drawer state."""
    isCartOpen: Boolean!
    """Full-screen search overlay state."""
    isSearchOpen: Boolean!
    isMobileNavOpen: Boolean!
    """Variant the PDP selector currently has active, before add-to-cart."""
    selectedVariantId: UUID
  }

  extend type Product {
    """Formatted for display, e.g. "189,000₮". Derived from minPriceMnt."""
    displayPrice: String!
    """True when compareAtPrice on the cheapest variant exceeds its price."""
    isOnSale: Boolean!
  }

  extend type Variant {
    displayPrice: String!
    """quantity > 0 || allowBackorder — the flag the add-to-cart button reads."""
    isPurchasable: Boolean!
  }

  extend type Order {
    displayTotal: String!
  }
`

/**
 * Whole tugrik. There is no minor unit in MNT — if you ever find yourself
 * writing `/ 100` in this codebase, something upstream is wrong.
 */
export const formatMnt = (amount) =>
  amount == null
    ? ''
    : `${new Intl.NumberFormat('mn-MN').format(Number(amount))}₮`

/**
 * Local resolvers matching the extensions above. Register alongside the cache
 * when the Apollo client is constructed in Phase 2.
 */
export const localResolvers = {
  Product: {
    displayPrice: (product) => formatMnt(product.minPriceMnt),
    isOnSale: () => false, // resolved from variant data once the PDP loads it
  },
  Variant: {
    displayPrice: (variant) => formatMnt(variant.priceMnt),
    isPurchasable: (variant) => variant.quantity > 0 || variant.allowBackorder,
  },
  Order: {
    displayTotal: (order) => formatMnt(order.totalMnt),
  },
}

/**
 * Reactive-variable defaults for the UI-state fields.
 */
export const uiDefaults = {
  isCartOpen: false,
  isSearchOpen: false,
  isMobileNavOpen: false,
  selectedVariantId: null,
}

/**
 * pg_graphql returns Relay connections everywhere. Unwrapping them inline makes
 * components noisy, so do it once here.
 */
export const nodes = (connection) =>
  connection?.edges?.map((edge) => edge.node) ?? []

export const firstNode = (connection) => nodes(connection)[0] ?? null

/** Localised copy for the active locale. Only 'mn' rows exist today. */
export const translation = (product, locale = 'mn') =>
  nodes(product?.productTranslationCollection).find((t) => t.locale === locale) ??
  firstNode(product?.productTranslationCollection)
