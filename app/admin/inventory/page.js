'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_ARCHIVE_PRODUCT, ADMIN_BULK_DELETE_PRODUCTS, ADMIN_BULK_SET_PRODUCT_CATEGORY,
  ADMIN_BULK_SET_PRODUCT_FEATURED, ADMIN_BULK_SET_PRODUCT_STATUS, ADMIN_DELETE_VARIANT,
  ADMIN_PRODUCTS, ADMIN_SET_STOCK, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT,
} from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes, toNumber } from '@/lib/format'
import {
  Button, Card, DataTable, EmptyState, Field, Input, PageHeader,
  Select, Status, TableToolbar, Textarea,
} from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import { Plus } from '@/components/admin/icons'

export default function InventoryPage() {
  const { data, loading, refetch } = useQuery(ADMIN_PRODUCTS, { fetchPolicy: 'cache-and-network' })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [expanded, setExpanded] = useState(null)

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
        subtitle={`${products.length} бүтээгдэхүүн · мөр дээр дарж сонголтуудыг харна`}
        actions={<Button variant="primary" onClick={() => setEditing('new')}><Plus /> Шинэ бүтээгдэхүүн</Button>}
      />

      {editing && (
        <div className="mb-4">
          <ProductForm
            product={editing === 'new' ? null : editing}
            categories={categories}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); refetch() }}
          />
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState title="Бүтээгдэхүүн алга" body="Эхний бүтээгдэхүүнээ нэмнэ үү."
          action={<Button variant="primary" onClick={() => setEditing('new')}>Нэмэх</Button>} />
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
            onRowClick={(p) => setExpanded(expanded === p.id ? null : p.id)}
            toolbar={<TableToolbar search={search} onSearch={setSearch} placeholder="Нэр, slug" />}
          />

          {expanded && (
            <div className="mt-4">
              <VariantPanel
                product={products.find((p) => p.id === expanded)}
                onEdit={() => setEditing(products.find((p) => p.id === expanded))}
                onDone={refetch}
                onClose={() => setExpanded(null)}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}

function VariantPanel({ product, onEdit, onDone, onClose }) {
  const [archive] = useMutation(ADMIN_ARCHIVE_PRODUCT)
  const [adding, setAdding] = useState(false)
  if (!product) return null
  const variants = nodes(product.variantCollection)

  return (
    <Card
      title={copy(product).title ?? product.slug}
      subtitle={`${variants.length} сонголт`}
      actions={
        <>
          <Button onClick={onEdit}>Засах</Button>
          <Button onClick={() => setAdding(true)}><Plus /> Сонголт</Button>
          {product.status !== 'archived' && (
            <Button variant="danger" onClick={async () => { await archive({ variables: { productId: product.id } }); onDone() }}>
              Архивлах
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Хаах</Button>
        </>
      }
      padded={false}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-a-line">
            {['SKU', 'Сонголт', 'Үнэ', 'Үлдэгдэл', 'Төлөв', ''].map((h, i) => (
              <th key={h + i} className={`px-6 py-2.5 text-[13px] font-normal text-a-muted ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onDone={onDone} canDelete={variants.length > 1} />
          ))}
        </tbody>
      </table>

      {adding && (
        <div className="border-t border-a-line px-6 py-4">
          <VariantForm productId={product.id} onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); onDone() }} />
        </div>
      )}
    </Card>
  )
}

function VariantRow({ variant, onDone, canDelete }) {
  const [setStock, { loading }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)
  const [qty, setQty] = useState(String(variant.quantity))
  const [error, setError] = useState(null)
  const dirty = String(variant.quantity) !== qty

  return (
    <tr className="border-b border-a-line last:border-0">
      <td className="px-6 py-3 text-[13px] tabular-nums text-a-muted">{variant.sku ?? '—'}</td>
      <td className="px-6 py-3 text-[13px]">{variant.optionValue ?? '—'}</td>
      <td className="px-6 py-3 text-right text-[13px] tabular-nums">{formatMnt(variant.priceMnt)}</td>
      <td className="px-6 py-3 text-right">
        <span className="flex items-center justify-end gap-2">
          <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            className={`w-[72px] text-right tabular-nums ${variant.quantity === 0 ? 'text-red-600' : ''}`} />
          {dirty && (
            <Button variant="primary" size="sm" disabled={loading}
              onClick={async () => {
                setError(null)
                try { await setStock({ variables: { variantId: variant.id, quantity: Number(qty) } }); onDone() }
                catch (e) { setError(e?.message ?? 'Алдаа') }
              }}>
              Хадгалах
            </Button>
          )}
        </span>
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </td>
      <td className="px-6 py-3">
        <Status tone={variant.isActive ? 'green' : 'grey'}>{variant.isActive ? 'идэвхтэй' : 'идэвхгүй'}</Status>
      </td>
      <td className="px-6 py-3 text-right">
        {canDelete && (
          <Button variant="ghost" size="sm"
            onClick={async () => { await removeVariant({ variables: { variantId: variant.id } }); onDone() }}>
            Устгах
          </Button>
        )}
      </td>
    </tr>
  )
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)
  const [addVariant] = useMutation(ADMIN_UPSERT_VARIANT)
  const c = copy(product ?? {})
  const [f, setF] = useState({
    slug: product?.slug ?? '', title: c.title ?? '', subtitle: c.subtitle ?? '',
    description: c.description ?? '', careDetails: c.careDetails ?? '',
    categorySlug: product?.category?.slug ?? categories[0]?.slug ?? '',
    status: product?.status ?? 'draft', isFeatured: product?.isFeatured ?? false,
    priceMnt: '', quantity: '0',
  })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Card title={product ? 'Бүтээгдэхүүн засах' : 'Шинэ бүтээгдэхүүн'}>
      <form className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault(); setError(null)
          try {
            const res = await save({ variables: {
              slug: f.slug.trim(), title: f.title.trim(), categorySlug: f.categorySlug || null,
              subtitle: f.subtitle || null, description: f.description || null,
              careDetails: f.careDetails || null, status: f.status, isFeatured: f.isFeatured,
              sortOrder: 0, productId: product?.id ?? null } })
            if (!product && f.priceMnt) {
              await addVariant({ variables: {
                productId: res.data.adminUpsertProduct.id, priceMnt: String(toNumber(f.priceMnt)),
                quantity: Number(f.quantity || 0), sku: null, optionLabel: null, optionValue: null,
                compareAtPriceMnt: null, allowBackorder: false, isActive: true, sortOrder: 0, variantId: null } })
            }
            onSaved()
          } catch (e) { setError(e?.message ?? 'Хадгалахад алдаа гарлаа.') }
        }}>
        <Field label="Нэр" required><Input required value={f.title} onChange={set('title')} /></Field>
        <Field label="Slug" required hint="URL дээр харагдана">
          <Input required value={f.slug} onChange={set('slug')} placeholder="woven-shoulder-bag" />
        </Field>
        <Field label="Дэд гарчиг"><Input value={f.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Ангилал">
          <Select value={f.categorySlug} onChange={set('categorySlug')}>
            <option value="">—</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Тайлбар"><Textarea rows={3} value={f.description} onChange={set('description')} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Арчилгаа"><Textarea rows={2} value={f.careDetails} onChange={set('careDetails')} /></Field>
        </div>
        <Field label="Төлөв">
          <Select value={f.status} onChange={set('status')}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input type="checkbox" checked={f.isFeatured}
            onChange={(e) => setF({ ...f, isFeatured: e.target.checked })} className="h-4 w-4 accent-black" />
          Онцлох
        </label>

        {!product && (
          <>
            <Field label="Үнэ (₮)" required hint="Эхний сонголт үүснэ">
              <Input required value={f.priceMnt}
                onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Үлдэгдэл">
              <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
            </Field>
          </>
        )}

        {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
          <Button type="button" onClick={onClose}>Болих</Button>
        </div>
      </form>
    </Card>
  )
}

function VariantForm({ productId, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [f, setF] = useState({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <form className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault(); setError(null)
        try {
          await save({ variables: {
            productId, priceMnt: String(toNumber(f.priceMnt)), quantity: Number(f.quantity || 0),
            sku: f.sku || null, optionLabel: f.optionValue ? f.optionLabel : null,
            optionValue: f.optionValue || null, compareAtPriceMnt: null,
            allowBackorder: false, isActive: true, sortOrder: 0, variantId: null } })
          onSaved()
        } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
      }}>
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Cream" /></Field>
      <Field label="Үнэ (₮)">
        <Input required value={f.priceMnt} onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label="Үлдэгдэл">
        <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
      </Field>
      {error && <p className="text-[13px] text-red-600 sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" variant="primary" disabled={loading}>Нэмэх</Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
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
