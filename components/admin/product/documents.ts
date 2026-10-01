import type { TypedDocumentNode } from '@apollo/client'
import {
  ADMIN_ADD_IMAGE,
  ADMIN_DELETE_IMAGE,
  ADMIN_DELETE_VARIANT,
  ADMIN_REORDER_IMAGES,
  ADMIN_SET_STOCK,
  ADMIN_SET_VARIANT_IMAGE,
  ADMIN_UPSERT_PRODUCT,
  ADMIN_UPSERT_VARIANT,
} from '@/lib/queries'

export interface AddImageVars {
  productId: string
  imagekitFileId: string | undefined
  filePath: string | undefined
  alt: string | null
  width: number | null
  height: number | null
}

export const ADD_IMAGE: TypedDocumentNode<
  { adminAddProductImage: { id: string } | null },
  AddImageVars
> = ADMIN_ADD_IMAGE

export const DELETE_IMAGE: TypedDocumentNode<unknown, { imageId: string }> = ADMIN_DELETE_IMAGE

export const REORDER_IMAGES: TypedDocumentNode<
  unknown,
  { productId: string; imageIds: string[] }
> = ADMIN_REORDER_IMAGES

export const SET_VARIANT_IMAGE: TypedDocumentNode<
  unknown,
  { variantId: string; imageId: string | null }
> = ADMIN_SET_VARIANT_IMAGE

export interface UpsertVariantVars {
  productId: string
  variantId: string | null
  priceMnt: string
  quantity: number
  sku: string | null
  optionLabel: string | null
  optionValue: string | null
  compareAtPriceMnt: string | number | null
  allowBackorder: boolean
  isActive: boolean | null | undefined
  sortOrder: number
  imageId: string | null
}

export const UPSERT_VARIANT: TypedDocumentNode<unknown, UpsertVariantVars> = ADMIN_UPSERT_VARIANT

export const SET_STOCK: TypedDocumentNode<
  unknown,
  { variantId: string; quantity: number }
> = ADMIN_SET_STOCK

export const DELETE_VARIANT: TypedDocumentNode<unknown, { variantId: string }> = ADMIN_DELETE_VARIANT

export interface UpsertProductVars {
  productId: string
  slug: string
  title: string
  categorySlug: string | null
  subtitle: string | null
  description: string | null
  careDetails: string | null
  status: string
  isFeatured: boolean
  sortOrder: number
  seoTitle: string | null
  seoDescription: string | null
}

export const UPSERT_PRODUCT: TypedDocumentNode<unknown, UpsertProductVars> = ADMIN_UPSERT_PRODUCT
