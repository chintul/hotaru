'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy, firstNode } from '@/lib/format'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/admin/ui'

/**
 * Form-shaped, so it saves explicitly. Variants and images apply immediately
 * because they already have their own per-row mutations; a Save button over
 * them would claim a transaction that does not exist.
 *
 * No slug auto-fill here on purpose: an existing product's slug is a live URL,
 * and re-deriving it from an edited title would silently break links. That
 * belongs to the create form alone.
 */
export default function DetailsTab({ product, categories, refetch }) {
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
  }

  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }

  // Leaving with unsaved edits loses them, and this tab is the only one that
  // does not apply immediately — so it has to say so.
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
        // Omitted on purpose. The SQL coalesces null to the stored value, so
        // saving details never wipes SEO copy written on the other tab.
        seoTitle: null,
        seoDescription: null,
      } })
      setSaved(true)
      await refetch()
    } catch (err) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  return (
    <Card
      title="Мэдээлэл"
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-emerald-600">Хадгалсан</span>}
          {dirty && <span className="text-[12px] text-amber-600">Хадгалаагүй өөрчлөлт</span>}
          <Button form="details-form" type="submit" variant="primary" disabled={!dirty || loading}>
            {loading ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form id="details-form" className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
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
        {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Card>
  )
}
