'use client'

import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_IMAGES } from '@/lib/queries'
import { copy, nodes } from '@/lib/format'
import ProductImageManager from '@/components/ProductImageManager'
import { Card, PageHeader } from '@/components/admin/ui'

export default function AdminImagesPage() {
  const { data, loading } = useQuery(ADMIN_PRODUCT_IMAGES, { fetchPolicy: 'cache-and-network' })
  const products = nodes(data?.productCollection)
  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  const withImages = products.filter((p) => nodes(p.productImageCollection).length > 0).length

  return (
    <div>
      <PageHeader
        title="Зураг"
        subtitle={`${withImages}/${products.length} бүтээгдэхүүн зурагтай · эхний зураг карт дээр, хоёр дахь нь hover дээр`}
      />

      {!configured && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </div>
      )}

      <div className="space-y-4">
        {products.map((p) => (
          <Card
            key={p.id}
            title={<span className="flex items-center gap-2">{copy(p).title ?? p.slug}
              <span className="text-[12px] font-normal text-a-muted">{p.slug}</span></span>}
            actions={<span className="text-[12px] text-a-muted">{p.status}</span>}
          >
            <ProductImageManager product={p} />
          </Card>
        ))}
      </div>
    </div>
  )
}
