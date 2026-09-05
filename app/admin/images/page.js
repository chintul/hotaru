'use client'

import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_IMAGES } from '@/lib/queries'
import { copy, nodes } from '@/lib/format'
import AdminGate from '@/components/AdminGate'
import ProductImageManager from '@/components/ProductImageManager'

export default function AdminImagesPage() {
  return <AdminGate><ImageBoards /></AdminGate>
}

function ImageBoards() {
  const { data, loading } = useQuery(ADMIN_PRODUCT_IMAGES, { fetchPolicy: 'cache-and-network' })
  const products = nodes(data?.productCollection)
  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  if (loading && !data) return <p className="label text-ink-faint">Ачааллаж байна…</p>

  const withImages = products.filter((p) => nodes(p.productImageCollection).length > 0).length

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="label">Зураг ({withImages}/{products.length} бүтээгдэхүүн зурагтай)</h2>
        {!configured && (
          <p className="label text-sale">ImageKit тохируулагдаагүй байна.</p>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Эхний зураг нь каталогийн карт дээр, хоёр дахь нь хулгана дээр очиход солигдоно.
        Босоо (3:4) зураг хамгийн тохиромжтой.
      </p>

      <ul className="mt-8 space-y-6">
        {products.map((p) => (
          <li key={p.id} className="border border-line">
            <div className="flex flex-wrap items-baseline gap-x-4 px-5 py-3">
              <span className="font-medium">{copy(p).title ?? p.slug}</span>
              <span className="label text-ink-faint">{p.slug}</span>
              <span className="label ml-auto text-ink-faint">{p.status}</span>
            </div>
            <ProductImageManager product={p} />
          </li>
        ))}
      </ul>
    </div>
  )
}
