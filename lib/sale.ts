import { toNumber } from './format.ts'
import type { Mnt } from './types.ts'

export interface Sale {
  price: number
  was: number
  pct: number
}

export function saleOf(priceMnt: Mnt | null | undefined, compareAtPriceMnt: Mnt | null | undefined): Sale | null {
  const price = toNumber(priceMnt)
  const was = toNumber(compareAtPriceMnt)
  if (!was || was <= price) return null
  return { price, was, pct: Math.round(((was - price) / was) * 100) }
}

export const salePrice = (was: number, pct: number): number => Math.round((was * (100 - pct)) / 100 / 100) * 100
