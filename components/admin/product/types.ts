import type { Connection, Product, ProductImage, Variant } from '@/lib/types'

export type EditorImage = ProductImage & { id: string }

export type EditorVariant = Omit<Variant, 'image'> & { image?: EditorImage | null }

export type EditorProduct = Omit<Product, 'id' | 'variantCollection' | 'productImageCollection'> & {
  id: string
  variantCollection?: Connection<EditorVariant> | null
  productImageCollection?: Connection<EditorImage> | null
}

export interface EditorCategory {
  id: string
  slug: string
  categoryTranslationCollection?: Connection<{ name?: string | null }> | null
}

export type Refetch = () => Promise<unknown>
