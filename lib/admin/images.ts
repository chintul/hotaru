export interface LinkableVariant {
  id?: string | null
  optionValue?: string | null
  size?: string | null
  sku?: string | null
  image?: { id?: string | null } | null
}

export type ImageUsage = Record<string, string[]>

export function variantLabel(variant: LinkableVariant | null | undefined): string {
  const named = [variant?.optionValue, variant?.size].filter(Boolean).join(' · ')
  return named || variant?.sku || 'Нэргүй сонголт'
}

export function linkage(variants: readonly (LinkableVariant | null | undefined)[] = []): {
  usage: ImageUsage
  positionStillRules: boolean
} {
  const usage: ImageUsage = {}
  for (const v of variants) {
    const id = v?.image?.id
    if (!id) continue
    ;(usage[id] ??= []).push(variantLabel(v))
  }
  return { usage, positionStillRules: Object.keys(usage).length === 0 }
}

export function orphansOf(
  imageId: string,
  variants: readonly (LinkableVariant | null | undefined)[] = [],
): string[] {
  return variants.filter((v) => v?.image?.id === imageId).map(variantLabel)
}

const isValidIndex = (i: number | null, length: number): i is number =>
  typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < length

export function moveItem<T>(list: readonly T[] = [], from: number | null, to: number | null): T[] {
  const next = [...list]
  if (!isValidIndex(from, list.length) || !isValidIndex(to, list.length) || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
