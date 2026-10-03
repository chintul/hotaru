import { SIZE_PRESETS } from '@/lib/sizes'
import { errorMessage } from '@/lib/errors'

export const DUPLICATE_VARIANT_MESSAGE = 'Энэ өнгө, хэмжээ аль хэдийн байна.'

export const COMPARE_AT_MESSAGE = 'Хуучин үнэ одоогийн үнээс их байх ёстой.'

const DUPLICATE_PATTERN = /duplicate key|unique constraint|variants_product_option_/i

const COMPARE_AT_PATTERN = /compare_at_price|variants_check/i

export const variantErrorMessage = (e: unknown, fallback: string): string => {
  const message = errorMessage(e, fallback)
  if (DUPLICATE_PATTERN.test(message)) return DUPLICATE_VARIANT_MESSAGE
  return COMPARE_AT_PATTERN.test(message) ? COMPARE_AT_MESSAGE : message
}

export interface GridVariant {
  optionValue?: string | null
  size?: string | null
  position?: number | null
}

const PRESET_RANK: ReadonlyMap<string, number> = new Map(
  SIZE_PRESETS.flatMap((preset) => preset.sizes.map((size, i) => [size.toUpperCase(), i] as const)),
)

const NUMERIC = /^\d+(?:[.,]\d+)?$/

export const compareSizes = (a: string | null | undefined, b: string | null | undefined): number => {
  if (!a || !b) return a ? 1 : b ? -1 : 0
  if (NUMERIC.test(a) && NUMERIC.test(b)) return Number(a.replace(',', '.')) - Number(b.replace(',', '.'))
  const ra = PRESET_RANK.get(a.toUpperCase())
  const rb = PRESET_RANK.get(b.toUpperCase())
  if (ra !== undefined && rb !== undefined) return ra - rb
  return a.localeCompare(b, undefined, { numeric: true })
}

export interface ColourGroup<T> {
  colour: string | null
  variants: T[]
}

export const groupByColour = <T extends GridVariant>(variants: readonly T[]): ColourGroup<T>[] => {
  const groups = new Map<string, ColourGroup<T>>()
  for (const v of variants) {
    const key = v.optionValue ?? ''
    let group = groups.get(key)
    if (!group) {
      group = { colour: v.optionValue ?? null, variants: [] }
      groups.set(key, group)
    }
    group.variants.push(v)
  }
  return [...groups.values()].map((group) => ({
    ...group,
    variants: [...group.variants].sort(
      (a, b) => compareSizes(a.size, b.size) || (a.position ?? 0) - (b.position ?? 0),
    ),
  }))
}

export const comboKey = (colour: string | null | undefined, size: string) => `${colour ?? ''}\u0000${size}`

export interface PlannedVariant {
  colour: string | null
  size: string
}

export const planGrid = (
  colours: readonly string[],
  sizes: readonly string[],
  existing: readonly GridVariant[],
): { planned: PlannedVariant[]; skipped: number } => {
  const taken = new Set(existing.filter((v) => v.size).map((v) => comboKey(v.optionValue, v.size ?? '')))
  const axis: (string | null)[] = colours.length ? [...colours] : [null]
  const planned: PlannedVariant[] = []
  let skipped = 0
  for (const colour of axis) {
    for (const size of sizes) {
      if (taken.has(comboKey(colour, size))) skipped += 1
      else planned.push({ colour, size })
    }
  }
  return { planned, skipped }
}

export const plannedLabel = ({ colour, size }: PlannedVariant) => (colour ? `${colour}·${size}` : size)
