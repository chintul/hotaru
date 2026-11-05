'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { ADMIN_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import type { Category, Connection } from '@/lib/types'
import { Card, EmptyState, PageHeader, Status } from '@/components/admin/ui'
import CoverField from '@/components/admin/CoverField'

type CategoryRow = Category & { id: string }

interface CategoriesData {
  categoryCollection: Connection<CategoryRow> | null
}

const nameOf = (c: Category) => firstNode(c.categoryTranslationCollection)?.name ?? c.slug

function coverStatus(c: CategoryRow) {
  if (!c.heroImagePath && !c.heroMobileImagePath) return <Status tone="grey">Cover оруулаагүй</Status>
  if (!c.isVisible) return <Status tone="amber">Ангилал нуусан</Status>
  if (!c.productCollection?.totalCount) return <Status tone="amber">Бараагүй тул харагдахгүй</Status>
  return <Status tone="green">Нүүр хуудсанд харагдана</Status>
}

export default function CoversPage() {
  const { data, loading, refetch } = useQuery<CategoriesData>(ADMIN_CATEGORIES, { fetchPolicy: 'cache-and-network' })
  const categories = nodes(data?.categoryCollection)
  const live = categories.filter((c) => (c.heroImagePath || c.heroMobileImagePath) && c.isVisible && c.productCollection?.totalCount)

  return (
    <>
      <PageHeader
        title="Cover"
        subtitle={`Нүүр хуудасны гүйдэг cover. Ангилал бүр нэг слайд болно — одоо ${live.length} слайд харагдаж байна.`}
      />
      <p className="mb-5 max-w-2xl text-[13px] text-a-muted">
        Аль нэг cover-той ангилал слайд болно. Утасны cover-ыг компьютер дээр бүтнээр нь, хажуу талыг нь бүдгэрүүлж
        харуулна; компьютерийн cover оруулбал компьютер дээр түүнийг харуулна. Слайдын дараалал шинэ бараа нэмэгдсэн
        ангиллаас эхэлнэ. Ангиллын нэр, харагдах эсэхийг{' '}
        <Link href="/admin/categories" className="underline underline-offset-2">Ангилал</Link> хэсгээс өөрчилнө.
      </p>

      {loading && !categories.length ? (
        <p className="text-[13px] text-a-muted">Ачаалж байна…</p>
      ) : !categories.length ? (
        <EmptyState title="Ангилал алга" body="Эхлээд ангилал үүсгээд cover оруулна уу." />
      ) : (
        <div className="grid gap-4">
          {categories.map((c) => (
            <Card key={c.id} title={nameOf(c)} subtitle={`${c.productCollection?.totalCount ?? 0} бараа`} actions={coverStatus(c)}>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8">
                <CoverField category={c} kind="wide" onSaved={refetch} />
                <CoverField category={c} kind="mobile" onSaved={refetch} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
