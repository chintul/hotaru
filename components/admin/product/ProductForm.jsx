'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy, firstNode } from '@/lib/format'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/admin/ui'

/**
 * Details and SEO, in one form, over the one mutation they share.
 *
 * They used to be two tabs. `admin_upsert_product` upserts the translation row
 * as a whole, so the SEO tab had to re-send `description` read from the Apollo
 * cache (SeoTab.jsx:23-31) — and saving SEO after editing details clobbered the
 * description with a stale copy. One form has no second copy to go stale.
 *
 * No slug auto-fill here on purpose: an existing product's slug is a live URL,
 * and re-deriving it from an edited title would silently break links. That
 * belongs to the create form alone.
 */
export default function ProductForm({ product, categories, refetch }) {
  const c = copy(product)
  const initial = {
    slug: product.slug ?? '',
    title: c.title ?? '',
    subtitle: c.subtitle ?? '',
    description: c.description ?? '',
    careDetails: c.careDetails ?? '',
    categorySlug: product.category?.slug ?? '',
    status: product.status ?? 'draft',
    isFeatured: product.isFeatured ?? false,
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
  }

  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }

  // This is the only part of the editor that does not apply immediately, so
  // leaving it dirty is the only way to lose work here.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await save({ variables: {
        productId: product.id,
        slug: f.slug.trim(),
        title: f.title.trim(),
        categorySlug: f.categorySlug || null,
        subtitle: f.subtitle || null,
        description: f.description || null,
        careDetails: f.careDetails || null,
        status: f.status,
        isFeatured: f.isFeatured,
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

  // The preview reads live form state, not the cache, so it tracks what the
  // storefront will actually fall back to once this form is saved.
  const shownTitle = f.seoTitle || f.title || product.slug
  const shownDesc = f.seoDescription || f.description || ''

  return (
    <Card
      title="Мэдээлэл"
      stickyHeader
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-emerald-600">Хадгалсан</span>}
          {dirty && <span className="text-[12px] text-amber-600">Хадгалаагүй өөрчлөлт</span>}
          <Button form="product-form" type="submit" variant="primary" disabled={!dirty || loading}>
            {loading ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form id="product-form" className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Нэр" required><Input required value={f.title} onChange={set('title')} /></Field>
        <Field label="Slug" required hint="URL дээр харагдана">
          <Input required value={f.slug} onChange={set('slug')} />
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
          <Field label="Тайлбар"><Textarea rows={4} value={f.description} onChange={set('description')} /></Field>
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
          <input
            type="checkbox"
            checked={f.isFeatured}
            onChange={(e) => { setSaved(false); setF({ ...f, isFeatured: e.target.checked }) }}
            className="h-4 w-4 accent-black"
          />
          Онцлох
        </label>

        <div className="border-t border-a-line pt-4 sm:col-span-2">
          <h3 className="text-[13px] font-semibold text-a-ink">SEO</h3>
          <p className="mt-0.5 text-[12px] text-a-muted">Хоосон бол дээрх нэр, тайлбарыг ашиглана.</p>
        </div>
        <Field label="SEO гарчиг" hint={`${f.seoTitle.length}/60 тэмдэгт`}>
          <Input value={f.seoTitle} onChange={set('seoTitle')} />
        </Field>
        <Field label="SEO тайлбар" hint={`${f.seoDescription.length}/160 тэмдэгт`}>
          <Input value={f.seoDescription} onChange={set('seoDescription')} />
        </Field>
        <div className="rounded-lg border border-a-line bg-a-bg px-4 py-3 sm:col-span-2">
          <p className="mb-2 text-[12px] font-medium text-a-muted">Хайлтад ийм харагдана</p>
          <p className="truncate text-[16px] text-blue-800">{shownTitle}</p>
          <p className="text-[12px] text-emerald-700">hotaru.mn/shop/{product.slug}</p>
          <p className="line-clamp-2 text-[13px] text-a-muted">{shownDesc}</p>
        </div>

        {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Card>
  )
}
