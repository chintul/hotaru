'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_DELETE_IMAGE, ADMIN_REORDER_IMAGES, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { nodes, toNumber } from '@/lib/format'
import { linkage, moveItem, orphansOf } from '@/lib/admin/images'
import ProductImage from '@/components/ProductImage'
import { Button, Card, Field, Input } from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'
import VariantRow from './VariantRow'

/**
 * Photographs and variants on one card, because they are one decision.
 *
 * They used to be two tabs, so the editor could never show that a variant had
 * no picture — and variants.image_id is what the storefront actually renders
 * (ProductCard.jsx:35, :41-49). Splitting them is why that column was only ever
 * set by hand-written SQL.
 *
 * Applies immediately: every row already owns its mutation, and a Save button
 * over them would claim a transaction that does not exist.
 *
 * The strip lists EVERY image, labelled with the variants using it or with
 * `галерей`, rather than only the unlinked ones. adminReorderProductImages
 * takes the complete ordered id list, so a strip holding a subset could not
 * express a reorder without rebuilding that list from two places.
 */
export default function MediaVariants({ product, refetch }) {
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const { usage, positionStillRules } = linkage(variants)

  const inputRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [deleteImage] = useMutation(ADMIN_DELETE_IMAGE)
  const [reorder] = useMutation(ADMIN_REORDER_IMAGES)

  // `from` is a parameter rather than a read of dragIndex: the arrow buttons
  // move a tile without a drag ever starting, and setDragIndex would not have
  // applied by the time the handler ran.
  const onDropAt = async (from, to) => {
    const next = moveItem(images, from, to)
    setDragIndex(null)
    if (next.every((img, i) => img.id === images[i].id)) return
    setError(null)
    try {
      await reorder({ variables: { productId: product.id, imageIds: next.map((i) => i.id) } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Эрэмбэлэхэд алдаа гарлаа.')
    }
  }

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  // Gallery upload, for the shots that belong to no single colourway — detail,
  // scale, packaging. A variant's own photo is uploaded from its row instead.
  const onFiles = async (files) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const authRes = await fetch('/api/upload-auth')
        if (!authRes.ok) {
          throw new Error(authRes.status === 403
            ? 'Админ эрх шаардлагатай.'
            : 'Байршуулах эрх авахад алдаа гарлаа.')
        }
        const { token, signature, expire, publicKey } = await authRes.json()
        const result = await upload({
          file,
          fileName: `${product.slug}-${Date.now()}-${file.name}`,
          folder: `/hotaru/${product.slug}`,
          useUniqueFileName: true,
          publicKey,
          token,
          signature,
          expire,
        })
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
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // variants.image_id is `on delete set null`, so the database stays correct
  // either way — but a photo silently vanishing off two colourways is the kind
  // of thing you notice on the storefront, days later.
  const onDeleteImage = async (img) => {
    const orphans = orphansOf(img.id, variants)
    const warning = orphans.length
      ? `Энэ зургийг ${orphans.length} сонголт ашиглаж байна (${orphans.join(', ')}). Устгавал тэд зураггүй үлдэнэ. Үргэлжлүүлэх үү?`
      : 'Энэ зургийг устгах уу?'
    if (!window.confirm(warning)) return
    setError(null)
    try {
      await deleteImage({ variables: { imageId: img.id } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Устгахад алдаа гарлаа.')
    }
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
        <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && onFiles(Array.from(e.target.files))}
      />

      <div className="overflow-x-auto">
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
        // Only light up for a FILE drag. Reordering a tile is also a dragover on
        // this container, and without the check the drop zone reads as armed
        // while you are merely moving a photo within it.
        onDragOver={(e) => {
          e.preventDefault()
          if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'))
          if (files.length) onFiles(files)
        }}
        className={`border-t px-6 py-4 transition-colors ${dragging ? 'border-a-focus bg-blue-50' : 'border-a-line'}`}
      >
        <p className="mb-2 text-[12px] font-medium text-a-muted">Галерей</p>
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-a-line px-4 py-6 text-center text-[13px] text-a-muted">
            Зургаа энд чирж оруулна уу
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropAt(dragIndex, i) }}
                className={`w-24 cursor-grab ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl border border-a-line bg-a-hover">
                  <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="96px" />
                  {/* Position decides the card and hover photos ONLY while no
                      variant carries an image of its own — ProductCard.jsx:35
                      consults the variant first. The old images tab printed
                      these labels unconditionally, which was false for every
                      product that had been paired up. */}
                  {positionStillRules && i < 2 && (
                    <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 text-[11px] font-medium">
                      {i === 0 ? 'карт' : 'hover'}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-a-muted" title={usage[img.id]?.join(', ') ?? 'галерей'}>
                  {usage[img.id]?.join(', ') ?? 'галерей'}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {/* The keyboard path. Native HTML5 drag has no equivalent, and
                      dropping these would make reorder mouse-only. */}
                  <button
                    onClick={() => onDropAt(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Урагш"
                    className="text-[13px] text-a-muted disabled:opacity-25"
                  >←</button>
                  <button
                    onClick={() => onDropAt(i, i + 1)}
                    disabled={i === images.length - 1}
                    aria-label="Хойш"
                    className="text-[13px] text-a-muted disabled:opacity-25"
                  >→</button>
                  <button
                    onClick={() => onDeleteImage(img)}
                    className="ml-auto text-[11px] text-a-muted transition-colors hover:text-red-600"
                  >Устгах</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
      </div>
    </Card>
  )
}

function VariantForm({ product, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [f, setF] = useState({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // A new variant goes to the end of the swatch row, not the front.
  const nextPosition = nodes(product.variantCollection).length

  return (
    <form
      className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        try {
          await save({ variables: {
            productId: product.id,
            priceMnt: String(toNumber(f.priceMnt)),
            quantity: Number(f.quantity || 0),
            sku: f.sku || null,
            optionLabel: f.optionValue ? f.optionLabel : null,
            optionValue: f.optionValue || null,
            compareAtPriceMnt: null,
            allowBackorder: false,
            isActive: true,
            sortOrder: nextPosition,
            variantId: null,
            // Assigned from the row's own picker once the variant exists.
            imageId: null,
          } })
          onSaved()
        } catch (err) { setError(err?.message ?? 'Алдаа гарлаа.') }
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
      {error && <p className="text-[13px] text-red-600 sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" variant="primary" disabled={loading}>Нэмэх</Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}
