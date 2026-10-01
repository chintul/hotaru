'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_CATEGORIES, ADMIN_UPSERT_CATEGORY } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import { slugify } from '@/lib/slug'
import { errorMessage } from '@/lib/errors'
import type { Category, Connection } from '@/lib/types'
import {
  Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Select, Status, Textarea,
  type Column,
} from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type CategoryRow = Category & { id: string }

interface CategoriesData {
  categoryCollection: Connection<CategoryRow> | null
}

interface UpsertCategoryVars {
  slug: string
  name: string
  description: string | null
  parentSlug: string | null
  isVisible: boolean
  sortOrder: number
  categoryId: string | null
}

interface CategoryDraft {
  id: string | null
  name: string
  slug: string
  slugTouched: boolean
  description: string
  parentSlug: string
  sortOrder: string
  isVisible: boolean
}

const EMPTY_DRAFT: CategoryDraft = {
  id: null, name: '', slug: '', slugTouched: false, description: '', parentSlug: '', sortOrder: '0', isVisible: true,
}

const nameOf = (c: Category) => firstNode(c.categoryTranslationCollection)?.name ?? c.slug

function draftFrom(c: CategoryRow): CategoryDraft {
  const copy = firstNode(c.categoryTranslationCollection)
  return {
    id: c.id,
    name: copy?.name ?? '',
    slug: c.slug,
    slugTouched: true,
    description: copy?.description ?? '',
    parentSlug: c.parent?.slug ?? '',
    sortOrder: String(c.position ?? 0),
    isVisible: c.isVisible ?? true,
  }
}

function friendlyError(e: unknown): string {
  const message = errorMessage(e, '')
  if (message.includes('duplicate key') || message.includes('categories_slug_key')) {
    return 'Ийм slug-тай ангилал аль хэдийн байна.'
  }
  if (message.includes('own parent')) return 'Ангилал өөрийгөө эцэг болгож болохгүй.'
  return message || 'Хадгалахад алдаа гарлаа.'
}

export default function CategoriesPage() {
  const { data, loading, refetch } = useQuery<CategoriesData>(ADMIN_CATEGORIES, { fetchPolicy: 'cache-and-network' })
  const [save, { loading: saving }] = useMutation<unknown, UpsertCategoryVars>(ADMIN_UPSERT_CATEGORY)
  const [draft, setDraft] = useState<CategoryDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const categories = nodes(data?.categoryCollection)

  const openNew = () => { setError(null); setDraft(EMPTY_DRAFT) }
  const openEdit = (c: CategoryRow) => { setError(null); setDraft(draftFrom(c)) }
  const close = () => { setDraft(null); setError(null) }

  const columns: Column<CategoryRow>[] = [
    { key: 'name', header: 'Нэр', render: (c) => <span className="font-medium">{nameOf(c)}</span> },
    { key: 'slug', header: 'Slug', render: (c) => <span className="text-a-muted">{c.slug}</span> },
    { key: 'parent', header: 'Эцэг ангилал', render: (c) => (
      <span className="text-a-muted">{c.parent ? nameOf(categories.find((p) => p.id === c.parent?.id) ?? c.parent) : '—'}</span>) },
    { key: 'products', header: 'Бараа', align: 'right', render: (c) => (
      <span className="tabular-nums">{c.productCollection?.totalCount ?? 0}</span>) },
    { key: 'position', header: 'Эрэмбэ', align: 'right', render: (c) => (
      <span className="tabular-nums text-a-muted">{c.position ?? 0}</span>) },
    { key: 'visible', header: 'Төлөв', render: (c) => (
      <Status tone={c.isVisible ? 'green' : 'grey'}>{c.isVisible ? 'харагдана' : 'нуусан'}</Status>) },
    { key: 'action', header: '', align: 'right', render: (c) => (
      <Button size="sm" onClick={() => openEdit(c)}>Засах</Button>) },
  ]

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!draft) return
    setError(null)
    try {
      await save({ variables: {
        slug: draft.slug.trim(),
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        parentSlug: draft.parentSlug || null,
        isVisible: draft.isVisible,
        sortOrder: Number(draft.sortOrder) || 0,
        categoryId: draft.id,
      } })
      close()
      await refetch()
    } catch (err) { setError(friendlyError(err)) }
  }

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  const parentOptions = categories.filter((c) => c.id !== draft?.id)

  return (
    <>
      <PageHeader
        title="Ангилал"
        subtitle="Бараагүй ангилал дэлгүүрийн цэсэнд харагдахгүй."
        actions={<Button variant="primary" onClick={openNew}><Plus /> Шинэ ангилал</Button>}
      />

      {draft && (
        <div className="mb-4">
          <Card title={draft.id ? 'Ангилал засах' : 'Шинэ ангилал'}>
            <form className="grid gap-3 sm:grid-cols-4" onSubmit={onSubmit}>
              <Field label="Нэр" required>
                <Input required autoFocus value={draft.name} placeholder="Үсний гоёл"
                  onChange={(e) => {
                    const name = e.target.value
                    setDraft({ ...draft, name, slug: draft.slugTouched ? draft.slug : slugify(name) })
                  }} />
              </Field>
              <Field label="Slug" required hint="URL-д харагдана">
                <Input required value={draft.slug} placeholder="hair-accessories"
                  onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value), slugTouched: true })} />
              </Field>
              <Field label="Эцэг ангилал">
                <Select value={draft.parentSlug} onChange={(e) => setDraft({ ...draft, parentSlug: e.target.value })}>
                  <option value="">—</option>
                  {parentOptions.map((c) => <option key={c.id} value={c.slug}>{nameOf(c)}</option>)}
                </Select>
              </Field>
              <Field label="Эрэмбэ" hint="Бага нь эхэнд">
                <Input inputMode="numeric" value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value.replace(/[^\d-]/g, '') })} />
              </Field>
              <div className="sm:col-span-4">
                <Field label="Тайлбар">
                  <Textarea rows={2} value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-center gap-2 sm:col-span-4">
                <Checkbox id="category-visible" checked={draft.isVisible}
                  onCheckedChange={(checked) => setDraft({ ...draft, isVisible: checked === true })}
                  className="bg-card dark:bg-card" />
                <Label htmlFor="category-visible" className="text-[13px] font-normal">Дэлгүүрт харуулах</Label>
              </div>
              {error && <p className="text-[13px] text-danger-ink sm:col-span-4">{error}</p>}
              <div className="flex gap-2 sm:col-span-4">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Хадгалж байна…' : draft.id ? 'Хадгалах' : 'Үүсгэх'}
                </Button>
                <Button type="button" onClick={close}>Болих</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState title="Ангилал алга" body="Эхний ангиллаа үүсгэнэ үү."
          action={<Button variant="primary" onClick={openNew}>Үүсгэх</Button>} />
      ) : (
        <DataTable columns={columns} rows={categories} />
      )}
    </>
  )
}
