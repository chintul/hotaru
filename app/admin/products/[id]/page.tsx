'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_DETAIL } from '@/lib/queries'
import { copy, firstNode, nodes } from '@/lib/format'
import type { Connection } from '@/lib/types'
import { Card, PageHeader, Status, type Tone } from '@/components/admin/ui'
import ProductForm from '@/components/admin/product/ProductForm'
import MediaVariants from '@/components/admin/product/MediaVariants'
import PreorderTerms from '@/components/admin/product/PreorderTerms'
import type { EditorCategory, EditorProduct } from '@/components/admin/product/types'

const STATUS_TONE: Record<string, Tone> = { active: 'green', draft: 'amber', archived: 'grey' }

interface ProductDetailData {
  productCollection: Connection<EditorProduct> | null
  categoryCollection: Connection<EditorCategory> | null
}

const loadingNotice = <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

export default function ProductEditorPage() {
  return (
    <Suspense fallback={loadingNotice}>
      <Editor />
    </Suspense>
  )
}

function Editor() {
  const { id } = useParams<{ id: string }>()

  const { data, loading, refetch } = useQuery<ProductDetailData, { productId: string }>(ADMIN_PRODUCT_DETAIL, {
    variables: { productId: id },
    fetchPolicy: 'cache-and-network',
  })

  const product = firstNode(data?.productCollection)
  const categories = nodes(data?.categoryCollection)

  if (loading && !data) return loadingNotice

  if (!product) {
    return (
      <Card title="Бүтээгдэхүүн олдсонгүй">
        <Link href="/admin/products" className="text-[13px] underline">← Бараа руу буцах</Link>
      </Card>
    )
  }

  const shared = { product, refetch }

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-[13px] text-a-muted hover:text-a-ink">
        ← Бараа
      </Link>

      <PageHeader
        title={copy(product).title ?? product.slug}
        subtitle={product.slug}
        actions={<Status tone={STATUS_TONE[product.status ?? ''] ?? 'grey'}>{product.status}</Status>}
      />

      <div className="space-y-4">
        <ProductForm {...shared} categories={categories} />
        <MediaVariants {...shared} />
        <PreorderTerms {...shared} />
      </div>
    </>
  )
}
