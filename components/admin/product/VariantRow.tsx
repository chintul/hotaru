'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { toNumber } from '@/lib/format'
import { variantLabel } from '@/lib/admin/images'
import { Button, IconButton, Input, MENU_CONTENT_CLASS, MENU_ITEM_CLASS, Thumb } from '@/components/admin/ui'
import { useConfirm } from '@/components/admin/confirm'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dots } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import ImagePicker from './ImagePicker'
import PreorderToggle from './PreorderToggle'
import {
  DELETE_VARIANT,
  SET_STOCK,
  UPSERT_VARIANT,
} from './documents'
import type { UpsertVariantVars } from './documents'
import type { EditorImage, EditorProduct, EditorVariant, Refetch } from './types'

export interface VariantRowProps {
  product: EditorProduct
  variant: EditorVariant
  images: readonly EditorImage[]
  sharedCount: number
  refetch: Refetch
  canDelete: boolean
}

interface VariantFields {
  optionValue: string
  sku: string
  priceMnt: string
  quantity: string
}

const FIELD_NAMES: readonly (keyof VariantFields)[] = ['optionValue', 'sku', 'priceMnt', 'quantity']

const DEFAULT_OPTION_LABEL = 'Өнгө'

export default function VariantRow({ product, variant, images, sharedCount, refetch, canDelete }: VariantRowProps) {
  const initial: VariantFields = {
    optionValue: variant.optionValue ?? '',
    sku: variant.sku ?? '',
    priceMnt: String(toNumber(variant.priceMnt)),
    quantity: String(variant.quantity),
  }

  const [f, setF] = useState<VariantFields>(initial)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backorder, setBackorder] = useState(variant.allowBackorder ?? false)
  const confirm = useConfirm()

  const [save, { loading: saving }] = useMutation(UPSERT_VARIANT)
  const [setStock, { loading: stocking }] = useMutation(SET_STOCK)
  const [removeVariant] = useMutation(DELETE_VARIANT)

  const dirty = FIELD_NAMES.some((k) => f[k] !== initial[k])
  const stockOnly =
    f.quantity !== initial.quantity &&
    f.optionValue === initial.optionValue &&
    f.sku === initial.sku &&
    f.priceMnt === initial.priceMnt

  const set = (k: keyof VariantFields, digits = false) => (e: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setF({ ...f, [k]: digits ? e.target.value.replace(/\D/g, '') : e.target.value })
  }

  const upsert = async (overrides: Partial<UpsertVariantVars> = {}) => {
    await save({ variables: {
      productId: product.id,
      variantId: variant.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      optionLabel: f.optionValue ? (variant.optionLabel || DEFAULT_OPTION_LABEL) : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: variant.compareAtPriceMnt ?? null,
      allowBackorder: backorder,
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
      setError(errorMessage(e, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  const toggleActive = async () => {
    setError(null)
    try { await upsert({ isActive: !variant.isActive }) }
    catch (e) { setError(errorMessage(e, 'Алдаа гарлаа.')) }
  }

  const toggleBackorder = async (next: boolean) => {
    setError(null)
    setBackorder(next)
    try { await upsert({ allowBackorder: next }) }
    catch (e) {
      setBackorder(!next)
      setError(errorMessage(e, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: `"${variantLabel(variant)}" сонголтыг устгах уу?`,
      confirmLabel: 'Устгах',
      destructive: true,
    })
    if (!ok) return
    setError(null)
    try {
      await removeVariant({ variables: { variantId: variant.id } })
      await refetch()
    } catch (e) {
      setError(errorMessage(e, 'Устгахад алдаа гарлаа.'))
    }
  }

  const outOfStock = Number(f.quantity || 0) === 0 && !backorder

  return (
    <li className="border-b border-a-line px-6 py-4 last:border-0 hover:bg-a-bg/60">
      <div className="grid grid-cols-[64px_minmax(0,1fr)_128px_136px_104px_40px] items-center gap-4">
        <div className="relative">
          <ImagePicker
            open={picking}
            onOpenChange={setPicking}
            product={product}
            variant={variant}
            images={images}
            refetch={refetch}
          >
            <Thumb
              filePath={variant.image?.filePath}
              alt={variant.image?.alt ?? ''}
              count={sharedCount}
              title={variant.image ? 'Зураг солих' : 'Зураг сонгох'}
            />
          </ImagePicker>
        </div>

        <Input value={f.optionValue} onChange={set('optionValue')} placeholder="Өнгө / хэмжээ" />
        <Input value={f.sku} onChange={set('sku')} placeholder="—" className="tabular-nums" />

        <div className="relative">
          <Input
            value={f.priceMnt}
            onChange={set('priceMnt', true)}
            aria-label="Үнэ"
            className="pr-7 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-a-muted">₮</span>
        </div>

        <Input
          value={f.quantity}
          onChange={set('quantity', true)}
          aria-label="Үлдэгдэл"
          tone={outOfStock ? 'blush' : 'mint'}
          className="text-center font-medium tabular-nums"
        />

        <div className="flex justify-end">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Цэс"><Dots /></IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
              <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={toggleActive}>
                {variant.isActive ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" className={MENU_ITEM_CLASS} onSelect={onDelete}>
                    Устгах
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-20">
        <PreorderToggle compact checked={backorder} onCheckedChange={toggleBackorder} disabled={saving} />
        {backorder && (
          <span className="text-[13px] text-a-muted">үлдэгдэл дууссан ч худалдана</span>
        )}
        {dirty && (
          <Button variant="primary" size="sm" disabled={saving || stocking} onClick={onSave}>
            Хадгалах
          </Button>
        )}
        {!variant.isActive && (
          <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[12px] font-normal text-muted-foreground">идэвхгүй</Badge>
        )}
        {!variant.image && (
          <span className="text-[13px] text-a-muted">зураггүй · картад эхний зураг харагдана</span>
        )}
        {error && <span className="text-[13px] text-danger-ink">{error}</span>}
      </div>
    </li>
  )
}
