'use client'

import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { copy, firstNode } from '@/lib/format'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/admin/ui'
import { errorMessage } from '@/lib/errors'
import { UPSERT_PRODUCT } from './documents'
import type { EditorCategory, EditorProduct, Refetch } from './types'

export interface ProductFormProps {
  product: EditorProduct
  categories: readonly EditorCategory[]
  refetch: Refetch
}

interface ProductFields {
  slug: string
  title: string
  subtitle: string
  description: string
  careDetails: string
  categorySlug: string
  status: string
  isFeatured: boolean
  seoTitle: string
  seoDescription: string
}

type TextField = Exclude<keyof ProductFields, 'isFeatured'>

const FIELD_NAMES: readonly (keyof ProductFields)[] = [
  'slug', 'title', 'subtitle', 'description', 'careDetails',
  'categorySlug', 'status', 'isFeatured', 'seoTitle', 'seoDescription',
]

type TextControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export default function ProductForm({ product, categories, refetch }: ProductFormProps) {
  const c = copy(product)
  const initial: ProductFields = {
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

  const [f, setF] = useState<ProductFields>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(UPSERT_PRODUCT)

  const dirty = FIELD_NAMES.some((k) => f[k] !== initial[k])
  const set = (k: TextField) => (e: ChangeEvent<TextControl>) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
      setError(errorMessage(err, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  const previewTitle = f.seoTitle || f.title || product.slug
  const previewDescription = f.seoDescription || f.description || ''

  return (
    <Card
      title="Мэдээлэл"
      stickyHeader
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-success-ink">Хадгалсан</span>}
          {dirty && <span className="text-[12px] text-warn-ink">Хадгалаагүй өөрчлөлт</span>}
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
            className="h-4 w-4 accent-primary-strong"
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
          <p className="truncate text-[16px] text-info-ink">{previewTitle}</p>
          <p className="text-[12px] text-success-ink">hotaru.mn/shop/{product.slug}</p>
          <p className="line-clamp-2 text-[13px] text-a-muted">{previewDescription}</p>
        </div>

        {error && <p className="text-[13px] text-danger-ink sm:col-span-2">{error}</p>}
      </form>
    </Card>
  )
}
