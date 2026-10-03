import { toNumber } from '@/lib/format'
import { saleOf, salePrice } from '@/lib/sale'
import type { UpsertVariantVars } from './documents'
import type { EditorVariant } from './types'

export const SALE_PCT_MIN = 1
export const SALE_PCT_MAX = 90
export const SALE_PCT_CHIPS: readonly number[] = [10, 20, 30, 50]

export interface PriceChange {
  variant: EditorVariant
  priceMnt: number
  compareAtPriceMnt: number | null
}

export const isValidSalePct = (pct: number): boolean =>
  Number.isInteger(pct) && pct >= SALE_PCT_MIN && pct <= SALE_PCT_MAX

export const isOnSale = (v: EditorVariant): boolean => saleOf(v.priceMnt, v.compareAtPriceMnt) !== null

export const maxSalePct = (variants: readonly Pick<EditorVariant, 'priceMnt' | 'compareAtPriceMnt'>[]): number =>
  variants.reduce((max, v) => Math.max(max, saleOf(v.priceMnt, v.compareAtPriceMnt)?.pct ?? 0), 0)

export const wasPriceOf = (v: EditorVariant): number =>
  isOnSale(v) ? toNumber(v.compareAtPriceMnt) : toNumber(v.priceMnt)

export const planSale = (variants: readonly EditorVariant[], pct: number): PriceChange[] =>
  variants
    .filter((v) => v.isActive !== false)
    .map((v) => {
      const was = wasPriceOf(v)
      return { variant: v, priceMnt: salePrice(was, pct), compareAtPriceMnt: was }
    })

export const planCancel = (variants: readonly EditorVariant[]): PriceChange[] =>
  variants
    .filter((v) => v.compareAtPriceMnt != null && v.compareAtPriceMnt !== '')
    .map((v) => ({ variant: v, priceMnt: toNumber(v.compareAtPriceMnt), compareAtPriceMnt: null }))

export const upsertVarsOf = (
  productId: string,
  v: EditorVariant,
  overrides: Partial<UpsertVariantVars> = {},
): UpsertVariantVars => ({
  productId,
  variantId: v.id,
  priceMnt: String(toNumber(v.priceMnt)),
  quantity: v.quantity ?? 0,
  sku: v.sku || null,
  optionLabel: v.optionLabel || null,
  optionValue: v.optionValue || null,
  compareAtPriceMnt: v.compareAtPriceMnt == null || v.compareAtPriceMnt === '' ? null : String(toNumber(v.compareAtPriceMnt)),
  allowBackorder: v.allowBackorder ?? false,
  isActive: v.isActive ?? true,
  sortOrder: v.position ?? 0,
  imageId: null,
  ...overrides,
})

export const changeVars = (productId: string, change: PriceChange): UpsertVariantVars =>
  upsertVarsOf(productId, change.variant, {
    priceMnt: String(change.priceMnt),
    compareAtPriceMnt: change.compareAtPriceMnt == null ? null : String(change.compareAtPriceMnt),
  })
