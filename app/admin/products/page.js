'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_PRODUCTS, ADMIN_BULK_SET_PRODUCT_CATEGORY,
  ADMIN_BULK_SET_PRODUCT_FEATURED, ADMIN_BULK_SET_PRODUCT_STATUS, ADMIN_PRODUCTS,
} from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import {
  Button, DataTable, EmptyState, PageHeader, Select, Status, TableToolbar,
} from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import ProductImage from '@/components/ProductImage'
import { Plus } from '@/components/admin/icons'

/**
 * The catalog list. Editing lives at /admin/products/[id] — this page finds a
 * product and acts on many at once; it does not edit one.
 */
export default function ProductsPage() {
  const router = useRouter()
  const { data, loading, refetch } = useQuery(ADMIN_PRODUCTS, { fetchPolicy: 'cache-and-network' })
  const [search, setSearch] = useState('')

  const products = nodes(data?.productCollection)
  const categories = nodes(data?.categoryCollection)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      const title = (copy(p).title ?? p.slug).toLowerCase()
      return !term || title.includes(term) || p.slug.toLowerCase().includes(term)
    })
  }, [products, search])

  const columns = [
    { key: 'image', header: '', render: (p) => {
      const img = nodes(p.productImageCollection)[0]
      return (
        <span className="block h-9 w-9 overflow-hidden rounded-md bg-a-hover">
          {img && <ProductImage filePath={img.filePath} alt="" seed={p.id} width={36} height={36} />}
        </span>
      )
    } },
    { key: 'title', header: 'Бүтээгдэхүүн', render: (p) => (
      <span className="font-medium">{copy(p).title ?? p.slug}</span>) },
    { key: 'slug', header: 'Slug', render: (p) => <span className="text-a-muted">{p.slug}</span> },
    { key: 'variants', header: 'Сонголт', render: (p) => `${nodes(p.variantCollection).length}` },
    { key: 'stock', header: 'Үлдэгдэл', align: 'right', render: (p) => {
      const total = nodes(p.variantCollection).reduce((s, v) => s + v.quantity, 0)
      return <span className={`tabular-nums ${total === 0 ? 'text-red-600' : total <= 5 ? 'text-amber-600' : ''}`}>{total}</span>
    } },
    { key: 'price', header: 'Үнэ', align: 'right', render: (p) => (
      <span className="tabular-nums">{formatMnt(p.minPriceMnt)}</span>) },
    { key: 'status', header: 'Төлөв', render: (p) => (
      <Status tone={p.status === 'active' ? 'green' : p.status === 'draft' ? 'amber' : 'grey'}>{p.status}</Status>) },
  ]

  const sel = useSelection(rows)
  const [setStatus] = useMutation(ADMIN_BULK_SET_PRODUCT_STATUS)
  const [setFeatured] = useMutation(ADMIN_BULK_SET_PRODUCT_FEATURED)
  const [setCategory] = useMutation(ADMIN_BULK_SET_PRODUCT_CATEGORY)
  const [bulkDelete] = useMutation(ADMIN_BULK_DELETE_PRODUCTS)
  const [bulkError, setBulkError] = useState(null)

  // Every bulk action funnels through here so the confirm, the error surface
  // and the post-action cleanup are written once.
  const run = async (confirmText, fn) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    const ids = sel.ids
    try {
      await fn(ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(e?.message ?? 'Үйлдэл амжилтгүй боллоо.')
    }
  }

  const n = sel.count
  const bulkActions = [
    { key: 'active', label: 'Нийтлэх (active)',
      run: () => run(`${n} бүтээгдэхүүнийг нийтлэх үү?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'active' } })) },
    { key: 'draft', label: 'Ноорог болгох (draft)',
      run: () => run(`${n} бүтээгдэхүүнийг ноорог болгох уу?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'draft' } })) },
    { key: 'feature', label: 'Онцлох',
      run: () => run(`${n} бүтээгдэхүүнийг онцлох уу?`,
        (ids) => setFeatured({ variables: { productIds: ids, isFeatured: true } })) },
    { key: 'unfeature', label: 'Онцлохоо болих',
      run: () => run(`${n} бүтээгдэхүүний онцлохыг болих уу?`,
        (ids) => setFeatured({ variables: { productIds: ids, isFeatured: false } })) },
    { key: 'category', label: 'Ангилал солих',
      render: (close) => (
        <CategoryPicker
          categories={categories}
          onApply={async (slug) => {
            close()
            await run(`${n} бүтээгдэхүүнийг шилжүүлэх үү?`,
              (ids) => setCategory({ variables: { productIds: ids, categorySlug: slug } }))
          }}
        />
      ) },
    { key: 'archive', label: 'Архивлах', separatorBefore: true,
      run: () => run(`${n} бүтээгдэхүүнийг архивлах уу?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'archived' } })) },
    { key: 'delete', label: 'Бүрмөсөн устгах', tone: 'danger',
      run: async () => {
        // Typed confirmation: archive is one click, deletion should not be.
        const typed = window.prompt(
          `${n} бүтээгдэхүүнийг бүрмөсөн устгана. Захиалгын түүх хэвээр үлдэнэ.\n\n`
          + 'Баталгаажуулахын тулд УСТГАХ гэж бичнэ үү:')
        if (typed !== 'УСТГАХ') return
        setBulkError(null)
        try {
          await bulkDelete({ variables: { productIds: sel.ids } })
          sel.clear()
          await refetch()
        } catch (e) {
          setBulkError(e?.message ?? 'Устгах үед алдаа гарлаа.')
        }
      } },
  ]

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Бараа"
        subtitle={`${products.length} бүтээгдэхүүн · мөр дээр дарж засна`}
        actions={
          <Button variant="primary" onClick={() => router.push('/admin/products/new')}>
            <Plus /> Шинэ бүтээгдэхүүн
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="Бүтээгдэхүүн алга"
          body="Эхний бүтээгдэхүүнээ нэмнэ үү."
          action={
            <Button variant="primary" onClick={() => router.push('/admin/products/new')}>Нэмэх</Button>
          }
        />
      ) : (
        <>
          {bulkError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
              {bulkError}
            </p>
          )}

          <DataTable
            columns={columns}
            rows={rows}
            selection={sel}
            bulkActions={bulkActions}
            onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
            toolbar={<TableToolbar search={search} onSearch={setSearch} placeholder="Нэр, slug" />}
          />
        </>
      )}
    </>
  )
}

function CategoryPicker({ categories, onApply }) {
  const [slug, setSlug] = useState(categories[0]?.slug ?? '')
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-a-ink">Ангилал сонгох</p>
      <Select value={slug} onChange={(e) => setSlug(e.target.value)}>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>
            {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
          </option>
        ))}
      </Select>
      <Button variant="primary" className="w-full" disabled={!slug} onClick={() => onApply(slug)}>
        Шилжүүлэх
      </Button>
    </div>
  )
}
