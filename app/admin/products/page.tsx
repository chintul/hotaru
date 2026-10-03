'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_PRODUCTS, ADMIN_BULK_SET_PRODUCT_CATEGORY,
  ADMIN_BULK_SET_PRODUCT_FEATURED, ADMIN_BULK_SET_PRODUCT_STATUS, ADMIN_PRODUCTS,
} from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes } from '@/lib/format'
import type { Category, Connection, Product } from '@/lib/types'
import {
  Button, DataTable, EmptyState, PageHeader, Select, Status, TableToolbar,
  type BulkAction, type Column, type Tone,
} from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import { useConfirm } from '@/components/admin/confirm'
import ProductImage from '@/components/ProductImage'
import { Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import { PreorderBadge } from '@/components/admin/product/PreorderToggle'
import SaleBadge from '@/components/admin/product/SaleBadge'
import { maxSalePct } from '@/components/admin/product/saleBatch'

const LOW_STOCK = 5
const DELETE_CONFIRMATION_WORD = 'УСТГАХ'

type AdminProduct = Product & { id: string }

interface AdminProductsData {
  productCollection: Connection<AdminProduct> | null
  categoryCollection: Connection<Category> | null
}

const statusTone = (status: Product['status']): Tone =>
  status === 'active' ? 'green' : status === 'draft' ? 'amber' : 'grey'

const stockClass = (total: number) =>
  total === 0 ? 'text-danger-ink' : total <= LOW_STOCK ? 'text-warn-ink' : ''

export default function ProductsPage() {
  const router = useRouter()
  const { data, loading, refetch } = useQuery<AdminProductsData>(ADMIN_PRODUCTS, { fetchPolicy: 'cache-and-network' })
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

  const columns: Column<AdminProduct>[] = [
    { key: 'image', header: '', render: (p) => {
      const img = firstNode(p.productImageCollection)
      return (
        <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-md bg-a-hover">
          {img && <ProductImage filePath={img.filePath} alt="" seed={p.id} width={36} height={36} />}
        </span>
      )
    } },
    { key: 'title', header: 'Бүтээгдэхүүн', render: (p) => (
      <span className="line-clamp-2 font-medium [overflow-wrap:anywhere]">{copy(p).title ?? p.slug}</span>) },
    { key: 'variants', header: 'Сонголт', render: (p) => `${nodes(p.variantCollection).length}` },
    { key: 'stock', header: 'Үлдэгдэл', align: 'right', render: (p) => {
      const variants = nodes(p.variantCollection)
      const total = variants.reduce((s, v) => s + (v.quantity ?? 0), 0)
      const preorder = variants.some((v) => v.allowBackorder)
      return (
        <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {preorder && <PreorderBadge />}
          <span className={`tabular-nums ${preorder ? '' : stockClass(total)}`}>{total}</span>
        </span>
      )
    } },
    { key: 'price', header: 'Үнэ', align: 'right', render: (p) => {
      const pct = maxSalePct(nodes(p.variantCollection))
      return (
        <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {pct > 0 && <SaleBadge pct={pct} labelled />}
          <span className="tabular-nums">{formatMnt(p.minPriceMnt)}</span>
        </span>
      )
    } },
    { key: 'status', header: 'Төлөв', render: (p) => (
      <Status tone={statusTone(p.status)}>{p.status}</Status>) },
  ]

  const sel = useSelection(rows)
  const [setStatus] = useMutation<unknown, { productIds: string[]; status: string }>(ADMIN_BULK_SET_PRODUCT_STATUS)
  const [setFeatured] = useMutation<unknown, { productIds: string[]; isFeatured: boolean }>(ADMIN_BULK_SET_PRODUCT_FEATURED)
  const [setCategory] = useMutation<unknown, { productIds: string[]; categorySlug: string }>(ADMIN_BULK_SET_PRODUCT_CATEGORY)
  const [bulkDelete] = useMutation<unknown, { productIds: string[] }>(ADMIN_BULK_DELETE_PRODUCTS)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const confirm = useConfirm()
  const n = sel.count

  const run = async (confirmText: string, fn: (ids: string[]) => Promise<unknown>) => {
    if (!(await confirm({ title: confirmText }))) return
    setBulkError(null)
    const ids = sel.ids
    try {
      await fn(ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(errorMessage(e, 'Үйлдэл амжилтгүй боллоо.'))
    }
  }

  const deletePermanently = async () => {
    const ok = await confirm({
      title: `${n} бүтээгдэхүүнийг бүрмөсөн устгана. Захиалгын түүх хэвээр үлдэнэ.`,
      description: `Баталгаажуулахын тулд ${DELETE_CONFIRMATION_WORD} гэж бичнэ үү:`,
      typeToConfirm: DELETE_CONFIRMATION_WORD,
      confirmLabel: 'Бүрмөсөн устгах',
      destructive: true,
    })
    if (!ok) return
    setBulkError(null)
    try {
      await bulkDelete({ variables: { productIds: sel.ids } })
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(errorMessage(e, 'Устгах үед алдаа гарлаа.'))
    }
  }

  const bulkActions: BulkAction[] = [
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
    { key: 'delete', label: 'Бүрмөсөн устгах', tone: 'danger', run: deletePermanently },
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
            <p className="mb-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] text-danger-ink">
              {bulkError}
            </p>
          )}

          <DataTable
            columns={columns}
            rows={rows}
            selection={sel}
            bulkActions={bulkActions}
            onRowClick={(p: AdminProduct) => router.push(`/admin/products/${p.id}`)}
            toolbar={<TableToolbar search={search} onSearch={setSearch} placeholder="Нэр, slug" />}
          />
        </>
      )}
    </>
  )
}

interface CategoryPickerProps {
  categories: Category[]
  onApply: (slug: string) => void
}

function CategoryPicker({ categories, onApply }: CategoryPickerProps) {
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
