import { gql } from '@apollo/client'
import { firstNode, nodes } from '../lib/format.ts'
import type { Connection, Mnt } from '../lib/types.ts'

export { firstNode, nodes }

export const localTypeDefs = gql`
  extend type Query {
    isCartOpen: Boolean!
    isSearchOpen: Boolean!
    isMobileNavOpen: Boolean!
    selectedVariantId: UUID
  }

  extend type Product {
    displayPrice: String!
    isOnSale: Boolean!
  }

  extend type Variant {
    displayPrice: String!
    isPurchasable: Boolean!
  }

  extend type Order {
    displayTotal: String!
  }
`

export const formatMnt = (amount: Mnt | null | undefined): string =>
  amount == null
    ? ''
    : `${new Intl.NumberFormat('mn-MN').format(Number(amount))}₮`

interface PricedProduct {
  minPriceMnt?: Mnt | null
}

interface StockedVariant {
  priceMnt?: Mnt | null
  quantity?: number | null
  allowBackorder?: boolean | null
}

interface TotalledOrder {
  totalMnt?: Mnt | null
}

export const localResolvers = {
  Product: {
    displayPrice: (product: PricedProduct): string => formatMnt(product.minPriceMnt),
    isOnSale: (): boolean => false,
  },
  Variant: {
    displayPrice: (variant: StockedVariant): string => formatMnt(variant.priceMnt),
    isPurchasable: (variant: StockedVariant): boolean | null | undefined =>
      (variant.quantity ?? 0) > 0 || variant.allowBackorder,
  },
  Order: {
    displayTotal: (order: TotalledOrder): string => formatMnt(order.totalMnt),
  },
}

export interface UiState {
  isCartOpen: boolean
  isSearchOpen: boolean
  isMobileNavOpen: boolean
  selectedVariantId: string | null
}

export const uiDefaults: UiState = {
  isCartOpen: false,
  isSearchOpen: false,
  isMobileNavOpen: false,
  selectedVariantId: null,
}

interface LocalisedCopy {
  locale?: string | null
}

export const translation = <T extends LocalisedCopy>(
  product: { productTranslationCollection?: Connection<T> | null } | null | undefined,
  locale = 'mn',
): T | null =>
  nodes(product?.productTranslationCollection).find((t) => t.locale === locale) ??
  firstNode(product?.productTranslationCollection)
