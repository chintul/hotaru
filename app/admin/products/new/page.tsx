'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCTS, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { firstNode, nodes, toNumber } from '@/lib/format'
import { slugify } from '@/lib/slug'
import type { Category, Connection } from '@/lib/types'
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/admin/ui'
import { errorMessage } from '@/lib/errors'

interface ProductDraft {
  title: string
  slug: string
  categorySlug: string
  priceMnt: string
  quantity: string
  status: string
}

interface CategoriesData {
  categoryCollection: Connection<Category> | null
}

interface UpsertProductData {
  adminUpsertProduct: { id: string }
}

interface UpsertProductVars {
  slug: string
  title: string
  categorySlug: string | null
  subtitle: string | null
  description: string | null
  careDetails: string | null
  status: string
  isFeatured: boolean
  sortOrder: number
  productId: string | null
  seoTitle: string | null
  seoDescription: string | null
}

interface UpsertVariantVars {
  productId: string
  priceMnt: string
  quantity: number
  sku: string | null
  optionLabel: string | null
  optionValue: string | null
  compareAtPriceMnt: string | null
  allowBackorder: boolean
  isActive: boolean
  sortOrder: number
  variantId: string | null
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

export default function NewProductPage() {
  const router = useRouter()
  const { data } = useQuery<CategoriesData>(ADMIN_PRODUCTS, { fetchPolicy: 'cache-first' })
  const categories = nodes(data?.categoryCollection)

  const [f, setF] = useState<ProductDraft>({
    title: '', slug: '', categorySlug: '', priceMnt: '', quantity: '0', status: 'draft',
  })
  const [slugFollowsTitle, setSlugFollowsTitle] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [save, { loading }] = useMutation<UpsertProductData, UpsertProductVars>(ADMIN_UPSERT_PRODUCT)
  const [addVariant] = useMutation<unknown, UpsertVariantVars>(ADMIN_UPSERT_VARIANT)

  const onTitle = (e: ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setF((cur) => ({ ...cur, title, slug: slugFollowsTitle ? slugify(title) : cur.slug }))
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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

      const id = res.data?.adminUpsertProduct.id
      if (!id) throw new Error('Үүсгэхэд алдаа гарлаа.')

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

      router.replace(`/admin/products/${id}`)
    } catch (err) {
      setError(errorMessage(err, 'Үүсгэхэд алдаа гарлаа.'))
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
              onChange={(e) => { setSlugFollowsTitle(false); setF({ ...f, slug: e.target.value }) }}
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
              onChange={(e) => setF({ ...f, priceMnt: digitsOnly(e.target.value) })}
            />
          </Field>
          <Field label="Үлдэгдэл">
            <Input
              value={f.quantity}
              onChange={(e) => setF({ ...f, quantity: digitsOnly(e.target.value) })}
            />
          </Field>

          {error && <p className="text-[13px] text-danger-ink sm:col-span-2">{error}</p>}
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
