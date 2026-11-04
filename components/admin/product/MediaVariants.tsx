'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { nodes, toNumber } from '@/lib/format'
import { linkage, moveItem, orphansOf } from '@/lib/admin/images'
import { hasSizes } from '@/lib/sizes'
import ProductImage from '@/components/ProductImage'
import { Button, Card, Field, IconButton, Input } from '@/components/admin/ui'
import { useConfirm } from '@/components/admin/confirm'
import { Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import VariantRow, { VARIANT_GRID_CLASS } from './VariantRow'
import PreorderToggle from './PreorderToggle'
import SizeGridPanel from './SizeGridPanel'
import SalePanel, { batchFailure, batchNotice, usePriceBatch } from './SalePanel'
import { isOnSale, planCancel } from './saleBatch'
import type { PriceChange } from './saleBatch'
import type { BatchResult } from './SalePanel'
import {
  ADD_IMAGE,
  DELETE_IMAGE,
  REORDER_IMAGES,
  SET_VARIANT_PREORDER_PRICE,
  SET_VARIANT_SIZE,
  UPSERT_VARIANT,
} from './documents'
import { COMPARE_AT_MESSAGE, groupByColour, variantErrorMessage } from './sizeGrid'
import { uploadProductImage } from './uploadImage'
import { PANEL_ACTIONS, TOUCH_INPUT } from './touch'
import type { EditorImage, EditorProduct, EditorVariant, Refetch } from './types'

export interface MediaVariantsProps {
  product: EditorProduct
  refetch: Refetch
}

const OVERLAY_BUTTON = 'size-7 max-md:min-h-7 max-md:min-w-7 rounded-lg text-[14px] text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-30 dark:hover:bg-white/20'

const isFileDrag = (types: readonly string[]) => types.includes('Files')

export default function MediaVariants({ product, refetch }: MediaVariantsProps) {
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const { usage, positionStillRules } = linkage(variants)

  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [saleOpen, setSaleOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const [addImage] = useMutation(ADD_IMAGE)
  const [deleteImage] = useMutation(DELETE_IMAGE)
  const [reorder] = useMutation(REORDER_IMAGES)
  const priceBatch = usePriceBatch(product.id)

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

  const sized = hasSizes(variants)
  const groups = sized ? groupByColour(variants) : [{ colour: null, variants }]
  const showGroupHeads = sized && groups.length > 1

  const refreshAfter = async (message: string | null, failure: string | null = null) => {
    setNotice(message)
    setListError(failure)
    try {
      await refetch()
    } catch {
      setListError([failure, 'Хадгалагдсан ч жагсаалтыг шинэчилж чадсангүй. Хуудсаа дахин ачаална уу.'].filter(Boolean).join(' '))
    }
  }

  const finishBatch = (result: BatchResult) => refreshAfter(batchNotice(result), batchFailure(result))

  const onApplySale = async (changes: PriceChange[]) => {
    const result = await priceBatch.run(changes)
    setSaleOpen(false)
    await finishBatch(result)
  }

  const onSale = variants.filter(isOnSale)

  const onCancelSale = async () => {
    const changes = planCancel(variants)
    const ok = await confirm({
      title: 'Хямдрал цуцлах уу?',
      description: `${changes.length} сонголтын үнэ хуучин үнэ рүүгээ буцна.`,
      confirmLabel: 'Хямдрал цуцлах',
      destructive: true,
    })
    if (!ok) return
    setNotice(null)
    setListError(null)
    await finishBatch(await priceBatch.run(changes))
  }

  const renderRow = (v: EditorVariant) => (
    <VariantRow
      key={`${v.id}:${v.priceMnt ?? ''}:${v.compareAtPriceMnt ?? ''}`}
      product={product}
      variant={v}
      images={images}
      sharedCount={v.image?.id ? (usage[v.image.id]?.length ?? 1) : 1}
      refetch={refetch}
      canDelete={variants.length > 1}
    />
  )

  const captionOf = (img: EditorImage, i: number) => {
    const used = usage[img.id]
    if (used) return used.join(', ')
    if (positionStillRules && i === 0) return 'карт'
    if (positionStillRules && i === 1) return 'hover'
    return 'галерей'
  }

  const actions = (
    <>
      <Button disabled={busy} onClick={() => inputRef.current?.click()}>
        <Plus /> {busy ? 'Байршуулж байна…' : 'Зураг'}
      </Button>
      <Button onClick={() => { setNotice(null); setGridOpen(true) }}><Plus /> Хэмжээ нэмэх</Button>
      {onSale.length > 0 && (
        <Button disabled={priceBatch.running} onClick={onCancelSale}>Хямдрал цуцлах</Button>
      )}
      {variants.length > 0 && (
        <Button disabled={priceBatch.running} onClick={() => { setNotice(null); setSaleOpen(true) }}>
          Хямдрал зарлах
        </Button>
      )}
      <Button variant="primary" onClick={() => { setNotice(null); setAdding(true) }}><Plus /> Сонголт</Button>
    </>
  )

  return (
    <Card
      title="Зураг ба сонголт"
      subtitle="шууд хадгалагдана"
      padded={false}
      actions={<div className="hidden items-center gap-2 md:flex">{actions}</div>}
    >
      <div className="flex flex-wrap gap-2 border-b border-a-line px-4 py-3 md:hidden">{actions}</div>

      {!configured && (
        <p className="mx-4 mt-4 md:mx-6 rounded-lg border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] text-danger-ink">
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
        <div className={`hidden ${VARIANT_GRID_CLASS} border-b border-a-line px-6 pb-2 pt-1 text-[12px] font-medium uppercase tracking-[0.04em] text-a-muted`}>
          <span />
          <span>Өнгө</span>
          <span className="text-center">Хэмжээ</span>
          <span>SKU</span>
          <span className="text-right">Үнэ</span>
          <span className="text-right">Хуучин үнэ</span>
          <span className="text-center">Үлдэгдэл</span>
          <span />
        </div>
      )}

      <div>
        <ul>
          {groups.map((group) => showGroupHeads ? (
            <li key={group.colour ?? ''} className="border-b border-a-line last:border-0">
              <p className="bg-a-bg px-4 py-1.5 md:px-6 text-[12px] font-medium text-a-muted">
                <span className="text-a-ink">{group.colour ?? 'Өнгөгүй'}</span>
                {' · '}{group.variants.length} хэмжээ
              </p>
              <ul>{group.variants.map(renderRow)}</ul>
            </li>
          ) : group.variants.map(renderRow))}
        </ul>
      </div>

      {(notice || listError) && (
        <div className="border-t border-a-line px-4 py-3 text-[13px] md:px-6">
          {notice && <p className="text-success-ink">{notice}</p>}
          {listError && <p className="text-danger-ink">{listError}</p>}
        </div>
      )}

      {saleOpen && (
        <div className="border-t border-a-line px-4 py-4 md:px-6">
          <SalePanel
            variants={variants}
            running={priceBatch.running}
            onApply={(changes) => void onApplySale(changes)}
            onClose={() => setSaleOpen(false)}
          />
        </div>
      )}

      {gridOpen && (
        <div className="border-t border-a-line px-4 py-4 md:px-6">
          <SizeGridPanel
            productId={product.id}
            variants={variants}
            onClose={() => setGridOpen(false)}
            onCreated={(message) => { setGridOpen(false); void refreshAfter(message) }}
          />
        </div>
      )}

      {variants.length === 0 && (
        <p className="px-4 py-8 text-center md:px-6 text-[13px] text-a-muted">Сонголт алга.</p>
      )}

      {adding && (
        <div className="border-t border-a-line px-4 py-4 md:px-6">
          <VariantForm
            product={product}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); void refreshAfter(null) }}
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
        className={`border-t px-4 py-4 transition-colors md:px-6 ${dragging ? 'border-a-focus bg-info-soft' : 'border-a-line'}`}
      >
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.04em] text-a-muted">Галерей</p>
        {images.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-a-line px-4 py-10 text-center text-[14px] text-a-muted">
            Зургаа энд чирж оруулна уу
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:flex md:flex-wrap md:gap-4">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); moveImage(dragIndex, i) }}
                className={`group min-w-0 md:w-32 md:cursor-grab ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-a-line bg-a-hover">
                  <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="128px" />

                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/55 to-transparent p-1 transition-opacity md:p-1.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
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

                <p className="mt-1.5 truncate text-[12px] md:mt-2 md:text-[13px] text-a-muted" title={captionOf(img, i)}>
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
  size: string
  priceMnt: string
  compareAtPriceMnt: string
  quantity: string
  allowBackorder: boolean
  preorderPriceMnt: string
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

const baseOf = (f: NewVariantFields) =>
  JSON.stringify([f.sku, f.optionLabel, f.optionValue, f.priceMnt, f.compareAtPriceMnt, f.quantity, f.allowBackorder])

const preorderOf = (f: NewVariantFields) => (f.allowBackorder ? f.preorderPriceMnt : '')

interface SavedParts {
  variantId: string
  base: string
  size: string
  preorder: string
}

function VariantForm({ product, onClose, onSaved }: VariantFormProps) {
  const [save, { loading }] = useMutation(UPSERT_VARIANT)
  const [saveSize, { loading: sizing }] = useMutation(SET_VARIANT_SIZE)
  const [savePreorderPrice, { loading: pricing }] = useMutation(SET_VARIANT_PREORDER_PRICE)
  const [f, setF] = useState<NewVariantFields>({ sku: '', optionLabel: 'Өнгө', optionValue: '', size: '', priceMnt: '', compareAtPriceMnt: '', quantity: '0', allowBackorder: false, preorderPriceMnt: '' })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedParts | null>(null)
  const set = (k: 'sku' | 'optionLabel' | 'optionValue' | 'size') => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const appendedPosition = nodes(product.variantCollection).length

  const upsertVariant = async (variantId: string | null): Promise<string | null> => {
    const { data } = await save({ variables: {
      productId: product.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      optionLabel: f.optionValue ? f.optionLabel : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: f.compareAtPriceMnt ? String(toNumber(f.compareAtPriceMnt)) : null,
      allowBackorder: f.allowBackorder,
      isActive: true,
      sortOrder: appendedPosition,
      variantId,
      imageId: null,
    } })
    return data?.adminUpsertVariant?.id ?? variantId
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (f.compareAtPriceMnt && toNumber(f.compareAtPriceMnt) <= toNumber(f.priceMnt)) {
      setError(COMPARE_AT_MESSAGE)
      return
    }
    const base = baseOf(f)
    let parts = saved
    try {
      if (!parts) {
        const variantId = await upsertVariant(null)
        if (!variantId) {
          setError('Сонголт үүсгэж чадсангүй.')
          return
        }
        parts = { variantId, base, size: '', preorder: '' }
      } else if (parts.base !== base) {
        await upsertVariant(parts.variantId)
        parts = { ...parts, base }
      }
    } catch (err) {
      setError(variantErrorMessage(err, 'Алдаа гарлаа.'))
      return
    }
    setSaved(parts)

    const size = f.size.trim()
    if (size !== parts.size) {
      try {
        await saveSize({ variables: { variantId: parts.variantId, size: size || null } })
      } catch (err) {
        setError(variantErrorMessage(err, 'Сонголт нэмэгдсэн ч хэмжээг хадгалж чадсангүй.'))
        return
      }
      parts = { ...parts, size }
      setSaved(parts)
    }

    const preorder = preorderOf(f)
    if (preorder !== parts.preorder) {
      try {
        await savePreorderPrice({ variables: {
          variantId: parts.variantId,
          priceMnt: preorder ? String(toNumber(preorder)) : null,
        } })
      } catch (err) {
        setError(errorMessage(err, 'Сонголт нэмэгдсэн ч урьдчилсан үнийг хадгалж чадсангүй.'))
        return
      }
      parts = { ...parts, preorder }
      setSaved(parts)
    }
    onSaved()
  }

  const busy = loading || sizing || pricing

  return (
    <form className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7" onSubmit={onSubmit}>
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} className={TOUCH_INPUT} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} className={TOUCH_INPUT} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Хар" className={TOUCH_INPUT} /></Field>
      <Field label="Хэмжээ"><Input value={f.size} onChange={set('size')} placeholder="38" className={TOUCH_INPUT} /></Field>
      <Field label="Үнэ (₮)">
        <Input
          required
          inputMode="numeric"
          value={f.priceMnt}
          onChange={(e) => setF({ ...f, priceMnt: digitsOnly(e.target.value) })}
          className={TOUCH_INPUT}
        />
      </Field>
      <Field label="Хуучин үнэ (₮)" hint="Хоосон бол хямдралгүй">
        <Input
          inputMode="numeric"
          value={f.compareAtPriceMnt}
          onChange={(e) => setF({ ...f, compareAtPriceMnt: digitsOnly(e.target.value) })}
          className={TOUCH_INPUT}
        />
      </Field>
      <Field label="Үлдэгдэл">
        <Input
          inputMode="numeric"
          value={f.quantity}
          onChange={(e) => setF({ ...f, quantity: digitsOnly(e.target.value) })}
          className={TOUCH_INPUT}
        />
      </Field>
      <div className="col-span-full flex flex-wrap items-end gap-4">
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
              className={TOUCH_INPUT}
            />
          </Field>
        )}
      </div>
      {error && (
        <p className="col-span-full text-[13px] text-danger-ink">
          {error}
          {saved && <span className="text-a-muted"> Сонголт үүссэн тул дахин хадгалахад зөвхөн дутуу хэсэг хадгалагдана.</span>}
        </p>
      )}
      <div className={`col-span-full ${PANEL_ACTIONS}`}>
        <Button type="submit" variant="primary" disabled={busy}>{saved ? 'Дахин хадгалах' : 'Нэмэх'}</Button>
        <Button type="button" onClick={saved ? onSaved : onClose}>{saved ? 'Хаах' : 'Болих'}</Button>
      </div>
    </form>
  )
}
