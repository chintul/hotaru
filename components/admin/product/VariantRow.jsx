'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_DELETE_VARIANT, ADMIN_SET_STOCK, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { toNumber } from '@/lib/format'
import { variantLabel } from '@/lib/admin/images'
import { Button, IconButton, Input, Popover, Thumb } from '@/components/admin/ui'
import { Dots } from '@/components/admin/icons'
import ImagePicker from './ImagePicker'

/**
 * One variant, editable in place.
 *
 * Everything except stock used to require delete-and-re-add: the old variants
 * tab let you change the quantity and nothing else, so renaming a colourway
 * destroyed the row — and after this change it would destroy its photo too.
 *
 * TWO SAVE PATHS, on purpose. Quantity alone goes through adminSetStock, which
 * exists so the inventory table can move one number without sending a whole
 * variant back. Anything else sends the row through adminUpsertVariant.
 *
 * And when it does, EVERY column has to be round-tripped. admin_upsert_variant
 * assigns rather than coalesces on all of them except image_id — so omitting
 * compareAtPriceMnt nulls a sale price, omitting allowBackorder silently flips
 * it to false, and omitting position collapses the variant to the front of the
 * swatch row. image_id is the one exception: null there means "not supplied".
 */
export default function VariantRow({ product, variant, images, sharedCount, refetch, canDelete }) {
  const initial = {
    optionValue: variant.optionValue ?? '',
    sku: variant.sku ?? '',
    priceMnt: String(toNumber(variant.priceMnt)),
    quantity: String(variant.quantity),
  }

  const [f, setF] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState(null)
  const thumbRef = useRef(null)
  const menuRef = useRef(null)

  const [save, { loading: saving }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [setStock, { loading: stocking }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const stockOnly =
    f.quantity !== initial.quantity &&
    f.optionValue === initial.optionValue &&
    f.sku === initial.sku &&
    f.priceMnt === initial.priceMnt

  const set = (k, digits = false) => (e) => {
    setError(null)
    setF({ ...f, [k]: digits ? e.target.value.replace(/\D/g, '') : e.target.value })
  }

  const upsert = async (overrides = {}) => {
    await save({ variables: {
      productId: product.id,
      variantId: variant.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      // Both halves or neither — variants_option_pair_ck (20260904120100:173)
      // rejects a label with a null value, which is exactly what clearing a
      // colour name in this row would otherwise send.
      optionLabel: f.optionValue ? (variant.optionLabel || 'Өнгө') : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: variant.compareAtPriceMnt ?? null,
      allowBackorder: variant.allowBackorder ?? false,
      isActive: variant.isActive,
      sortOrder: variant.position ?? 0,
      imageId: null,
      ...overrides,
    } })
    await refetch()
  }

  const onSave = async () => {
    setError(null)
    try {
      if (stockOnly) {
        await setStock({ variables: { variantId: variant.id, quantity: Number(f.quantity || 0) } })
        await refetch()
      } else {
        await upsert()
      }
    } catch (e) {
      setError(e?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  const toggleActive = async () => {
    setMenu(false)
    setError(null)
    try { await upsert({ isActive: !variant.isActive }) }
    catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
  }

  const onDelete = async () => {
    setMenu(false)
    if (!window.confirm(`"${variantLabel(variant)}" сонголтыг устгах уу?`)) return
    setError(null)
    try {
      await removeVariant({ variables: { variantId: variant.id } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Устгахад алдаа гарлаа.')
    }
  }

  const outOfStock = Number(f.quantity || 0) === 0

  return (
    <li className="border-b border-a-line px-6 py-2.5 last:border-0">
      <div className="grid min-w-[720px] grid-cols-[44px_minmax(0,1fr)_112px_120px_92px_auto] items-center gap-3">
        <div className="relative" ref={thumbRef}>
          <Thumb
            filePath={variant.image?.filePath}
            alt={variant.image?.alt ?? ''}
            count={sharedCount}
            onClick={() => setPicking((v) => !v)}
            title={variant.image ? 'Зураг солих' : 'Зураг сонгох'}
          />
          <ImagePicker
            open={picking}
            onClose={() => setPicking(false)}
            anchorRef={thumbRef}
            product={product}
            variant={variant}
            images={images}
            refetch={refetch}
          />
        </div>

        <Input value={f.optionValue} onChange={set('optionValue')} placeholder="Өнгө / хэмжээ" />
        <Input value={f.sku} onChange={set('sku')} placeholder="SKU" className="tabular-nums" />
        <Input
          value={f.priceMnt}
          onChange={set('priceMnt', true)}
          className="text-right tabular-nums"
          aria-label="Үнэ"
        />
        <Input
          value={f.quantity}
          onChange={set('quantity', true)}
          aria-label="Үлдэгдэл"
          className={`text-right tabular-nums ${outOfStock ? 'bg-blush text-blush-ink' : 'bg-mint text-mint-ink'}`}
        />

        <div className="relative flex items-center justify-end gap-1.5" ref={menuRef}>
          {dirty && (
            <Button variant="primary" size="sm" disabled={saving || stocking} onClick={onSave}>
              Хадгалах
            </Button>
          )}
          {!variant.isActive && <span className="text-[12px] text-a-muted">идэвхгүй</span>}
          <IconButton onClick={() => setMenu((v) => !v)} aria-label="Цэс"><Dots /></IconButton>
          <Popover open={menu} onClose={() => setMenu(false)} anchorRef={menuRef} className="right-0 top-8 w-[176px] p-1">
            <button
              type="button"
              onClick={toggleActive}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-a-ink hover:bg-a-hover"
            >
              {variant.isActive ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
            </button>
            {canDelete && (
              <>
                <div className="my-1 border-t border-a-line" />
                <button
                  type="button"
                  onClick={onDelete}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50"
                >
                  Устгах
                </button>
              </>
            )}
          </Popover>
        </div>
      </div>

      {!variant.image && (
        <p className="mt-1 pl-[56px] text-[12px] text-a-muted">
          зураггүй — картад эхний зураг харагдана
        </p>
      )}
      {error && <p className="mt-1 pl-[56px] text-[12px] text-red-600">{error}</p>}
    </li>
  )
}
