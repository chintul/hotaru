'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_DETAIL } from '@/lib/queries'
import { copy, firstNode, nodes } from '@/lib/format'
import { Card, PageHeader, Status } from '@/components/admin/ui'
import ProductForm from '@/components/admin/product/ProductForm'
import VariantsTab from '@/components/admin/product/VariantsTab'
import ImagesTab from '@/components/admin/product/ImagesTab'

const STATUS_TONE = { active: 'green', draft: 'amber', archived: 'grey' }

export default function ProductEditorPage() {
  // The boundary no longer exists for useSearchParams — `?tab=` is gone — but
  // useParams suspends on a route without generateStaticParams once
  // cacheComponents is enabled (next docs, use-params.md:73-76). Keeping it is
  // one wrapper and removes a future build failure.
  return (
    <Suspense fallback={<p className="text-[13px] text-a-muted">Ачааллаж байна…</p>}>
      <Editor />
    </Suspense>
  )
}

function Editor() {
  const { id } = useParams()

  const { data, loading, refetch } = useQuery(ADMIN_PRODUCT_DETAIL, {
    variables: { productId: id },
    fetchPolicy: 'cache-and-network',
  })

  const product = firstNode(data?.productCollection)
  const categories = nodes(data?.categoryCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

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
        actions={<Status tone={STATUS_TONE[product.status] ?? 'grey'}>{product.status}</Status>}
      />

      <div className="space-y-4">
        <ProductForm {...shared} categories={categories} />
        <VariantsTab {...shared} />
        <ImagesTab {...shared} />
      </div>
    </>
  )
}
