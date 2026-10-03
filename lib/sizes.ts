export interface SizePreset {
  key: 'shoes' | 'kids-shoes' | 'clothing' | 'one-size'
  label: string
  sizes: readonly string[]
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  { key: 'shoes', label: 'Гутал (35–42)', sizes: ['35', '36', '37', '38', '39', '40', '41', '42'] },
  { key: 'kids-shoes', label: 'Хүүхдийн гутал (24–34)', sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'] },
  { key: 'clothing', label: 'Хувцас (XS–XXL)', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
  { key: 'one-size', label: 'Нэг хэмжээ', sizes: ['Free size'] },
]

export const parseSizes = (text: string): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,\n;]/)) {
    const size = raw.trim()
    if (size && !seen.has(size)) {
      seen.add(size)
      out.push(size)
    }
  }
  return out
}

export interface DescribedVariant {
  optionValue?: string | null
  size?: string | null
}

export const describeVariant = (v: DescribedVariant | null | undefined): string =>
  [v?.optionValue, v?.size ? `Хэмжээ ${v.size}` : null].filter(Boolean).join(' · ')

export const uniqueColours = <T extends DescribedVariant>(variants: readonly T[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of variants) {
    if (v.optionValue && !seen.has(v.optionValue)) {
      seen.add(v.optionValue)
      out.push(v.optionValue)
    }
  }
  return out
}

export const hasSizes = (variants: readonly DescribedVariant[]): boolean => variants.some((v) => Boolean(v.size))
