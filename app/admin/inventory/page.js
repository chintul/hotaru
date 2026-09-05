'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_ARCHIVE_PRODUCT, ADMIN_DELETE_VARIANT, ADMIN_PRODUCTS,
  ADMIN_SET_STOCK, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT,
} from '@/lib/queries'
import { copy, firstNode, formatMnt, nodes, toNumber } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Table, Td, Tr } from '@/components/admin/ui'

export default function InventoryPage() {
  const { data, loading, refetch } = useQuery(ADMIN_PRODUCTS, { fetchPolicy: 'cache-and-network' })
  const [editing, setEditing] = useState(null)   // product object, or 'new'
  const products = nodes(data?.productCollection)
  const categories = nodes(data?.categoryCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  const lowStock = products.flatMap((p) => nodes(p.variantCollection)).filter((v) => v.quantity <= 3).length

  return (
    <>
      <PageHeader
        title="Бараа"
        description={`${data?.productCollection?.totalCount ?? 0} бүтээгдэхүүн · ${lowStock} сонголтын үлдэгдэл бага`}
        action={<Button onClick={() => setEditing('new')}>Шинэ бүтээгдэхүүн</Button>}
      />

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch() }}
        />
      )}

      {products.length === 0 ? (
        <EmptyState title="Бүтээгдэхүүн алга" body="Эхний бүтээгдэхүүнээ нэмнэ үү." />
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} onEdit={() => setEditing(p)} onDone={refetch} />
          ))}
        </div>
      )}
    </>
  )
}

function ProductRow({ product, onEdit, onDone }) {
  const [archive] = useMutation(ADMIN_ARCHIVE_PRODUCT)
  const [addingVariant, setAddingVariant] = useState(false)
  const variants = nodes(product.variantCollection)
  const c = copy(product)

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {c.title ?? product.slug}
          <span className="text-[12px] font-normal text-a-muted">{product.slug}</span>
          <Badge tone={product.status === 'active' ? 'green' : 'neutral'}>{product.status}</Badge>
          {product.isFeatured && <Badge tone="blue">онцлох</Badge>}
        </span>
      }
      action={
        <span className="flex gap-2">
          <Button variant="secondary" onClick={onEdit}>Засах</Button>
          <Button variant="secondary" onClick={() => setAddingVariant(true)}>Сонголт нэмэх</Button>
          {product.status !== 'archived' && (
            <Button
              variant="danger"
              onClick={async () => { await archive({ variables: { productId: product.id } }); onDone() }}
            >
              Архивлах
            </Button>
          )}
        </span>
      }
    >
      <Table head={['SKU', 'Сонголт', { label: 'Үнэ', align: 'right' }, { label: 'Үлдэгдэл', align: 'right' }, 'Идэвхтэй', { label: '', align: 'right' }]}>
        {variants.map((v) => (
          <VariantRow key={v.id} variant={v} productId={product.id} onDone={onDone} canDelete={variants.length > 1} />
        ))}
      </Table>

      {addingVariant && (
        <div className="mt-4 border-t border-a-line pt-4">
          <VariantForm
            productId={product.id}
            onClose={() => setAddingVariant(false)}
            onSaved={() => { setAddingVariant(false); onDone() }}
          />
        </div>
      )}
    </Card>
  )
}

function VariantRow({ variant, productId, onDone, canDelete }) {
  const [setStock, { loading: saving }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)
  const [qty, setQty] = useState(String(variant.quantity))
  const [error, setError] = useState(null)
  const dirty = String(variant.quantity) !== qty

  return (
    <Tr>
      <Td className="tabular-nums text-a-muted">{variant.sku ?? '—'}</Td>
      <Td className="text-a-muted">{variant.optionValue ?? '—'}</Td>
      <Td align="right" className="tabular-nums">{formatMnt(variant.priceMnt)}</Td>
      <Td align="right">
        <span className="flex items-center justify-end gap-2">
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            className={`w-[70px] text-right tabular-nums ${variant.quantity === 0 ? 'text-red-600' : ''}`}
          />
          {dirty && (
            <Button
              disabled={saving}
              onClick={async () => {
                setError(null)
                try {
                  await setStock({ variables: { variantId: variant.id, quantity: Number(qty) } })
                  onDone()
                } catch (e) { setError(e?.message ?? 'Алдаа'); }
              }}
            >
              Хадгалах
            </Button>
          )}
        </span>
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </Td>
      <Td>{variant.isActive ? <Badge tone="green">тийм</Badge> : <Badge>үгүй</Badge>}</Td>
      <Td align="right">
        {canDelete && (
          <Button
            variant="ghost"
            onClick={async () => { await removeVariant({ variables: { variantId: variant.id } }); onDone() }}
          >
            Устгах
          </Button>
        )}
      </Td>
    </Tr>
  )
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)
  const [addVariant] = useMutation(ADMIN_UPSERT_VARIANT)
  const c = copy(product ?? {})
  const [form, setForm] = useState({
    slug: product?.slug ?? '',
    title: c.title ?? '',
    subtitle: c.subtitle ?? '',
    description: c.description ?? '',
    careDetails: c.careDetails ?? '',
    categorySlug: product?.category?.slug ?? categories[0]?.slug ?? '',
    status: product?.status ?? 'draft',
    isFeatured: product?.isFeatured ?? false,
    // A brand-new product needs a sellable unit or it cannot be bought.
    priceMnt: '',
    quantity: '0',
  })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <Card title={product ? 'Бүтээгдэхүүн засах' : 'Шинэ бүтээгдэхүүн'} className="mb-6">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          try {
            const res = await save({
              variables: {
                slug: form.slug.trim(),
                title: form.title.trim(),
                categorySlug: form.categorySlug || null,
                subtitle: form.subtitle || null,
                description: form.description || null,
                careDetails: form.careDetails || null,
                status: form.status,
                isFeatured: form.isFeatured,
                sortOrder: 0,
                productId: product?.id ?? null,
              },
            })
            // Creating a product without a variant leaves it unbuyable, so the
            // first price/stock is part of the same submit.
            if (!product && form.priceMnt) {
              await addVariant({
                variables: {
                  productId: res.data.adminUpsertProduct.id,
                  priceMnt: String(toNumber(form.priceMnt)),
                  quantity: Number(form.quantity || 0),
                  sku: null, optionLabel: null, optionValue: null,
                  compareAtPriceMnt: null, allowBackorder: false, isActive: true, sortOrder: 0,
                  variantId: null,
                },
              })
            }
            onSaved()
          } catch (e) { setError(e?.message ?? 'Хадгалахад алдаа гарлаа.') }
        }}
      >
        <Field label="Нэр *"><Input required value={form.title} onChange={set('title')} /></Field>
        <Field label="Slug *" hint="URL дээр харагдана">
          <Input required value={form.slug} onChange={set('slug')} placeholder="woven-shoulder-bag" />
        </Field>
        <Field label="Дэд гарчиг"><Input value={form.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Ангилал">
          <select value={form.categorySlug} onChange={set('categorySlug')}
            className="w-full rounded-md border border-a-line bg-white px-3 py-2 text-[13px]">
            <option value="">—</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Тайлбар">
            <textarea value={form.description} onChange={set('description')} rows={3}
              className="w-full rounded-md border border-a-line px-3 py-2 text-[13px] focus:border-a-focus focus:outline-none" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Арчилгаа">
            <textarea value={form.careDetails} onChange={set('careDetails')} rows={2}
              className="w-full rounded-md border border-a-line px-3 py-2 text-[13px] focus:border-a-focus focus:outline-none" />
          </Field>
        </div>
        <Field label="Төлөв">
          <select value={form.status} onChange={set('status')}
            className="w-full rounded-md border border-a-line bg-white px-3 py-2 text-[13px]">
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input type="checkbox" checked={form.isFeatured}
            onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="h-4 w-4 accent-black" />
          Онцлох
        </label>

        {!product && (
          <>
            <Field label="Үнэ (₮) *" hint="Эхний сонголт үүснэ">
              <Input required value={form.priceMnt}
                onChange={(e) => setForm({ ...form, priceMnt: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="Үлдэгдэл">
              <Input value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value.replace(/\D/g, '') })} />
            </Field>
          </>
        )}

        {error && <p className="sm:col-span-2 text-[13px] text-red-600">{error}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={loading}>{loading ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Болих</Button>
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
    <form
      className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        try {
          await save({
            variables: {
              productId, priceMnt: String(toNumber(f.priceMnt)), quantity: Number(f.quantity || 0),
              sku: f.sku || null, optionLabel: f.optionValue ? f.optionLabel : null,
              optionValue: f.optionValue || null, compareAtPriceMnt: null,
              allowBackorder: false, isActive: true, sortOrder: 0, variantId: null,
            },
          })
          onSaved()
        } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
      }}
    >
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Cream" /></Field>
      <Field label="Үнэ (₮)">
        <Input required value={f.priceMnt} onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label="Үлдэгдэл">
        <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
      </Field>
      {error && <p className="sm:col-span-5 text-[13px] text-red-600">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" disabled={loading}>Нэмэх</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}
