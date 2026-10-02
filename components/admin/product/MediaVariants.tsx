'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { nodes, toNumber } from '@/lib/format'
import { linkage, moveItem, orphansOf } from '@/lib/admin/images'
import ProductImage from '@/components/ProductImage'
import { Button, Card, Field, IconButton, Input } from '@/components/admin/ui'
import { useConfirm } from '@/components/admin/confirm'
import { Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import VariantRow from './VariantRow'
import PreorderToggle from './PreorderToggle'
import {
  ADD_IMAGE,
  DELETE_IMAGE,
  REORDER_IMAGES,
  SET_VARIANT_PREORDER_PRICE,
  UPSERT_VARIANT,
} from './documents'
import { uploadProductImage } from './uploadImage'
import type { EditorImage, EditorProduct, Refetch } from './types'

export interface MediaVariantsProps {
  product: EditorProduct
  refetch: Refetch
}

const OVERLAY_BUTTON = 'size-6 rounded-lg text-[14px] text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-30 dark:hover:bg-white/20'

const isFileDrag = (types: readonly string[]) => types.includes('Files')

export default function MediaVariants({ product, refetch }: MediaVariantsProps) {
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const { usage, positionStillRules } = linkage(variants)

  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const [addImage] = useMutation(ADD_IMAGE)
  const [deleteImage] = useMutation(DELETE_IMAGE)
  const [reorder] = useMutation(REORDER_IMAGES)

  const moveImage = async (from: number | null, to: number) => {
    const next = moveItem(images, from, to)
    setDragIndex(null)
    if (next.every((img, i) => img.id === images[i].id)) return
    setError(null)
    try {
      await reorder({ variables: { productId: product.id, imageIds: next.map((img) => img.id) } })
      await refetch()
    } catch (e) {
      setError(errorMessage(e, 'Эрэмбэлэхэд алдаа гарлаа.'))
    }
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  const uploadToGallery = async (files: readonly File[]) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const result = await uploadProductImage(file, product.slug)
        await addImage({ variables: {
          productId: product.id,
          imagekitFileId: result.fileId,
          filePath: result.filePath,
          alt: null,
          width: result.width ?? null,
          height: result.height ?? null,
        } })
      }
      await refetch()
    } catch (e) {
      setError(errorMessage(e, 'Байршуулахад алдаа гарлаа.'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDeleteImage = async (img: EditorImage) => {
    const orphans = orphansOf(img.id, variants)
    const warning = orphans.length
      ? `Энэ зургийг ${orphans.length} сонголт ашиглаж байна (${orphans.join(', ')}). Устгавал тэд зураггүй үлдэнэ. Үргэлжлүүлэх үү?`
      : 'Энэ зургийг устгах уу?'
    const ok = await confirm({ title: warning, confirmLabel: 'Устгах', destructive: true })
    if (!ok) return
    setError(null)
    try {
      await deleteImage({ variables: { imageId: img.id } })
      await refetch()
    } catch (e) {
      setError(errorMessage(e, 'Устгахад алдаа гарлаа.'))
    }
  }

  const captionOf = (img: EditorImage, i: number) => {
    const used = usage[img.id]
    if (used) return used.join(', ')
    if (positionStillRules && i === 0) return 'карт'
    if (positionStillRules && i === 1) return 'hover'
    return 'галерей'
  }

  return (
    <Card
      title="Зураг ба сонголт"
      subtitle="шууд хадгалагдана"
      padded={false}
      actions={
        <>
          <Button disabled={busy} onClick={() => inputRef.current?.click()}>
            <Plus /> {busy ? 'Байршуулж байна…' : 'Зураг'}
          </Button>
          <Button variant="primary" onClick={() => setAdding(true)}><Plus /> Сонголт</Button>
        </>
      }
    >
      {!configured && (
        <p className="mx-6 mt-4 rounded-lg border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] text-danger-ink">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadToGallery(Array.from(e.target.files))
        }}
      />

      {variants.length > 0 && (
        <div className="grid grid-cols-[64px_minmax(0,1fr)_128px_136px_104px_40px] items-center gap-4 border-b border-a-line px-6 pb-2 pt-1 text-[12px] font-medium uppercase tracking-[0.04em] text-a-muted">
          <span />
          <span>Сонголт</span>
          <span>SKU</span>
          <span className="text-right">Үнэ</span>
          <span className="text-center">Үлдэгдэл</span>
          <span />
        </div>
      )}

      <div>
        <ul>
          {variants.map((v) => (
            <VariantRow
              key={v.id}
              product={product}
              variant={v}
              images={images}
              sharedCount={v.image?.id ? (usage[v.image.id]?.length ?? 1) : 1}
              refetch={refetch}
              canDelete={variants.length > 1}
            />
          ))}
        </ul>
      </div>

      {variants.length === 0 && (
        <p className="px-6 py-8 text-center text-[13px] text-a-muted">Сонголт алга.</p>
      )}

      {adding && (
        <div className="border-t border-a-line px-6 py-4">
          <VariantForm
            product={product}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); refetch() }}
          />
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (isFileDrag(Array.from(e.dataTransfer?.types ?? []))) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'))
          if (files.length) uploadToGallery(files)
        }}
        className={`border-t px-6 py-4 transition-colors ${dragging ? 'border-a-focus bg-info-soft' : 'border-a-line'}`}
      >
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.04em] text-a-muted">Галерей</p>
        {images.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-a-line px-4 py-10 text-center text-[14px] text-a-muted">
            Зургаа энд чирж оруулна уу
          </p>
        ) : (
          <ul className="flex flex-wrap gap-4">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); moveImage(dragIndex, i) }}
                className={`group w-32 cursor-grab ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-a-line bg-a-hover">
                  <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="128px" />

                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton
                      type="button"
                      onClick={() => moveImage(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Урагш"
                      className={OVERLAY_BUTTON}
                    >←</IconButton>
                    <IconButton
                      type="button"
                      onClick={() => moveImage(i, i + 1)}
                      disabled={i === images.length - 1}
                      aria-label="Хойш"
                      className={OVERLAY_BUTTON}
                    >→</IconButton>
                    <IconButton
                      type="button"
                      onClick={() => onDeleteImage(img)}
                      aria-label="Устгах"
                      className={`${OVERLAY_BUTTON} ml-auto text-[13px] hover:bg-danger dark:hover:bg-danger`}
                    >✕</IconButton>
                  </div>
                </div>

                <p className="mt-2 truncate text-[13px] text-a-muted" title={captionOf(img, i)}>
                  {captionOf(img, i)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-[13px] text-danger-ink">{error}</p>}
      </div>
    </Card>
  )
}

interface VariantFormProps {
  product: EditorProduct
  onClose: () => void
  onSaved: () => void
}

interface NewVariantFields {
  sku: string
  optionLabel: string
  optionValue: string
  priceMnt: string
  quantity: string
  allowBackorder: boolean
  preorderPriceMnt: string
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function VariantForm({ product, onClose, onSaved }: VariantFormProps) {
  const [save, { loading }] = useMutation(UPSERT_VARIANT)
  const [savePreorderPrice, { loading: pricing }] = useMutation(SET_VARIANT_PREORDER_PRICE)
  const [f, setF] = useState<NewVariantFields>({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0', allowBackorder: false, preorderPriceMnt: '' })
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const set = (k: keyof NewVariantFields) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const appendedPosition = nodes(product.variantCollection).length

  const createVariant = async (): Promise<string | null> => {
    const { data } = await save({ variables: {
      productId: product.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      optionLabel: f.optionValue ? f.optionLabel : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: null,
      allowBackorder: f.allowBackorder,
      isActive: true,
      sortOrder: appendedPosition,
      variantId: null,
      imageId: null,
    } })
    return data?.adminUpsertVariant?.id ?? null
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    let variantId = createdId
    try {
      variantId ??= await createVariant()
    } catch (err) {
      setError(errorMessage(err, 'Алдаа гарлаа.'))
      return
    }
    setCreatedId(variantId)
    if (variantId && f.allowBackorder && f.preorderPriceMnt) {
      try {
        await savePreorderPrice({ variables: { variantId, priceMnt: String(toNumber(f.preorderPriceMnt)) } })
      } catch (err) {
        setError(errorMessage(err, 'Сонголт нэмэгдсэн ч урьдчилсан үнийг хадгалж чадсангүй.'))
        return
      }
    }
    onSaved()
  }

  return (
    <form className="grid gap-3 sm:grid-cols-5" onSubmit={onSubmit}>
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Cream" /></Field>
      <Field label="Үнэ (₮)">
        <Input required value={f.priceMnt} onChange={(e) => setF({ ...f, priceMnt: digitsOnly(e.target.value) })} />
      </Field>
      <Field label="Үлдэгдэл">
        <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: digitsOnly(e.target.value) })} />
      </Field>
      <div className="flex flex-wrap items-end gap-4 sm:col-span-5">
        <PreorderToggle
          checked={f.allowBackorder}
          onCheckedChange={(allowBackorder) => setF({ ...f, allowBackorder })}
        />
        {f.allowBackorder && (
          <Field label="Урьдчилсан үнэ (₮)" hint="Хоосон бол үндсэн үнэ">
            <Input
              inputMode="numeric"
              value={f.preorderPriceMnt}
              placeholder={f.priceMnt}
              onChange={(e) => setF({ ...f, preorderPriceMnt: digitsOnly(e.target.value) })}
            />
          </Field>
        )}
      </div>
      {error && <p className="text-[13px] text-danger-ink sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" variant="primary" disabled={loading || pricing}>Нэмэх</Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}
