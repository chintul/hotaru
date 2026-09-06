'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy } from '@/lib/format'
import { Button, Card, Field, Input, Textarea } from '@/components/admin/ui'

export default function SeoTab({ product, refetch }) {
  const c = copy(product)
  const initial = { seoTitle: c.seoTitle ?? '', seoDescription: c.seoDescription ?? '' }
  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = f.seoTitle !== initial.seoTitle || f.seoDescription !== initial.seoDescription

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      // The whole product goes back, because admin_upsert_product upserts the
      // translation row — sending SEO alone would blank the rest of the copy.
      await save({ variables: {
        productId: product.id,
        slug: product.slug,
        title: c.title ?? product.slug,
        categorySlug: product.category?.slug ?? null,
        subtitle: c.subtitle ?? null,
        description: c.description ?? null,
        careDetails: c.careDetails ?? null,
        status: product.status,
        isFeatured: product.isFeatured,
        sortOrder: product.position ?? 0,
        seoTitle: f.seoTitle.trim() || null,
        seoDescription: f.seoDescription.trim() || null,
      } })
      setSaved(true)
      await refetch()
    } catch (err) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  const shownTitle = f.seoTitle || c.title || product.slug
  const shownDesc = f.seoDescription || c.description || ''

  return (
    <Card
      title="SEO"
      subtitle="Хоосон бол бүтээгдэхүүний нэр, тайлбарыг ашиглана."
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-emerald-600">Хадгалсан</span>}
          <Button form="seo-form" type="submit" variant="primary" disabled={!dirty || loading}>
            {loading ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form id="seo-form" className="grid gap-4" onSubmit={onSubmit}>
        <Field label="SEO гарчиг" hint={`${f.seoTitle.length}/60 тэмдэгт`}>
          <Input
            value={f.seoTitle}
            onChange={(e) => { setSaved(false); setF({ ...f, seoTitle: e.target.value }) }}
          />
        </Field>
        <Field label="SEO тайлбар" hint={`${f.seoDescription.length}/160 тэмдэгт`}>
          <Textarea
            rows={3}
            value={f.seoDescription}
            onChange={(e) => { setSaved(false); setF({ ...f, seoDescription: e.target.value }) }}
          />
        </Field>

        <div className="rounded-lg border border-a-line bg-a-bg px-4 py-3">
          <p className="mb-2 text-[12px] font-medium text-a-muted">Хайлтад ийм харагдана</p>
          <p className="truncate text-[16px] text-blue-800">{shownTitle}</p>
          <p className="text-[12px] text-emerald-700">hotaru.mn/shop/{product.slug}</p>
          <p className="line-clamp-2 text-[13px] text-a-muted">{shownDesc}</p>
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}
      </form>
    </Card>
  )
}
