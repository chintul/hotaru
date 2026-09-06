'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCTS, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { firstNode, nodes, toNumber } from '@/lib/format'
import { slugify } from '@/lib/slug'
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/admin/ui'

/**
 * A short create form rather than the editor with three tabs greyed out.
 *
 * Images need a product_id and a product needs a price to be sellable, so the
 * honest shape is: collect the minimum, create, then drop the operator inside
 * the editor on the images tab — the step that was impossible before.
 */
export default function NewProductPage() {
  const router = useRouter()
  const { data } = useQuery(ADMIN_PRODUCTS, { fetchPolicy: 'cache-first' })
  const categories = nodes(data?.categoryCollection)

  const [f, setF] = useState({
    title: '', slug: '', categorySlug: '', priceMnt: '', quantity: '0', status: 'draft',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState(null)

  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)
  const [addVariant] = useMutation(ADMIN_UPSERT_VARIANT)

  // The slug tracks the title until the operator takes it over.
  const onTitle = (e) => {
    const title = e.target.value
    setF((cur) => ({ ...cur, title, slug: slugTouched ? cur.slug : slugify(title) }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await save({ variables: {
        slug: f.slug.trim(),
        title: f.title.trim(),
        categorySlug: f.categorySlug || null,
        subtitle: null,
        description: null,
        careDetails: null,
        status: f.status,
        isFeatured: false,
        sortOrder: 0,
        productId: null,
        seoTitle: null,
        seoDescription: null,
      } })

      const id = res.data.adminUpsertProduct.id

      await addVariant({ variables: {
        productId: id,
        priceMnt: String(toNumber(f.priceMnt)),
        quantity: Number(f.quantity || 0),
        sku: null,
        optionLabel: null,
        optionValue: null,
        compareAtPriceMnt: null,
        allowBackorder: false,
        isActive: true,
        sortOrder: 0,
        variantId: null,
      } })

      router.replace(`/admin/products/${id}?tab=images`)
    } catch (err) {
      setError(err?.message ?? 'Үүсгэхэд алдаа гарлаа.')
    }
  }

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-[13px] text-a-muted hover:text-a-ink">
        ← Бараа
      </Link>
      <PageHeader
        title="Шинэ бүтээгдэхүүн"
        subtitle="Үүсгэсний дараа зураг, сонголт, SEO-г нэмнэ."
      />

      <Card title="Үндсэн мэдээлэл">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Нэр" required>
            <Input required value={f.title} onChange={onTitle} placeholder="Нэхмэл мөрний цүнх" />
          </Field>
          <Field label="Slug" required hint="Нэрнээс автоматаар үүснэ">
            <Input
              required
              value={f.slug}
              onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value }) }}
            />
          </Field>
          <Field label="Ангилал">
            <Select value={f.categorySlug} onChange={(e) => setF({ ...f, categorySlug: e.target.value })}>
              <option value="">—</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Төлөв">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="active">active</option>
            </Select>
          </Field>
          <Field label="Үнэ (₮)" required hint="Эхний сонголт үүснэ">
            <Input
              required
              value={f.priceMnt}
              onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
          <Field label="Үлдэгдэл">
            <Input
              value={f.quantity}
              onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })}
            />
          </Field>

          {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Үүсгэж байна…' : 'Үүсгээд зураг нэмэх'}
            </Button>
            <Button type="button" onClick={() => router.push('/admin/products')}>Болих</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
