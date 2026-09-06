'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_DETAIL } from '@/lib/queries'
import { copy, firstNode, nodes } from '@/lib/format'
import { Card, PageHeader, Status } from '@/components/admin/ui'
import DetailsTab from '@/components/admin/product/DetailsTab'
import VariantsTab from '@/components/admin/product/VariantsTab'
import ImagesTab from '@/components/admin/product/ImagesTab'
import SeoTab from '@/components/admin/product/SeoTab'

const TABS = [
  ['details', 'Мэдээлэл'],
  ['variants', 'Сонголт'],
  ['images', 'Зураг'],
  ['seo', 'SEO'],
]

const STATUS_TONE = { active: 'green', draft: 'amber', archived: 'grey' }

export default function ProductEditorPage() {
  // useSearchParams needs a boundary or the route cannot be prerendered.
  return (
    <Suspense fallback={<p className="text-[13px] text-a-muted">Ачааллаж байна…</p>}>
      <Editor />
    </Suspense>
  )
}

function Editor() {
  const { id } = useParams()
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get('tab')
  const tab = TABS.some(([k]) => k === requested) ? requested : 'details'

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

  // The tab lives in the URL so it is linkable and Back works.
  const go = (key) => router.replace(`/admin/products/${id}?tab=${key}`, { scroll: false })
  const shared = { product, categories, refetch }

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

      <div className="mb-4 flex gap-1 border-b border-a-line">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => go(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === key
                ? 'border-a-ink text-a-ink'
                : 'border-transparent text-a-muted hover:text-a-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && <DetailsTab {...shared} />}
      {tab === 'variants' && <VariantsTab {...shared} />}
      {tab === 'images' && <ImagesTab {...shared} />}
      {tab === 'seo' && <SeoTab {...shared} />}
    </>
  )
}
